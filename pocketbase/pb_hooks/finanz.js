// TP-022 Stufe 1. All persistent reads/writes use the callback's txApp.
const KEY = 'zettelruhe.finanz.v1';
const fields = ['belegdatum', 'buchungsdatum', 'richtung', 'betrag_netto', 'betrag_ust', 'betrag_brutto', 'steuersatz', 'lieferant', 'kunde', 'kategorie', 'notiz', 'konto'];
const invoiceFields = ['kunde', 'rechnungsdatum', 'leistungszeitraum_von', 'leistungszeitraum_bis', 'faellig_am', 'notiz', 'betrag_netto', 'betrag_ust', 'betrag_brutto', 'steuermodus'];
const invoiceProtected = invoiceFields.concat(['firma', 'rechnungsnummer', 'journal_eintrag', 'festgeschrieben_am', 'pdf']);
const positionFields = ['sortierung', 'bezeichnung', 'menge', 'einheit', 'einzelpreis', 'steuersatz', 'betrag_netto', 'betrag_ust', 'betrag_brutto', 'katalog_position'];
const cashFields = ['datum', 'richtung', 'betrag_netto', 'betrag_ust', 'betrag_brutto', 'steuersatz', 'text', 'kategorie', 'notiz', 'kontakt'];
const finalInvoiceStatuses = ['offen', 'teilbezahlt', 'bezahlt', 'ueberfaellig', 'storniert'];
const defaults = { angebot: 'A-', rechnung: 'R-', gutschrift: 'G-', beleg: 'B-', kasse: 'K-', kontakt: 'KT-' };
const sources = { angebot: ['angebote', 'angebotsnummer'], rechnung: ['rechnungen', 'rechnungsnummer'], beleg: ['belege', 'belegnummer'], kasse: ['kassenbuch_eintraege', 'belegnummer'], kontakt: ['kontakte', 'kontaktnummer'] };
function fail(code) { throw new BadRequestError(code, { finanz: new ValidationError(code, code) }); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(k => { out[k] = canonical(value[k]); });
    return out;
  }
  return value;
}
function equal(a, b) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
function scope(e, operations) {
  const c = e.context.value(KEY);
  if (!e.app.isTransactional() || !c || operations.indexOf(c.operation) < 0 || c.id !== e.record.id || c.firma !== (e.record.collection().name === 'firmen' ? e.record.id : e.record.getString('firma'))) fail('MUTATION_FORBIDDEN');
}
function save(tx, record, operation) {
  tx.saveWithContext(new Context(null, KEY, { operation, id: record.id, firma: record.collection().name === 'firmen' ? record.id : record.getString('firma') }), record);
}
function find(tx, col, id) {
  // Query errors propagate. Empty result alone means missing.
  const rows = tx.findRecordsByFilter(col, 'id = {:id}', '', 1, 0, { id });
  if (!rows.length) fail('NOT_FOUND');
  return rows[0];
}
function auth(tx, input, owner) {
  const firma = find(tx, 'firmen', input.firma);
  find(tx, 'users', input.akteur);
  const rows = tx.findRecordsByFilter('mitgliedschaften', 'firma = {:firma} && user = {:user}', '', 1, 0, { firma: input.firma, user: input.akteur });
  if (!rows.length || (owner ? rows[0].getString('rolle') !== 'eigentuemer' : ['eigentuemer', 'bearbeiten'].indexOf(rows[0].getString('rolle')) < 0)) fail('FORBIDDEN');
  return firma;
}
function lockFirma(tx, id) {
  tx.db().newQuery('UPDATE firmen SET nummernkreise = nummernkreise WHERE id = {:id}').bind({ id }).execute();
}
function source(tx, input) {
  const b = find(tx, 'belege', input.id);
  if (b.getString('firma') !== input.firma) fail('FORBIDDEN');
  return b;
}
function projection(b) {
  const p = {};
  const value = readRc(b);
  if (value) p.rc = value;
  fields.forEach(k => { p[k] = b.getString(k); });
  p.datei = Array.from(b.getStringSlice('datei')).sort();
  return p;
}
function compare(b, expected) {
  const p = projection(b);
  if (!expected || !equal(p.rc || null, expected.rc || null) || Object.keys(p).some(k => !equal(p[k], expected[k]))) fail('SOURCE_CHANGED');
}
function journals(tx, b) {
  // Include wrong-company originals too: they are inconsistent, never replayable.
  return tx.findRecordsByFilter('buchungsjournal', 'quelle_typ = "beleg" && quelle_id = {:id} && storno_von = ""', '', 2, 0, { id: b.id });
}
function draft(tx, b) {
  if (b.getString('status') !== 'entwurf' || b.getString('belegnummer') || b.getString('journal_eintrag') || b.getString('festgeschrieben_am') || journals(tx, b).length) fail('INCONSISTENT_STATE');
}
function relations(tx, b, checkCategory = true) {
  const firma = b.getString('firma');
  const direction = b.getString('richtung');
  if ((direction === 'einnahme' && b.getString('lieferant')) || (direction === 'ausgabe' && b.getString('kunde'))) fail('INVALID_STATE');
  ['lieferant', 'kunde'].forEach(k => {
    const id = b.getString(k);
    if (id && find(tx, 'kontakte', id).getString('firma') !== firma) fail('FORBIDDEN');
  });
  const key = s => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const name = key(b.getString('kategorie'));
  if (name && checkCategory) {
    const cats = tx.findRecordsByFilter('kategorien', 'firma = {:firma}', '', 0, 0, { firma });
    const cat = cats.find(c => key(c.getString('name')) === name);
    if (cat && (cat.getString('richtung') === 'einnahme' ? 'einnahme' : 'ausgabe') !== direction) fail('SOURCE_CHANGED');
  }
}
function config(firma, key) {
  return Object.assign({ prefix: defaults[key], digits: 4, next: 1 }, JSON.parse(firma.getString('nummernkreise') || '{}')[key] || {});
}
function allocate(tx, firma, key) {
  if (!Object.prototype.hasOwnProperty.call(defaults, key)) fail('INVALID_STATE');
  const picked = candidate(tx, firma, key);
  const all = Object.assign({}, JSON.parse(firma.getString('nummernkreise') || '{}'));
  all[key] = Object.assign({}, picked.cfg, { next: picked.next });
  firma.set('nummernkreise', all);
  save(tx, firma, 'nummernkreis');
  return picked.number;
}
function candidate(tx, firma, key) {
  if (!Object.prototype.hasOwnProperty.call(defaults, key)) fail('INVALID_STATE');
  const cfg = config(firma, key);
  let n = Number.isFinite(Number(cfg.next)) ? Math.max(1, Math.trunc(Number(cfg.next))) : 1;
  for (let attempt = 0; attempt < 1000; attempt++, n++) {
    const number = (typeof cfg.prefix === 'string' ? cfg.prefix : defaults[key]) + String(n).padStart(Math.max(1, Number(cfg.digits) || 4), '0');
    const s = sources[key];
    const occupied = s && tx.findRecordsByFilter(s[0], 'firma = {:firma} && ' + s[1] + ' = {:number}', '', 1, 0, { firma: firma.id, number }).length;
    if (!occupied) return { number, next: n + 1, cfg };
  }
  fail('NUMBER_EXHAUSTED');
}
function nextJournal(tx, firma) {
  const rows = tx.findRecordsByFilter('buchungsjournal', 'firma = {:firma}', '-laufende_nr', 1, 0, { firma });
  return rows.length ? rows[0].getInt('laufende_nr') + 1 : 1;
}
function journalValues(b, number, timestamp) {
  const p = projection(b);
  const snapshot = readRc(b);
  return { ...(snapshot ? { rc: snapshot, rc_steuerdatum: b.getString('rc_steuerdatum'), rc_vorgang: b.getString('rc_vorgang') } : {}), firma: b.getString('firma'), quelle_typ: 'beleg', quelle_id: b.id, storno_von: '',
    buchungsdatum: p.buchungsdatum || p.belegdatum, belegdatum: p.belegdatum,
    buchungstext: ['Beleg ' + number, p.kategorie, p.notiz].filter(Boolean).join(' — ').slice(0, 500),
    richtung: p.richtung, betrag_netto: p.betrag_netto, betrag_ust: p.betrag_ust, betrag_brutto: p.betrag_brutto,
    steuersatz: p.steuersatz, konto: p.konto, kontakt: (p.richtung === 'einnahme' ? p.kunde : p.lieferant), festgeschrieben_am: timestamp };
}
function receipt(b, j, result) {
  return { result, belegId: b.id, belegnummer: b.getString('belegnummer'), journalId: j.id, journalnummer: j.getInt('laufende_nr'), festgeschriebenAm: b.getString('festgeschrieben_am'), beleg: b, journal: j };
}
function close(tx, input) {
  const firma = auth(tx, input, false);
  const b = source(tx, input);
  const originals = journals(tx, b);
  if (b.getString('status') === 'festgeschrieben') {
    rcSnapshotValid(b);
    const nr = b.getString('belegnummer');
    const time = b.getString('festgeschrieben_am');
    if (!nr || !time || !Number.isFinite(Date.parse(time)) || !b.getString('buchungsdatum') || originals.length !== 1 || originals[0].id !== b.getString('journal_eintrag') || originals[0].getInt('laufende_nr') < 1) fail('INCONSISTENT_STATE');
    const j = originals[0];
    const expected = journalValues(b, nr, time);
    if (!equal(readRc(j), readRc(b))) fail('INCONSISTENT_STATE');
    if (Object.keys(expected).some(k => !equal(k === 'rc' ? readRc(j) : j.getString(k), expected[k]))) fail('INCONSISTENT_STATE');
    relations(tx, b, false);
    return receipt(b, j, 'replayed');
  }
  draft(tx, b);
  compare(b, input.expected);
  relations(tx, b);
  rcPrepare(tx, b, firma);
  const number = allocate(tx, firma, 'beleg');
  const time = new Date().toISOString();
  const j = new Record(tx.findCollectionByNameOrId('buchungsjournal'));
  j.load(journalValues(b, number, time));
  j.set('laufende_nr', nextJournal(tx, firma.id));
  // Assign ID before constructing the narrowly scoped internal context.
  j.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
  save(tx, j, 'beleg-journal');
  b.set('belegnummer', number);
  b.set('buchungsdatum', b.getString('buchungsdatum') || b.getString('belegdatum'));
  b.set('journal_eintrag', j.id);
  b.set('festgeschrieben_am', time);
  b.set('status', 'festgeschrieben');
  save(tx, b, 'beleg-close');
  return receipt(b, j, 'committed');
}
function edit(tx, input, uploads) {
  auth(tx, input, false);
  const b = source(tx, input);
  draft(tx, b);
  compare(b, input.expected);
  if (input.operation === 'delete') {
    tx.deleteWithContext(new Context(null, KEY, { operation: 'beleg-delete', firma: input.firma, id: b.id }), b);
    return { deleted: true };
  }
  const values = input.values || {};
  if (Object.keys(values).some(k => fields.indexOf(k) < 0 && k !== 'rc')) fail('INVALID_STATE');
  Object.keys(values).forEach(k => b.set(k, values[k] == null ? '' : values[k]));
  if (input.remove) {
    const names = Array.from(b.getStringSlice('datei'));
    if (!Array.isArray(input.remove) || input.remove.some(n => names.indexOf(n) < 0)) fail('SOURCE_CHANGED');
    b.set('datei', names.filter(n => input.remove.indexOf(n) < 0));
  }
  if (uploads.length) b.set('datei+', uploads);
  relations(tx, b);
  rcDraft(b);
  save(tx, b, 'beleg-edit');
  return b;
}

