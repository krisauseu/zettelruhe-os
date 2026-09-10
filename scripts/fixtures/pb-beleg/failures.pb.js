// Only mounted by the disposable test starter. No failure switches in production hooks.
onRecordUpdate(e => {
  e.next();
  if (e.record.getString('name').startsWith('TP022-fail-counter')) throw new BadRequestError('INJECT_AFTER_COUNTER', { injection: new ValidationError('TEST_FAILURE', 'INJECT_AFTER_COUNTER') });
}, 'firmen');
onRecordCreate(e => {
  if (e.record.getString('buchungstext').includes('fail-journal-create')) throw new BadRequestError('INJECT_JOURNAL_CREATE', { injection: new ValidationError('TEST_FAILURE', 'INJECT_JOURNAL_CREATE') });
  e.next();
  if (e.record.getString('buchungstext').includes('fail-after-journal')) throw new BadRequestError('INJECT_AFTER_JOURNAL', { injection: new ValidationError('TEST_FAILURE', 'INJECT_AFTER_JOURNAL') });
}, 'buchungsjournal');
onRecordUpdateExecute(e => {
  if (e.record.getString('status') === 'festgeschrieben' && e.record.getString('notiz') === 'fail-source-save') throw new BadRequestError('INJECT_SOURCE_SAVE', { injection: new ValidationError('TEST_FAILURE', 'INJECT_SOURCE_SAVE') });
  e.next();
}, 'belege');
onRecordCreateExecute(e => {
  if (e.record.getString('bezeichnung').includes('fail-position-create')) throw new BadRequestError('INJECT_POSITION_CREATE', { injection: new ValidationError('TEST_FAILURE', 'INJECT_POSITION_CREATE') });
  e.next();
}, 'rechnungspositionen');
onRecordUpdateExecute(e => {
  if (e.record.getString('status') === 'offen' && e.record.getString('notiz').includes('fail-source-save')) throw new BadRequestError('INJECT_RECHNUNG_SAVE', { injection: new ValidationError('TEST_FAILURE', 'INJECT_RECHNUNG_SAVE') });
  if (e.record.getString('status') === 'offen' && e.record.getString('notiz').includes('fail-pdf-save')) throw new BadRequestError('INJECT_PDF_SAVE', { injection: new ValidationError('TEST_FAILURE', 'INJECT_PDF_SAVE') });
  e.next();
}, 'rechnungen');
onRecordDeleteExecute(e => {
  if (e.record.getString('notiz').includes('fail-delete')) throw new BadRequestError('INJECT_RECHNUNG_DELETE', { injection: new ValidationError('TEST_FAILURE', 'INJECT_RECHNUNG_DELETE') });
  e.next();
}, 'rechnungen');
onRecordCreate(e => {
  if (e.record.getString('text').includes('fail-cash-create')) throw new BadRequestError('INJECT_KASSE_CREATE', { injection: new ValidationError('TEST_FAILURE', 'INJECT_KASSE_CREATE') });
  e.next();
  if (e.record.getString('text').includes('fail-cash-after-create')) throw new BadRequestError('INJECT_AFTER_KASSE_CREATE', { injection: new ValidationError('TEST_FAILURE', 'INJECT_AFTER_KASSE_CREATE') });
}, 'kassenbuch_eintraege');
onRecordUpdateExecute(e => {
  if (e.record.getString('journal_eintrag') && e.record.getString('text').includes('fail-cash-link')) throw new BadRequestError('INJECT_KASSE_LINK', { injection: new ValidationError('TEST_FAILURE', 'INJECT_KASSE_LINK') });
  e.next();
}, 'kassenbuch_eintraege');
routerAdd('POST', '/internal/tp022/legacy/{id}/{mode}', e => {
  const id = e.request.pathValue('id');
  const mode = e.request.pathValue('mode');
  e.app.runInTransaction(tx => {
    const b = tx.findRecordById('belege', id);
    if (mode === 'number-only' || mode === 'occupied-number') {
      tx.db().newQuery('UPDATE belege SET belegnummer = {:number} WHERE id = {:id}').bind({ id, number: mode === 'occupied-number' ? 'B-0001' : 'B-ALT' }).execute();
      return;
    }
    const j = new Record(tx.findCollectionByNameOrId('buchungsjournal'));
    j.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
    j.load({ firma: b.getString('firma'), laufende_nr: mode === 'duplicate' ? 2 : 1, quelle_typ: 'beleg', quelle_id: id, buchungsdatum: b.getString('belegdatum'), belegdatum: b.getString('belegdatum'), buchungstext: 'Legacy orphan', richtung: b.getString('richtung'), betrag_netto: '100.00', betrag_ust: '0.00', betrag_brutto: '100.00', steuersatz: '0', festgeschrieben_am: '2026-09-05T12:00:00.000Z' });
    tx.saveWithContext(new Context(null, 'zettelruhe.finanz.v1', { operation: 'beleg-journal', id: j.id, firma: b.getString('firma') }), j);
    if (mode === 'linked') tx.db().newQuery('UPDATE belege SET journal_eintrag = {:journal} WHERE id = {:id}').bind({ id, journal: j.id }).execute();
  });
  return e.json(200, { ok: true });
}, $apis.requireSuperuserAuth());
routerAdd('GET', '/internal/tp022/audit', e => {
  const rows = arrayOf(new DynamicModel({ firma: '', quelle_typ: '', quelle_id: '', anzahl: 0 }));
  e.app.db().newQuery('SELECT firma, quelle_typ, quelle_id, count(*) AS anzahl FROM buchungsjournal WHERE quelle_typ = "beleg" AND quelle_id != "" AND storno_von = "" GROUP BY firma, quelle_typ, quelle_id HAVING count(*) > 1').all(rows);
  return e.json(200, rows);
}, $apis.requireSuperuserAuth());
routerAdd('POST', '/internal/tp022/rechnung/{id}/tamper/{mode}', e => {
  const id = e.request.pathValue('id');
  const mode = e.request.pathValue('mode');
  if (mode === 'head') e.app.db().newQuery('UPDATE rechnungen SET notiz = notiz || " changed" WHERE id = {:id}').bind({ id }).execute();
  else if (mode === 'position') e.app.db().newQuery('UPDATE rechnungspositionen SET bezeichnung = bezeichnung || " changed" WHERE rechnung = {:id}').bind({ id }).execute();
  else if (mode === 'position-delete') e.app.db().newQuery('DELETE FROM rechnungspositionen WHERE id = (SELECT id FROM rechnungspositionen WHERE rechnung = {:id} ORDER BY sortierung,id LIMIT 1)').bind({ id }).execute();
  else if (mode === 'position-add') {
    e.app.runInTransaction(tx => {
      const r = tx.findRecordById('rechnungen', id);
      const source = tx.findFirstRecordByFilter('rechnungspositionen', 'rechnung = {:id}', { id });
      const p = new Record(tx.findCollectionByNameOrId('rechnungspositionen'));
      p.id = $security.randomStringWithAlphabet(15, 'abcdefghijklmnopqrstuvwxyz0123456789');
      p.set('firma', r.getString('firma'));
      p.set('rechnung', id);
      ['sortierung', 'bezeichnung', 'menge', 'einheit', 'einzelpreis', 'steuersatz', 'betrag_netto', 'betrag_ust', 'betrag_brutto', 'katalog_position'].forEach(k => p.set(k, source.get(k)));
      p.set('sortierung', source.getInt('sortierung') + 1);
      tx.saveWithContext(new Context(null, 'zettelruhe.finanz.v1', { operation: 'rechnung-position', id: p.id, firma: r.getString('firma') }), p);
    });
  }
  else if (mode === 'position-sort') e.app.db().newQuery('UPDATE rechnungspositionen SET sortierung = sortierung + 10 WHERE rechnung = {:id}').bind({ id }).execute();
  else if (mode === 'position-sum') e.app.db().newQuery('UPDATE rechnungspositionen SET betrag_brutto = "1.00" WHERE rechnung = {:id}').bind({ id }).execute();
  else if (mode === 'head-sum') e.app.db().newQuery('UPDATE rechnungen SET betrag_brutto = "1.00" WHERE id = {:id}').bind({ id }).execute();
  else if (mode === 'position-firma') {
    const r = e.app.findRecordById('rechnungen', id);
    const other = e.app.findFirstRecordByFilter('firmen', 'id != {:firma}', { firma: r.getString('firma') });
    e.app.db().newQuery('UPDATE rechnungspositionen SET firma = {:firma} WHERE rechnung = {:id}').bind({ id, firma: other.id }).execute();
  }
  else if (mode === 'position-rechnung') {
    const r = e.app.findRecordById('rechnungen', id);
    const other = e.app.findFirstRecordByFilter('rechnungen', 'firma = {:firma} && id != {:id}', { firma: r.getString('firma'), id });
    e.app.db().newQuery('UPDATE rechnungspositionen SET rechnung = {:rechnung} WHERE rechnung = {:id}').bind({ id, rechnung: other.id }).execute();
  }
  else if (mode === 'number-only') e.app.db().newQuery('UPDATE rechnungen SET rechnungsnummer = "R-ALT" WHERE id = {:id}').bind({ id }).execute();
  else if (mode === 'counter-back') {
    const r = e.app.findRecordById('rechnungen', id);
    const f = e.app.findRecordById('firmen', r.getString('firma'));
    const counters = JSON.parse(f.getString('nummernkreise'));
    counters.rechnung.next = 1;
    e.app.db().newQuery('UPDATE firmen SET nummernkreise = {:nummernkreise} WHERE id = {:id}').bind({ id: f.id, nummernkreise: JSON.stringify(counters) }).execute();
  }
  else if (mode === 'journal-amount') {
    const r = e.app.findRecordById('rechnungen', id);
    e.app.db().newQuery('UPDATE buchungsjournal SET betrag_brutto = "1.00" WHERE id = {:id}').bind({ id: r.getString('journal_eintrag') }).execute();
  }
  else if (mode === 'logo') {
    const r = e.app.findRecordById('rechnungen', id);
    e.app.db().newQuery('UPDATE firmen SET logo = "missing_logo.png" WHERE id = {:id}').bind({ id: r.getString('firma') }).execute();
  } else throw new BadRequestError('UNKNOWN_MODE');
  return e.json(200, { ok: true });
}, $apis.requireSuperuserAuth());
routerAdd('POST', '/internal/tp022/kasse/{id}/tamper/{mode}', e => {
  const id = e.request.pathValue('id');
  const mode = e.request.pathValue('mode');
  const record = e.app.findRecordById('kassenbuch_eintraege', id);
  if (mode === 'counter-back') {
    const firma = e.app.findRecordById('firmen', record.getString('firma'));
    const counters = JSON.parse(firma.getString('nummernkreise'));
    counters.kasse.next = 1;
    e.app.db().newQuery('UPDATE firmen SET nummernkreise = {:nummernkreise} WHERE id = {:id}').bind({ id: firma.id, nummernkreise: JSON.stringify(counters) }).execute();
  } else if (mode === 'fail-storno-counter') {
    e.app.db().newQuery('UPDATE firmen SET name = "TP022-fail-counter-kasse-storno" WHERE id = {:id}').bind({ id: record.getString('firma') }).execute();
  } else if (mode === 'source-text') {
    e.app.db().newQuery('UPDATE kassenbuch_eintraege SET text = text || " changed" WHERE id = {:id}').bind({ id }).execute();
  } else if (mode === 'journal-link') {
    const other = e.app.findFirstRecordByFilter('buchungsjournal', 'firma != {:firma}', { firma: record.getString('firma') });
    e.app.db().newQuery('UPDATE kassenbuch_eintraege SET journal_eintrag = {:journal} WHERE id = {:id}').bind({ id, journal: other.id }).execute();
  } else throw new BadRequestError('UNKNOWN_MODE');
  return e.json(200, { ok: true });
}, $apis.requireSuperuserAuth());