function invoiceSource(tx, input) {
  const r = find(tx, 'rechnungen', input.id);
  if (r.getString('firma') !== input.firma) fail('FORBIDDEN');
  return r;
}
function invoicePositions(tx, id) {
  return tx.findRecordsByFilter('rechnungspositionen', 'rechnung = {:id}', 'sortierung,id', 0, 0, { id });
}
function invoiceHead(r) {
  const out = { id: r.id, firma: r.getString('firma') };
  invoiceFields.forEach(k => { out[k] = r.getString(k); });
  out.status = r.getString('status');
  out.rechnungsnummer = r.getString('rechnungsnummer');
  out.journal_eintrag = r.getString('journal_eintrag');
  out.festgeschrieben_am = r.getString('festgeschrieben_am');
  out.pdf = r.getString('pdf');
  return out;
}
function positionProjection(p) {
  const out = { id: p.id, firma: p.getString('firma'), rechnung: p.getString('rechnung') };
  positionFields.forEach(k => { out[k] = k === 'sortierung' ? p.getInt(k) : p.getString(k); });
  return out;
}
function invoiceProjection(tx, r) {
  return { rechnung: invoiceHead(r), positionen: invoicePositions(tx, r.id).map(positionProjection) };
}
function firmaDokumentProjection(f) {
  const strings = ['name', 'strasse', 'plz', 'ort', 'land', 'steuernummer', 'ust_id', 'email', 'telefon', 'webseite', 'logo', 'dokument_akzentfarbe', 'dokument_kopftext', 'dokument_fusstext'];
  const out = { id: f.id };
  strings.forEach(k => { out[k] = f.getString(k); });
  ['dokument_header_drucken', 'dokument_fuss_drucken', 'dokument_zahlblock'].forEach(k => { out[k] = f.getBool(k); });
  return out;
}
function kontaktDokumentProjection(k) {
  return { id: k.id, firma: k.getString('firma'), name: k.getString('name'), strasse: k.getString('strasse'), plz: k.getString('plz'), ort: k.getString('ort'), land: k.getString('land') };
}
function bankDokumentProjection(b) {
  return { id: b.id, firma: b.getString('firma'), name: b.getString('name'), iban: b.getString('iban'), bic: b.getString('bic'), kontoinhaber: b.getString('kontoinhaber'), aktiv: b.getBool('aktiv') };
}
function dokumentProjection(tx, r, firma) {
  const kunde = find(tx, 'kontakte', r.getString('kunde'));
  const banken = tx.findRecordsByFilter('bankkonten', 'firma = {:firma} && aktiv = true', 'name,id', 0, 0, { firma: firma.id });
  return { firma: firmaDokumentProjection(firma), kunde: kontaktDokumentProjection(kunde), bankkonten: banken.map(bankDokumentProjection) };
}
function compareInvoice(tx, r, expected, firma, withDocument) {
  const current = invoiceProjection(tx, r);
  const wanted = expected && { rechnung: expected.rechnung, positionen: expected.positionen };
  if (!expected || !equal(current, wanted)) fail('SOURCE_CHANGED');
  const document = withDocument && dokumentProjection(tx, r, firma);
  if (withDocument && !equal(document, expected.dokument)) fail('SOURCE_CHANGED');
}
function invoiceOriginals(tx, r) {
  return tx.findRecordsByFilter('buchungsjournal', 'quelle_typ = "rechnung" && quelle_id = {:id} && storno_von = ""', '', 2, 0, { id: r.id });
}
function invoiceRelations(tx, r, positions) {
  const firma = r.getString('firma');
  const kunde = r.getString('kunde');
  if (!kunde || find(tx, 'kontakte', kunde).getString('firma') !== firma) fail('FORBIDDEN');
  positions.forEach(p => {
    if (p.getString('firma') !== firma || p.getString('rechnung') !== r.id) fail('FORBIDDEN');
    const katalog = p.getString('katalog_position');
    if (katalog && find(tx, 'katalog_positionen', katalog).getString('firma') !== firma) fail('FORBIDDEN');
  });
}
function invoiceDraft(tx, r) {
  if (r.getString('status') !== 'entwurf' || r.getString('rechnungsnummer') || r.getString('journal_eintrag') || r.getString('festgeschrieben_am') || r.getString('pdf') || invoiceOriginals(tx, r).length) fail('INCONSISTENT_STATE');
}
function unifiedTax(positions, mode) {
  if (mode !== 'regelbesteuerung_ist' || !positions.length) return '';
  const first = positions[0].getString('steuersatz');
  for (let i = 1; i < positions.length; i++) if (positions[i].getString('steuersatz') !== first) return '';
  return first;
}
function invoiceJournalValues(r, positions, kunde, number, timestamp) {
  const parts = ['Rechnung ' + number, kunde.getString('name'), r.getString('notiz')].filter(Boolean);
  return { firma: r.getString('firma'), quelle_typ: 'rechnung', quelle_id: r.id, storno_von: '',
    buchungsdatum: r.getString('rechnungsdatum'), belegdatum: r.getString('rechnungsdatum'), buchungstext: parts.join(' — ').slice(0, 500),
    richtung: 'einnahme', betrag_netto: r.getString('betrag_netto'), betrag_ust: r.getString('betrag_ust'), betrag_brutto: r.getString('betrag_brutto'),
    steuersatz: unifiedTax(positions, r.getString('steuermodus')), konto: '', kontakt: kunde.id, festgeschrieben_am: timestamp };
}
function invoiceReceipt(r, j, result) {
  return { result, rechnungId: r.id, rechnungsnummer: r.getString('rechnungsnummer'), journalId: j.id,
    journalnummer: j.getInt('laufende_nr'), festgeschriebenAm: r.getString('festgeschrieben_am'), pdfDateiname: r.getString('pdf'), rechnung: r, journal: j };
}
function closeInvoice(tx, input, uploads) {
  const firma = auth(tx, input, false);
  const r = invoiceSource(tx, input);
  const positions = invoicePositions(tx, r.id);
  const originals = invoiceOriginals(tx, r);
  if (finalInvoiceStatuses.indexOf(r.getString('status')) >= 0) {
    const number = r.getString('rechnungsnummer');
    const timestamp = r.getString('festgeschrieben_am');
    if (!number || !timestamp || !Number.isFinite(Date.parse(timestamp)) || !r.getString('pdf') || originals.length !== 1 || originals[0].id !== r.getString('journal_eintrag') || originals[0].getInt('laufende_nr') < 1) fail('INCONSISTENT_STATE');
    invoiceRelations(tx, r, positions);
    const expected = invoiceJournalValues(r, positions, find(tx, 'kontakte', r.getString('kunde')), number, timestamp);
    if (Object.keys(expected).some(k => originals[0].getString(k) !== expected[k])) fail('INCONSISTENT_STATE');
    return invoiceReceipt(r, originals[0], 'replayed');
  }
  invoiceDraft(tx, r);
  compareInvoice(tx, r, input.expected, firma, true);
  if (!positions.length) fail('INVALID_STATE');
  invoiceRelations(tx, r, positions);
  if (!input.expected.nummernkreis || !equal(config(firma, 'rechnung'), input.expected.nummernkreis)) fail('NUMBER_CHANGED');
  const picked = candidate(tx, firma, 'rechnung');
  if (picked.number !== input.nummer) fail('NUMBER_CHANGED');
  if (!uploads || uploads.length !== 1) fail('INVALID_STATE');
  const all = Object.assign({}, JSON.parse(firma.getString('nummernkreise') || '{}'));
  all.rechnung = Object.assign({}, picked.cfg, { next: picked.next });
  firma.set('nummernkreise', all);
  save(tx, firma, 'nummernkreis');
  const timestamp = new Date().toISOString();
  const kunde = find(tx, 'kontakte', r.getString('kunde'));
  const values = invoiceJournalValues(r, positions, kunde, picked.number, timestamp);
  if (input.journal && Object.keys(values).filter(k => k !== 'festgeschrieben_am').some(k => input.journal[k] !== values[k])) fail('SOURCE_CHANGED');
  const j = new Record(tx.findCollectionByNameOrId('buchungsjournal'));
  j.load(values);
  j.set('laufende_nr', nextJournal(tx, firma.id));
  j.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
  save(tx, j, 'rechnung-journal');
  r.set('rechnungsnummer', picked.number);
  r.set('journal_eintrag', j.id);
  r.set('festgeschrieben_am', timestamp);
  r.set('status', 'offen');
  r.set('pdf', uploads[0]);
  save(tx, r, 'rechnung-close');
  if (!r.getString('pdf')) fail('INVALID_STATE');
  return invoiceReceipt(r, j, 'committed');
}
function invoiceUpload(e) {
  const form = e.request.multipartForm;
  const headers = form && form.file && form.file.pdf;
  if (!headers || !headers.length) return [];
  if (headers.length !== 1) fail('INVALID_STATE');
  const header = headers[0];
  const contentType = String(header.header.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/pdf' || header.size < 5 || header.size > 15 * 1024 * 1024) fail('INVALID_STATE');
  const uploads = e.findUploadedFiles('pdf');
  if (!uploads || uploads.length !== 1 || !uploads[0]) fail('INVALID_STATE');
  return uploads;
}
function loadInvoiceValues(r, firma, values) {
  if (!values || Object.keys(values).some(k => invoiceFields.indexOf(k) < 0)) fail('INVALID_STATE');
  invoiceFields.forEach(k => r.set(k, values[k] == null ? '' : values[k]));
  r.set('firma', firma);
  r.set('status', 'entwurf');
  r.set('rechnungsnummer', '');
  r.set('journal_eintrag', '');
  r.set('festgeschrieben_am', '');
  r.set('pdf', '');
}
function createInvoicePositions(tx, r, values) {
  if (!Array.isArray(values) || !values.length) fail('INVALID_STATE');
  const out = [];
  values.forEach(value => {
    if (!value || Object.keys(value).some(k => positionFields.indexOf(k) < 0)) fail('INVALID_STATE');
    const p = new Record(tx.findCollectionByNameOrId('rechnungspositionen'));
    p.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
    p.set('firma', r.getString('firma'));
    p.set('rechnung', r.id);
    positionFields.forEach(k => p.set(k, value[k] == null ? '' : value[k]));
    save(tx, p, 'rechnung-position');
    out.push(p);
  });
  return out;
}
function editInvoice(tx, input) {
  auth(tx, input, false);
  if (input.operation === 'create') {
    const r = new Record(tx.findCollectionByNameOrId('rechnungen'));
    r.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
    loadInvoiceValues(r, input.firma, input.values);
    save(tx, r, 'rechnung-draft');
    const positions = createInvoicePositions(tx, r, input.positionen);
    invoiceRelations(tx, r, positions);
    return { rechnung: r, positionen: positions };
  }
  const r = invoiceSource(tx, input);
  invoiceDraft(tx, r);
  compareInvoice(tx, r, input.expected, null, false);
  if (input.operation === 'delete') {
    invoicePositions(tx, r.id).forEach(p => tx.deleteWithContext(new Context(null, KEY, { operation: 'rechnung-position-delete', firma: input.firma, id: p.id }), p));
    tx.deleteWithContext(new Context(null, KEY, { operation: 'rechnung-delete', firma: input.firma, id: r.id }), r);
    return { deleted: true };
  }
  if (input.operation !== 'update') fail('INVALID_STATE');
  invoicePositions(tx, r.id).forEach(p => tx.deleteWithContext(new Context(null, KEY, { operation: 'rechnung-position-delete', firma: input.firma, id: p.id }), p));
  loadInvoiceValues(r, input.firma, input.values);
  save(tx, r, 'rechnung-draft');
  const positions = createInvoicePositions(tx, r, input.positionen);
  invoiceRelations(tx, r, positions);
  return { rechnung: r, positionen: positions };
}

function cashProjection(record) {
  const out = {};
  cashFields.forEach(k => { out[k] = record.getString(k); });
  return out;
}
function cashFullProjection(record) {
  return Object.assign({ id: record.id, firma: record.getString('firma') }, cashProjection(record), {
    belegnummer: record.getString('belegnummer'), journal_eintrag: record.getString('journal_eintrag'),
    festgeschrieben_am: record.getString('festgeschrieben_am'), storno_von: record.getString('storno_von'),
  });
}
function cashInput(values) {
  if (!values || Object.keys(values).some(k => cashFields.indexOf(k) < 0)) fail('INVALID_STATE');
  const out = {};
  cashFields.forEach(k => { out[k] = values[k] == null ? '' : String(values[k]); });
  const dateTime = Date.parse(out.datum + 'T00:00:00.000Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.datum) || !Number.isFinite(dateTime) || new Date(dateTime).toISOString().slice(0, 10) !== out.datum) fail('INVALID_STATE');
  if (['einnahme', 'ausgabe'].indexOf(out.richtung) < 0) fail('INVALID_STATE');
  ['betrag_netto', 'betrag_ust', 'betrag_brutto'].forEach(k => {
    if (!/^(0|[1-9]\d*)\.\d{2}$/.test(out[k])) fail('INVALID_STATE');
  });
  if (out.betrag_brutto === '0.00' || addDigits(cents(out.betrag_netto), cents(out.betrag_ust)) !== cents(out.betrag_brutto)) fail('INVALID_STATE');
  if (['', '0', '7', '19'].indexOf(out.steuersatz) < 0) fail('INVALID_STATE');
  if (!out.text || out.text !== out.text.trim() || out.text.length > 500 || out.kategorie !== out.kategorie.trim() || out.kategorie.length > 120 || out.notiz !== out.notiz.trim() || out.notiz.length > 2000) fail('INVALID_STATE');
  return out;
}
function cents(value) {
  const digits = value.replace('.', '').replace(/^0+(?=\d)/, '');
  return digits || '0';
}
function compareDigits(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return a === b ? 0 : (a < b ? -1 : 1);
}
function addDigits(a, b) {
  let carry = 0;
  let out = '';
  for (let ai = a.length - 1, bi = b.length - 1; ai >= 0 || bi >= 0 || carry; ai--, bi--) {
    const sum = (ai >= 0 ? a.charCodeAt(ai) - 48 : 0) + (bi >= 0 ? b.charCodeAt(bi) - 48 : 0) + carry;
    out = String(sum % 10) + out;
    carry = Math.floor(sum / 10);
  }
  return out.replace(/^0+(?=\d)/, '');
}
function subtractDigits(a, b) {
  let borrow = 0;
  let out = '';
  for (let ai = a.length - 1, bi = b.length - 1; ai >= 0; ai--, bi--) {
    let digit = a.charCodeAt(ai) - 48 - borrow - (bi >= 0 ? b.charCodeAt(bi) - 48 : 0);
    if (digit < 0) { digit += 10; borrow = 1; } else borrow = 0;
    out = String(digit) + out;
  }
  return out.replace(/^0+(?=\d)/, '');
}
function addSigned(balance, direction, magnitude) {
  const sign = direction === 'einnahme' ? 1 : -1;
  if (balance.sign === sign) return { sign, value: addDigits(balance.value, magnitude) };
  const compared = compareDigits(balance.value, magnitude);
  if (compared === 0) return { sign: 1, value: '0' };
  return compared > 0
    ? { sign: balance.sign, value: subtractDigits(balance.value, magnitude) }
    : { sign, value: subtractDigits(magnitude, balance.value) };
}
function cashRelations(tx, firma, values, checkCategory) {
  if (values.kontakt && find(tx, 'kontakte', values.kontakt).getString('firma') !== firma) fail('FORBIDDEN');
  const key = s => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const name = key(values.kategorie);
  if (name && checkCategory) {
    const categories = tx.findRecordsByFilter('kategorien', 'firma = {:firma}', '', 0, 0, { firma });
    const category = categories.find(c => key(c.getString('name')) === name);
    if (category && (category.getString('richtung') === 'einnahme' ? 'einnahme' : 'ausgabe') !== values.richtung) fail('SOURCE_CHANGED');
  }
}
function assertCashBalance(tx, firma, candidate) {
  const rows = tx.findRecordsByFilter('kassenbuch_eintraege', 'firma = {:firma}', 'datum,id', 0, 0, { firma });
  const entries = rows.map(r => ({ id: r.id, datum: r.getString('datum'), richtung: r.getString('richtung'), amount: cents(r.getString('betrag_brutto')) }));
  entries.push({ id: candidate.id, datum: candidate.datum, richtung: candidate.richtung, amount: cents(candidate.betrag_brutto) });
  entries.sort((a, b) => a.datum === b.datum ? (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : (a.datum < b.datum ? -1 : 1));
  let balance = { sign: 1, value: '0' };
  entries.forEach(entry => {
    if (!/^(0|[1-9]\d*)$/.test(entry.amount) || ['einnahme', 'ausgabe'].indexOf(entry.richtung) < 0) fail('INCONSISTENT_STATE');
    balance = addSigned(balance, entry.richtung, entry.amount);
    if (balance.sign < 0 && balance.value !== '0') fail('NEGATIVE_BALANCE');
  });
}
function cashOriginals(tx, id) {
  return tx.findRecordsByFilter('buchungsjournal', 'quelle_typ = "kasse" && quelle_id = {:id} && storno_von = ""', '', 2, 0, { id });
}
function cashStornos(tx, id) {
  return tx.findRecordsByFilter('kassenbuch_eintraege', 'storno_von = {:id}', '', 2, 0, { id });
}
function journalStornos(tx, id) {
  return tx.findRecordsByFilter('buchungsjournal', 'storno_von = {:id}', '', 2, 0, { id });
}
function cashJournalValues(record, number, timestamp) {
  const values = cashProjection(record);
  return { firma: record.getString('firma'), quelle_typ: 'kasse', quelle_id: record.id, storno_von: '',
    buchungsdatum: values.datum, belegdatum: values.datum,
    buchungstext: ['Kasse ' + number, values.kategorie, values.text].filter(Boolean).join(' — ').slice(0, 500),
    richtung: values.richtung, betrag_netto: values.betrag_netto, betrag_ust: values.betrag_ust,
    betrag_brutto: values.betrag_brutto, steuersatz: values.steuersatz, konto: '', kontakt: values.kontakt,
    festgeschrieben_am: timestamp };
}
function cashReceipt(record, journal, result) {
  return { result, eintragId: record.id, belegnummer: record.getString('belegnummer'), journalId: journal.id,
    journalnummer: journal.getInt('laufende_nr'), festgeschriebenAm: record.getString('festgeschrieben_am'), eintrag: record, journal };
}
function assertCashOriginal(tx, record) {
  const originals = cashOriginals(tx, record.id);
  const number = record.getString('belegnummer');
  const timestamp = record.getString('festgeschrieben_am');
  if (!number || !timestamp || !Number.isFinite(Date.parse(timestamp)) || originals.length !== 1 || originals[0].id !== record.getString('journal_eintrag') || originals[0].getInt('laufende_nr') < 1 || record.getString('storno_von')) fail('INCONSISTENT_STATE');
  const expected = cashJournalValues(record, number, timestamp);
  if (Object.keys(expected).some(k => originals[0].getString(k) !== expected[k])) fail('INCONSISTENT_STATE');
  return originals[0];
}
function closeCash(tx, input) {
  const firma = auth(tx, input, false);
  if (!/^[a-z0-9]{15}$/.test(input.id || '')) fail('INVALID_STATE');
  const requested = cashInput(input.values);
  const existing = tx.findRecordsByFilter('kassenbuch_eintraege', 'id = {:id}', '', 1, 0, { id: input.id });
  if (existing.length) {
    const record = existing[0];
    if (record.getString('firma') !== input.firma) fail('FORBIDDEN');
    const journal = assertCashOriginal(tx, record);
    if (!equal(cashProjection(record), requested)) fail('SOURCE_CHANGED');
    cashRelations(tx, input.firma, requested, false);
    return cashReceipt(record, journal, 'replayed');
  }
  cashRelations(tx, input.firma, requested, true);
  const number = allocate(tx, firma, 'kasse');
  assertCashBalance(tx, input.firma, Object.assign({ id: input.id }, requested));
  const timestamp = new Date().toISOString();
  const record = new Record(tx.findCollectionByNameOrId('kassenbuch_eintraege'));
  record.id = input.id;
  record.load(Object.assign({ firma: input.firma, belegnummer: number, festgeschrieben_am: timestamp, journal_eintrag: '', storno_von: '' }, requested));
  save(tx, record, 'kasse-create');
  const journal = new Record(tx.findCollectionByNameOrId('buchungsjournal'));
  journal.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
  journal.load(cashJournalValues(record, number, timestamp));
  journal.set('laufende_nr', nextJournal(tx, input.firma));
  save(tx, journal, 'kasse-journal');
  record.set('journal_eintrag', journal.id);
  save(tx, record, 'kasse-link');
  return cashReceipt(record, journal, 'committed');
}
function cashStornoJournalValues(originalJournal, originalCash, requested, timestamp) {
  const defaultCashText = ('Storno zu ' + originalCash.getString('belegnummer') + ': ' + originalCash.getString('text')).slice(0, 500);
  const text = requested.text === defaultCashText
    ? ('Storno Kasse ' + originalCash.getString('belegnummer') + ': ' + originalCash.getString('text')).slice(0, 500)
    : requested.text;
  return { firma: originalCash.getString('firma'), quelle_typ: 'storno', quelle_id: originalJournal.id, storno_von: originalJournal.id,
    buchungsdatum: requested.datum, belegdatum: originalJournal.getString('buchungsdatum'), buchungstext: text,
    richtung: requested.richtung, betrag_netto: originalJournal.getString('betrag_netto'), betrag_ust: originalJournal.getString('betrag_ust'),
    betrag_brutto: originalJournal.getString('betrag_brutto'), steuersatz: originalJournal.getString('steuersatz'),
    konto: originalJournal.getString('konto'), kontakt: originalJournal.getString('kontakt'), festgeschrieben_am: timestamp };
}
function validateCashStornoValues(original, requested) {
  const inverse = original.getString('richtung') === 'einnahme' ? 'ausgabe' : 'einnahme';
  const same = ['betrag_netto', 'betrag_ust', 'betrag_brutto', 'steuersatz', 'kategorie', 'notiz', 'kontakt'];
  if (requested.richtung !== inverse || same.some(k => requested[k] !== original.getString(k))) fail('SOURCE_CHANGED');
}
function cashStornoReceipt(original, record, journal, result) {
  return Object.assign(cashReceipt(record, journal, result), { originalId: original.id });
}
function nextCashStornoId(tx, original, date) {
  if (date !== original.getString('datum')) return $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let current = original.id;
  for (let attempt = 0; attempt < 1000; attempt++) {
    const chars = current.split('');
    let position = chars.length - 1;
    while (position >= 0 && chars[position] === 'z') { chars[position] = '0'; position--; }
    if (position < 0) fail('NUMBER_EXHAUSTED');
    const index = alphabet.indexOf(chars[position]);
    if (index < 0 || index === alphabet.length - 1) fail('INVALID_STATE');
    chars[position] = alphabet[index + 1];
    current = chars.join('');
    if (!tx.findRecordsByFilter('kassenbuch_eintraege', 'id = {:id}', '', 1, 0, { id: current }).length) return current;
  }
  fail('NUMBER_EXHAUSTED');
}
function cancelCash(tx, input) {
  auth(tx, input, false);
  // Acquire SQLite's writer lock before reading the replay and balance state.
  lockFirma(tx, input.firma);
  const original = find(tx, 'kassenbuch_eintraege', input.id);
  if (original.getString('firma') !== input.firma) fail('FORBIDDEN');
  if (!input.expected || !equal(cashFullProjection(original), input.expected)) fail('SOURCE_CHANGED');
  const originalJournal = assertCashOriginal(tx, original);
  cashRelations(tx, input.firma, cashProjection(original), false);
  const requested = cashInput(input.values);
  validateCashStornoValues(original, requested);
  cashRelations(tx, input.firma, requested, true);
  const records = cashStornos(tx, original.id);
  const journals = journalStornos(tx, originalJournal.id);
  if (records.length || journals.length) {
    if (records.length !== 1 || journals.length !== 1) fail('INCONSISTENT_STATE');
    const record = records[0];
    const journal = journals[0];
    const number = record.getString('belegnummer');
    const timestamp = record.getString('festgeschrieben_am');
    if (record.getString('firma') !== input.firma || !number || !timestamp || !Number.isFinite(Date.parse(timestamp)) || record.getString('journal_eintrag') !== journal.id || journal.getInt('laufende_nr') < 1 || !equal(cashProjection(record), requested)) fail('INCONSISTENT_STATE');
    const expected = cashStornoJournalValues(originalJournal, original, requested, timestamp);
    if (Object.keys(expected).some(k => journal.getString(k) !== expected[k])) fail('INCONSISTENT_STATE');
    return cashStornoReceipt(original, record, journal, 'replayed');
  }
  const number = allocate(tx, find(tx, 'firmen', input.firma), 'kasse');
  const record = new Record(tx.findCollectionByNameOrId('kassenbuch_eintraege'));
  record.id = nextCashStornoId(tx, original, requested.datum);
  assertCashBalance(tx, input.firma, Object.assign({ id: record.id }, requested));
  const timestamp = new Date().toISOString();
  record.load(Object.assign({ firma: input.firma, belegnummer: number, festgeschrieben_am: timestamp, journal_eintrag: '', storno_von: original.id }, requested));
  save(tx, record, 'kasse-storno-create');
  const journal = new Record(tx.findCollectionByNameOrId('buchungsjournal'));
  journal.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
  journal.load(cashStornoJournalValues(originalJournal, original, requested, timestamp));
  journal.set('laufende_nr', nextJournal(tx, input.firma));
  save(tx, journal, 'kasse-storno-journal');
  record.set('journal_eintrag', journal.id);
  save(tx, record, 'kasse-storno-link');
  return cashStornoReceipt(original, record, journal, 'committed');
}
exports.route = (e, operation) => {
  const input = e.requestInfo().body;
  let data = input;
  let uploads = [];
  if (operation === 'edit' || operation === 'invoice-close') {
    data = JSON.parse(input.payload);
    if (operation === 'edit' && e.request.multipartForm && e.request.multipartForm.file && e.request.multipartForm.file.datei && e.request.multipartForm.file.datei.length) uploads = e.findUploadedFiles('datei');
    if (operation === 'invoice-close') uploads = invoiceUpload(e);
  }
  let result;
  e.app.runInTransaction(tx => {
    if (operation === 'close') result = close(tx, data);
    else if (operation === 'edit') result = edit(tx, data, uploads);
    else if (operation === 'invoice-close') result = closeInvoice(tx, data, uploads);
    else if (operation === 'invoice-edit') result = editInvoice(tx, data);
    else if (operation === 'cash-close') result = closeCash(tx, data);
    else if (operation === 'rc-cancel') result = cancelRc(tx, data);
    else if (operation === 'cash-cancel') result = cancelCash(tx, data);
    else if (operation === 'allocate') {
      // Transitional service-only allocator for existing Next writers. No document atomicity.
      if (['beleg', 'kasse'].indexOf(data.key) >= 0) fail('MUTATION_FORBIDDEN');
      result = { nummer: allocate(tx, find(tx, 'firmen', data.firma), data.key) };
    } else if (operation === 'configure') {
      const firma = auth(tx, data, true);
      const all = Object.assign({}, JSON.parse(firma.getString('nummernkreise') || '{}'));
      Object.keys(data.changes).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(defaults, key)) fail('INVALID_STATE');
        const c = data.changes[key];
        const current = config(firma, key);
        if (!c.expected || ['prefix', 'digits', 'next'].some(k => current[k] !== c.expected[k])) fail('NUMBER_CHANGED');
        const v = c.value;
        if (typeof v.prefix !== 'string' || v.prefix.length > 16 || !Number.isInteger(v.digits) || v.digits < 1 || v.digits > 8 || !Number.isSafeInteger(v.next) || v.next < current.next) fail('INVALID_STATE');
        all[key] = { prefix: v.prefix, digits: v.digits, next: v.next };
      });
      firma.set('nummernkreise', all);
      save(tx, firma, 'nummernkreis');
      result = { nummernkreise: all };
    }
  });
  return e.json(200, result);
};
exports.belegUpdate = e => { scope(e, ['beleg-edit', 'beleg-close']); e.next(); };
exports.belegDelete = e => { scope(e, ['beleg-delete']); e.next(); };
exports.belegCreate = e => {
  // Existing draft creation remains supported, but cannot seed a committed source.
  draft(e.app, e.record);
  rcDraft(e.record);
  relations(e.app, e.record);
  e.next();
};
exports.firmaUpdate = e => {
  const c = e.context.value(KEY);
  if (c && c.operation === 'nummernkreis') { scope(e, ['nummernkreis']); return e.next(); }
  if (!equal(e.record.get('nummernkreise'), e.record.original().get('nummernkreise'))) fail('MUTATION_FORBIDDEN');
  // Ordinary company edits also carry the model's old JSON. Refresh it inside the write transaction.
  e.app.runInTransaction(tx => {
    e.record.set('nummernkreise', find(tx, 'firmen', e.record.id).get('nummernkreise'));
    e.app = tx;
    e.next();
  });
};
exports.journalCreate = e => {
  const value = readRc(e.record);
  const originalId = e.record.getString('storno_von');
  const original = originalId ? e.app.findRecordsByFilter('buchungsjournal', 'id = {:id}', '', 1, 0, { id: originalId }) : [];
  if (value || e.record.getString('rc_steuerdatum') || e.record.getString('rc_vorgang') || (original.length && readRc(original[0]))) {
    scope(e, ['beleg-journal', 'rc-storno-journal']);
    if (!value) fail('INVALID_STATE');
    return e.next();
  }
  if (e.record.getString('quelle_typ') === 'beleg') { scope(e, ['beleg-journal']); return e.next(); }
  if (e.record.getString('quelle_typ') === 'rechnung') { scope(e, ['rechnung-journal']); return e.next(); }
  if (e.record.getString('quelle_typ') === 'kasse') { scope(e, ['kasse-journal']); return e.next(); }
  if (e.record.getString('quelle_typ') === 'storno' && e.record.getString('storno_von')) {
    const originals = e.app.findRecordsByFilter('buchungsjournal', 'id = {:id}', '', 1, 0, { id: e.record.getString('storno_von') });
    if (originals.length && originals[0].getString('quelle_typ') === 'kasse') { scope(e, ['kasse-storno-journal']); return e.next(); }
  }
  if (e.record.getString('quelle_typ') === 'zahlung') { scope(e, ['zahlung-journal']); return e.next(); }
  if (original.length && ['rechnung','zahlung'].indexOf(original[0].getString('quelle_typ')) >= 0) { scope(e, ['zahlung-storno']); return e.next(); }
  // Other journal writers retain their existing semantics. Serialize their shared max+1 writer.
  e.app.runInTransaction(tx => {
    e.record.set('laufende_nr', nextJournal(tx, e.record.getString('firma')));
    e.app = tx;
    e.next();
  });
};
function isCashJournal(app, record) {
  if (record.getString('quelle_typ') === 'kasse') return true;
  const originalId = record.getString('storno_von');
  if (record.getString('quelle_typ') !== 'storno' || !originalId) return false;
  const originals = app.findRecordsByFilter('buchungsjournal', 'id = {:id}', '', 1, 0, { id: originalId });
  return originals.length === 1 && originals[0].getString('quelle_typ') === 'kasse';
}
exports.journalMutation = e => {
  for (const record of [e.record, e.record.original()]) {
    const id=record.getString('storno_von');
    if (id) {
      const original=e.app.findRecordsByFilter('buchungsjournal','id = {:id}','',1,0,{id});
      if (original.length && ['rechnung','zahlung'].indexOf(original[0].getString('quelle_typ'))>=0) fail('MUTATION_FORBIDDEN');
    }
  }

  if (e.record.getString('quelle_typ') === 'zahlung' || e.record.original().getString('quelle_typ') === 'zahlung') fail('MUTATION_FORBIDDEN');
  if (readRc(e.record) || readRc(e.record.original()) || e.record.getString("rc_steuerdatum") || e.record.getString("rc_vorgang")) fail("MUTATION_FORBIDDEN");
  if (['beleg', 'rechnung'].indexOf(e.record.getString('quelle_typ')) >= 0 || ['beleg', 'rechnung'].indexOf(e.record.original().getString('quelle_typ')) >= 0 || isCashJournal(e.app, e.record) || isCashJournal(e.app, e.record.original())) fail('MUTATION_FORBIDDEN');
  e.next();
};
exports.rechnungCreate = e => { scope(e, ['rechnung-draft']); e.next(); };
exports.rechnungUpdate = e => {
  const c = e.context.value(KEY);
  if (c && ['rechnung-draft', 'rechnung-close', 'zahlung-status'].indexOf(c.operation) >= 0) { scope(e, [c.operation]); return e.next(); }
  fail('MUTATION_FORBIDDEN');
};
exports.rechnungDelete = e => { scope(e, ['rechnung-delete']); e.next(); };
exports.positionCreate = e => { scope(e, ['rechnung-position']); e.next(); };
exports.positionUpdate = e => { fail('MUTATION_FORBIDDEN'); };
exports.positionDelete = e => {
  const c = e.context.value(KEY);
  if (!e.app.isTransactional() || !c || ['rechnung-position-delete', 'rechnung-delete'].indexOf(c.operation) < 0 || c.firma !== e.record.getString('firma')) fail('MUTATION_FORBIDDEN');
  if (c.operation === 'rechnung-position-delete' && c.id !== e.record.id) fail('MUTATION_FORBIDDEN');
  if (c.operation === 'rechnung-delete' && c.id !== e.record.getString('rechnung')) fail('MUTATION_FORBIDDEN');
  e.next();
};
exports.kasseCreate = e => { scope(e, ['kasse-create', 'kasse-storno-create']); e.next(); };
exports.kasseUpdate = e => { scope(e, ['kasse-link', 'kasse-storno-link']); e.next(); };
exports.kasseDelete = e => { fail('MUTATION_FORBIDDEN'); };

// RC v1: all reads and writes stay inside the existing transaction.
const rc = require(__hooks + '/reverse-charge.js');
function readRc(record) { return JSON.parse(record.getString('rc') || 'null'); }
function rcEnabled() { if (!rc.RC_PUBLIC_ENABLED) fail('RC_DISABLED'); }
function rcTry(fn) {
  try { return fn(); } catch (error) { throw new BadRequestError('RC_INVALID', { finanz: new ValidationError('RC_INVALID', String(error.message || error)) }); }
}
function rcDraft(record) {
  const value = readRc(record);
  if (record.getString('rc_steuerdatum') || record.getString('rc_vorgang')) fail('INVALID_STATE');
  if (value !== null) { rcEnabled(); rcTry(() => rc.validateRcInput(value)); }
}
function rcSnapshotValid(record) {
  const saved = readRc(record);
  if (!saved) {
    if (record.getString('rc_steuerdatum') || record.getString('rc_vorgang')) fail('INCONSISTENT_STATE');
    return;
  }
  const calculated = rcTry(() => rc.calculateRc(rc.rcInputFromSnapshot(saved), projection(record), saved.steuermodus, rc.rcToday(record.getString('festgeschrieben_am'))));
  if (!equal(calculated, saved) || saved.steuerdatum !== record.getString('rc_steuerdatum') || saved.vorgang !== record.getString('rc_vorgang')) fail('INCONSISTENT_STATE');
}
function rcPrepare(tx, b, firma) {
  const value = readRc(b);
  if (!value) { rcDraft(b); return; }
  rcEnabled();
  if (value.steuermodus !== firma.getString('steuermodus')) fail('RC_MODE_CHANGED');
  const snapshot = rcTry(() => rc.calculateRc(value, projection(b), firma.getString('steuermodus'), rc.rcToday(new Date().toISOString())));
  // Serializes duplicate economic services across distinct source IDs, including advances/final invoices.
  lockFirma(tx, firma.id);
  const prior = tx.findRecordsByFilter('buchungsjournal', 'firma = {:firma} && rc_vorgang = {:vorgang} && quelle_typ = "beleg"', '', 0, 0, { firma: firma.id, vorgang: snapshot.vorgang });
  for (const row of prior) {
    const reversals = journalStornos(tx, row.id);
    // A corrected capture can be entered again only after a complete error reversal.
    if (reversals.length !== 1 || !readRc(reversals[0]) || readRc(reversals[0]).korrektur.art !== 'erfassungsfehler') fail('RC_DUPLICATE');
  }
  b.set('rc', snapshot);
  b.set('rc_steuerdatum', snapshot.steuerdatum);
  b.set('rc_vorgang', snapshot.vorgang);
}
function rcJournalProjection(record) {
  const out = {};
  ['firma', 'quelle_typ', 'quelle_id', 'storno_von', 'buchungsdatum', 'belegdatum', 'buchungstext', 'richtung', 'betrag_netto', 'betrag_ust', 'betrag_brutto', 'steuersatz', 'konto', 'kontakt', 'festgeschrieben_am', 'rc_steuerdatum', 'rc_vorgang'].forEach(k => { out[k] = record.getString(k); });
  out.rc = readRc(record);
  out.laufende_nr = record.getInt('laufende_nr');
  return out;
}
function cancelRc(tx, input) {
  rcEnabled();
  auth(tx, input, false);
  lockFirma(tx, input.firma);
  const original = find(tx, 'buchungsjournal', input.id);
  if (original.getString('firma') !== input.firma) fail('FORBIDDEN');
  if (original.getString('quelle_typ') !== 'beleg' || !readRc(original)) fail('INVALID_STATE');
  const sourceRecord = find(tx, 'belege', original.getString('quelle_id'));
  if (sourceRecord.getString('firma') !== input.firma || sourceRecord.getString('journal_eintrag') !== original.id) fail('INCONSISTENT_STATE');
  rcSnapshotValid(sourceRecord);
  const sourceJournal = journalValues(sourceRecord, sourceRecord.getString('belegnummer'), sourceRecord.getString('festgeschrieben_am'));
  if (Object.keys(sourceJournal).some(k => !equal(k === 'rc' ? readRc(original) : original.getString(k), sourceJournal[k]))) fail('INCONSISTENT_STATE');
  if (!equal(rcJournalProjection(original), input.expected)) fail('SOURCE_CHANGED');
  const correction = Object.assign({}, input.korrektur, { original: original.id });
  const snapshot = rcTry(() => rc.correctRc(readRc(original), correction, rc.rcToday(new Date().toISOString())));
  const values = rcJournalProjection(original);
  delete values.laufende_nr;
  values.quelle_typ = 'storno'; values.quelle_id = original.id; values.storno_von = original.id;
  values.richtung = 'einnahme';
  values.buchungsdatum = correction.art === 'erfassungsfehler' ? original.getString('buchungsdatum') : correction.datum;
  values.buchungstext = ('RC-Korrektur zu Nr. ' + original.getInt('laufende_nr') + ': ' + correction.nachweis).slice(0, 500);
  values.rc = snapshot; values.rc_steuerdatum = snapshot.steuerdatum;
  const prior = journalStornos(tx, original.id);
  if (prior.length) {
    if (prior.length !== 1) fail('INCONSISTENT_STATE');
    const old = prior[0];
    if (Object.keys(values).filter(k => k !== 'festgeschrieben_am').some(k => !equal(k === 'rc' ? readRc(old) : old.getString(k), values[k]))) fail('SOURCE_CHANGED');
    return { result: 'replayed', journal: old };
  }
  const j = new Record(tx.findCollectionByNameOrId('buchungsjournal'));
  j.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
  values.festgeschrieben_am = new Date().toISOString();
  j.load(values); j.set('laufende_nr', nextJournal(tx, input.firma));
  save(tx, j, 'rc-storno-journal');
  return { result: 'committed', journal: j };
}

// Release corrections: small fixed operations using the existing transaction boundary.
function dto(record) { return JSON.parse(JSON.stringify(record)); }
function owned(tx, col, id, firma) {
  const record = find(tx, col, id);
  if (record.getString('firma') !== firma) fail('FORBIDDEN');
  return record;
}
function recordsFor(tx, col, filter, params) { return tx.findRecordsByFilter(col, filter, 'id', 0, 0, params); }
function paymentRows(tx, firma, rechnung) { return recordsFor(tx, 'zahlungen', 'firma = {:firma} && rechnung = {:rechnung}', { firma, rechnung }); }
function paymentJournals(tx, id) { return recordsFor(tx, 'buchungsjournal', 'quelle_typ = "zahlung" && quelle_id = {:id}', { id }); }
function activePaymentJournals(tx, payments) {
  const out = [];
  payments.forEach(p => paymentJournals(tx, p.id).forEach(j => { if (!journalStornos(tx, j.id).length) out.push(dto(j)); }));
  return out;
}
function syncPaymentStatus(tx, r, heute) {
  const rules = require(__hooks + '/domain/payment-invariants.js');
  const payments = paymentRows(tx, r.getString('firma'), r.id).map(dto);
  const status = rules.deriveRechnungStatus({ currentStatus: r.getString('status'), betragBrutto: r.getString('betrag_brutto'), zahlungen: payments, faellig_am: r.getString('faellig_am'), heute });
  if (status !== r.getString('status')) { r.set('status', status); save(tx, r, 'zahlung-status'); }
  return { status, offen: rules.offenerBetrag(r.getString('betrag_brutto'), payments) };
}
function writePaymentJournal(tx, r, p, payments, cumulative) {
  const rules = require(__hooks + '/domain/payment-invariants.js');
  const amounts = require(__hooks + '/domain/money.js');
  const existing = paymentJournals(tx, p.id);
  if (existing.length) {
    // Historical partial/mismatched rows require an explicit audit, never silent repair.
    if (existing.some(j => j.getString('firma') !== p.getString('firma')) || !amounts.sumMoney(...existing.map(j => j.getString('betrag_brutto'))).eq(p.getString('betrag'))) fail('INCONSISTENT_STATE');
    return existing;
  }
  if (r.getString('status') === 'storniert') return [];
  const other = payments.filter(z => z.id !== p.id);
  const already = activePaymentJournals(tx, other);
  const fully = amounts.money(rules.sumZahlungen((cumulative || payments).map(dto))).gte(r.getString('betrag_brutto'));
  const inputs = rules.buildJournalInputsFromZahlung({ zahlung: dto(p), rechnung: dto(r), positionen: invoicePositions(tx, r.id).map(dto), bereits: already, vollstaendig: fully });
  if (!amounts.sumMoney(...inputs.map(j => j.betrag_brutto)).eq(p.getString('betrag'))) fail('INCONSISTENT_STATE');
  return inputs.map(values => {
    const j = new Record(tx.findCollectionByNameOrId('buchungsjournal'));
    j.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
    j.load(Object.assign({}, values, { firma: r.getString('firma'), laufende_nr: nextJournal(tx, r.getString('firma')), festgeschrieben_am: new Date().toISOString() }));
    save(tx, j, 'zahlung-journal');
    return j;
  });
}
function backfillInvoice(tx, r) {
  if (r.getString('status') === 'storniert' || r.getString('status') === 'entwurf') return 0;
  const payments = paymentRows(tx, r.getString('firma'), r.id).sort((a,b) => (a.getString('datum') + a.id).localeCompare(b.getString('datum') + b.id));
  let count = 0;
  const cumulative = [];
  payments.forEach(p => {
    cumulative.push(p);
    const before = paymentJournals(tx,p.id).length;
    const written = writePaymentJournal(tx,r,p,payments,cumulative);
    if (!before) count += written.length;
  });
  return count;
}
function paymentCreate(tx, input) {
  const rules = require(__hooks + '/domain/payment-invariants.js');
  const validated = rules.validateZahlungInput(input.values);
  const r = owned(tx,'rechnungen',validated.rechnung,input.firma);
  if (!/^[a-z0-9]{15}$/.test(input.id || '')) fail('INVALID_STATE');
  const existing = recordsFor(tx,'zahlungen','id = {:id}',{id:input.id});
  if (existing.length) {
    const p = existing[0];
    if (p.getString('firma') !== input.firma || Object.keys(validated).some(k => (validated[k] || '') !== p.getString(k))) fail('SOURCE_CHANGED');
    return Object.assign({zahlung:p},syncPaymentStatus(tx,r,input.heute));
  }
  // A deleted payment's journal is a tombstone for its operation ID.
  if (paymentJournals(tx,input.id).length) fail('INVALID_STATE');
  rules.assertRechnungZahlungsfaehig(dto(r));
  const payments = paymentRows(tx,input.firma,r.id);
  rules.assertKeineUeberzahlung(r.getString('betrag_brutto'),payments.map(dto),validated.betrag);
  backfillInvoice(tx,r);
  const p = new Record(tx.findCollectionByNameOrId('zahlungen'));
  p.id = input.id; p.load(Object.assign({firma:input.firma},validated));
  save(tx,p,'zahlung-create');
  writePaymentJournal(tx,r,p,payments.concat([p]));
  return Object.assign({zahlung:p},syncPaymentStatus(tx,r,input.heute));
}
function reverseOrdinary(tx, original, input) {
  if (readRc(original)) fail('INVALID_STATE');
  const existing = journalStornos(tx,original.id);
  if (existing.length) {
    if (existing.length !== 1 || existing[0].getString('firma') !== input.firma) fail('INCONSISTENT_STATE');
    return existing[0];
  }
  const values = require(__hooks + '/domain/journal-invariants.js').buildStornoInput(dto(original),{buchungsdatum:input.buchungsdatum || input.heute,buchungstext:input.buchungstext});
  const j = new Record(tx.findCollectionByNameOrId('buchungsjournal'));
  j.id = $security.randomStringWithAlphabet(15,'abcdefghijklmnopqrstuvwxyz0123456789');
  j.load(Object.assign({},values,{firma:input.firma,laufende_nr:nextJournal(tx,input.firma),festgeschrieben_am:new Date().toISOString()}));
  save(tx,j,'zahlung-storno');
  return j;
}
function paymentDelete(tx,input) {
  const existing = recordsFor(tx,'zahlungen','id = {:id}',{id:input.id});
  if (!existing.length) return {status:null,offen:null};
  const p = owned(tx,'zahlungen',input.id,input.firma);
  const r = owned(tx,'rechnungen',p.getString('rechnung'),input.firma);
  backfillInvoice(tx,r);
  paymentJournals(tx,p.id).forEach(j => reverseOrdinary(tx,j,input));
  recordsFor(tx,'bank_bewegungen','zahlung = {:id}',{id:p.id}).forEach(b => {
    if (b.getString('firma') !== input.firma) fail('INCONSISTENT_STATE');
    b.set('status','offen'); b.set('zahlung',''); b.set('rechnung',''); save(tx,b,'bank-match');
  });
  tx.deleteWithContext(new Context(null,KEY,{operation:'zahlung-delete',firma:input.firma,id:p.id}),p);
  return syncPaymentStatus(tx,r,input.heute);
}
function invoiceCancel(tx,input) {
  const r = owned(tx,'rechnungen',input.id,input.firma);
  if (r.getString('status') === 'entwurf') fail('INVALID_STATE');
  backfillInvoice(tx,r);
  const original = owned(tx,'buchungsjournal',r.getString('journal_eintrag'),input.firma);
  if (original.getString('quelle_typ') !== 'rechnung' || original.getString('quelle_id') !== r.id) fail('INCONSISTENT_STATE');
  const journal = reverseOrdinary(tx,original,input);
  paymentRows(tx,input.firma,r.id).forEach(p => paymentJournals(tx,p.id).forEach(j => reverseOrdinary(tx,j,input)));
  r.set('status','storniert'); save(tx,r,'zahlung-status');
  return {rechnung:r,journal};
}
function bankMatch(tx,input) {
  const b = owned(tx,'bank_bewegungen',input.id,input.firma);
  if (b.getString('richtung') !== 'eingang') fail('INVALID_STATE');
  if (b.getString('status') === 'gematcht') {
    if (b.getString('rechnung') !== input.rechnung) fail('SOURCE_CHANGED');
    const p = owned(tx,'zahlungen',b.getString('zahlung'),input.firma);
    if (input.betrag && !require(__hooks+'/domain/money.js').money(p.getString('betrag')).eq(input.betrag)) fail('SOURCE_CHANGED');
    return {bewegung:b,zahlungId:p.id};
  }
  if (b.getString('status') !== 'offen') fail('INVALID_STATE');
  const amount = input.betrag || b.getString('betrag');
  if (require(__hooks+'/domain/money.js').money(amount).gt(b.getString('betrag'))) fail('INVALID_STATE');
  const result = paymentCreate(tx,{firma:input.firma,id:$security.randomStringWithAlphabet(15,'abcdefghijklmnopqrstuvwxyz0123456789'),heute:input.heute,values:{rechnung:input.rechnung,datum:b.getString('datum'),betrag:amount,zahlungsweg:'ueberweisung',notiz:[input.notiz || '',b.getString('verwendungszweck') ? 'Kontoauszug: '+b.getString('verwendungszweck').slice(0,200) : '', 'Bank-Match '+b.getString('datum')].filter(Boolean).join(' · ').slice(0,2000)}});
  b.set('status','gematcht'); b.set('rechnung',input.rechnung); b.set('zahlung',result.zahlung.id); save(tx,b,'bank-match');
  return {bewegung:b,zahlungId:result.zahlung.id};
}
function recurringCreate(tx,input) {
  const rules = require(__hooks+'/domain/recurring-invariants.js');
  const source = owned(tx,'wiederkehrende_rechnungen',input.id,input.firma);
  const positions = tx.findRecordsByFilter('wiederkehrende_rechnungspositionen','wiederkehrende_rechnung = {:id}','sortierung,id',0,0,{id:input.id});
  if (positions.some(p => p.getString('firma') !== input.firma)) fail('FORBIDDEN');
  if (source.getString('naechstes_datum') !== input.expectedDatum) fail('SOURCE_CHANGED');
  if (input.heute && !rules.isVorlageFaellig(dto(source),input.heute)) return {vorlage:source,positionen:positions};
  const mode = find(tx,'firmen',input.firma).getString('steuermodus');
  const values = require(__hooks+'/domain/sales-invariants.js').validateRechnungInput(rules.mapVorlageToRechnungInput(dto(source),positions.map(dto)),mode);
  const invoiceValues = {};
  invoiceFields.forEach(k => { invoiceValues[k] = k === 'steuermodus' ? mode : (values[k] || ''); });
  const posValues = values.positionen.map(p => { const v={}; positionFields.forEach(k => {v[k]=p[k] == null ? '' : p[k];}); return v; });
  const result = editInvoice(tx,{firma:input.firma,akteur:input.akteur,operation:'create',values:invoiceValues,positionen:posValues});
  if (input.advance !== false) source.set('naechstes_datum',rules.nextNaechstesDatum(source.getString('naechstes_datum'),source.getString('rhythmus'),source.getInt('intervall_tage')));
  source.set('letzte_rechnung',result.rechnung.id); source.set('zuletzt_erzeugt_am',new Date().toISOString()); save(tx,source,'wiederkehrend-advance');
  return {rechnung:Object.assign(dto(result.rechnung),{positionen:result.positionen.map(dto)}),vorlage:source,positionen:positions};
}
function jobLock(tx,input) {
  if (typeof input.key !== 'string' || !input.key || input.key.length>200 || typeof input.holder !== 'string' || !input.holder) fail('INVALID_STATE');
  // Acquire SQLite's writer lock before checking a lease, including the empty-table case.
  tx.db().newQuery('UPDATE job_locks SET key = key WHERE key = {:key}').bind({key:input.key}).execute();
  const rows = recordsFor(tx,'job_locks','key = {:key}',{key:input.key});
  let lock = rows[0]; const now = new Date();
  if (input.operation === 'release') {
    if (lock && lock.getString('holder') === input.holder) {lock.set('expires_at',new Date(0).toISOString());tx.save(lock);}
    return null;
  }
  if (input.operation !== 'acquire' || !Number.isFinite(input.ttlMs) || input.ttlMs<1 || input.ttlMs>3600000) fail('INVALID_STATE');
  if (lock && Date.parse(lock.getString('expires_at')) > now.getTime()) return null;
  if (!lock) {lock=new Record(tx.findCollectionByNameOrId('job_locks'));lock.set('key',input.key);}
  lock.set('holder',input.holder);lock.set('expires_at',new Date(now.getTime()+input.ttlMs).toISOString());tx.save(lock);return lock;
}
exports.releaseRoute = (e,operation) => {
  const input=e.requestInfo().body; let result;
  e.app.runInTransaction(tx=>{
    if (operation==='job-lock') {result=jobLock(tx,input);return;}
    lockFirma(tx,input.firma); auth(tx,input,false);
    if (operation==='recurring') result=recurringCreate(tx,input);
    else if (operation==='payment-create') result=paymentCreate(tx,input);
    else if (operation==='payment-delete') result=paymentDelete(tx,input);
    else if (operation==='invoice-cancel') result=invoiceCancel(tx,input);
    else if (operation==='bank-match') result=bankMatch(tx,input);
    else if (operation==='payment-backfill') result={geschrieben:backfillInvoice(tx,owned(tx,'rechnungen',input.id,input.firma))};
    else if (operation==='payment-status') result=syncPaymentStatus(tx,owned(tx,'rechnungen',input.id,input.firma),input.heute);
    else fail('INVALID_STATE');
  });
  return e.json(200,result);
};
exports.paymentCreateGuard = e => {scope(e,['zahlung-create']);e.next();};
exports.paymentDeleteGuard = e => {scope(e,['zahlung-delete']);e.next();};
exports.paymentUpdateGuard = e => fail('MUTATION_FORBIDDEN');
exports.bankUpdateGuard = e => {
  const c=e.context.value(KEY);
  if(c && c.operation==='bank-match') {scope(e,['bank-match']);return e.next();}
  e.app.runInTransaction(tx=>{
    lockFirma(tx,e.record.getString('firma'));
    const current=find(tx,'bank_bewegungen',e.record.id);
    if (['status','rechnung','zahlung'].some(k=>current.getString(k)!==e.record.original().getString(k)) || current.getString('status')==='gematcht') fail('SOURCE_CHANGED');
    if (e.record.getString('rechnung') || e.record.getString('zahlung') || e.record.getString('status')==='gematcht') fail('MUTATION_FORBIDDEN');
    e.app=tx;e.next();
  });
};
