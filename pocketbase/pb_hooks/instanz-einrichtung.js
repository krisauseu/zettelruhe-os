// Generic, optional instance setup. Absence of the singleton is the normal
// self-hosted and historic-instance state; never derive it from a user's name.
const ID = 'initialsetup001';
const KEY = 'zettelruhe.einrichtung.v1';
const textFields = {
  name: 200, strasse: 200, plz: 20, ort: 120, land: 2,
  steuernummer: 64, ust_id: 32, email: 200, telefon: 40, webseite: 200,
  dokument_akzentfarbe: 7, dokument_kopftext: 500, dokument_fusstext: 1000,
};
const boolFields = ['dokument_header_drucken', 'dokument_fuss_drucken', 'dokument_zahlblock', 'logo_entfernen'];
const allowedValues = Object.keys(textFields).concat(boolFields, ['steuermodus', 'skr']);
function fail(code) { throw new BadRequestError(code, { einrichtung: new ValidationError(code, code) }); }
function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function find(tx, collection, id) {
  const rows = tx.findRecordsByFilter(collection, 'id = {:id}', '', 1, 0, { id });
  if (!rows.length) fail('SETUP_NOT_FOUND');
  return rows[0];
}
function owner(tx, akteur, firma) {
  const user = find(tx, 'users', akteur);
  const memberships = tx.findRecordsByFilter('mitgliedschaften', 'user = {:user} && firma = {:firma}', '', 1, 0, { user: akteur, firma });
  if (user.getString('role') !== 'eigentuemer' || !memberships.length || memberships[0].getString('rolle') !== 'eigentuemer') fail('SETUP_FORBIDDEN');
  return user;
}
function validate(input, firma) {
  if (!object(input.values) || Object.keys(input.values).some(k => allowedValues.indexOf(k) < 0)) fail('SETUP_INVALID');
  const values = input.values;
  Object.keys(textFields).forEach(k => {
    if (values[k] !== undefined && (typeof values[k] !== 'string' || values[k].length > textFields[k])) fail('SETUP_INVALID');
  });
  boolFields.forEach(k => { if (values[k] !== undefined && typeof values[k] !== 'boolean') fail('SETUP_INVALID'); });
  ['name', 'strasse', 'plz', 'ort', 'land'].forEach(k => { if (typeof values[k] !== 'string' || !values[k].trim()) fail('SETUP_REQUIRED'); });
  if (!/^[a-zA-Z]{2}$/.test(values.land.trim())) fail('SETUP_INVALID');
  if (typeof input.ownerName !== 'string' || !input.ownerName.trim() || input.ownerName.length > 200) fail('SETUP_REQUIRED');
  if (['kleinunternehmer', 'regelbesteuerung_ist'].indexOf(values.steuermodus) < 0) fail('SETUP_INVALID');
  if (values.skr !== undefined && values.skr !== firma.getString('skr')) fail('SETUP_INVALID');
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) fail('SETUP_INVALID');
  if (values.dokument_akzentfarbe && !/^#[0-9a-fA-F]{6}$/.test(values.dokument_akzentfarbe)) fail('SETUP_INVALID');
  if (!object(input.nummernkreisAenderungen)) fail('SETUP_INVALID');
}
function receipt(marker, result) {
  return { result, firmaId: marker.getString('firma'), eigentuemerId: marker.getString('eigentuemer'), status: marker.getString('status') };
}
function complete(tx, input, uploads) {
  if (!object(input) || Object.keys(input).some(k => ['akteur', 'firma', 'ownerName', 'values', 'nummernkreisAenderungen'].indexOf(k) < 0)) fail('SETUP_INVALID');
  if (typeof input.akteur !== 'string' || typeof input.firma !== 'string') fail('SETUP_INVALID');
  const marker = find(tx, 'instanz_einrichtung', ID);
  if (marker.getString('firma') !== input.firma || marker.getString('eigentuemer') !== input.akteur) fail('SETUP_FORBIDDEN');
  const firma = find(tx, 'firmen', input.firma);
  const user = owner(tx, input.akteur, input.firma);
  if (marker.getString('status') === 'complete') return receipt(marker, 'replayed');
  if (marker.getString('status') !== 'pending') fail('SETUP_INVALID');
  validate(input, firma);
  Object.keys(input.values).forEach(k => {
    if (k === 'skr' || k === 'logo_entfernen') return;
    const value = input.values[k];
    firma.set(k, typeof value === 'string' ? value.trim() : value);
  });
  if (input.values.ust_id !== undefined) firma.set('ust_id', input.values.ust_id.replace(/[\s.\-/]/g, '').toUpperCase());
  firma.set('land', input.values.land.trim().toUpperCase());
  if (uploads.length) firma.set('logo', uploads);
  else if (input.values.logo_entfernen) firma.set('logo', '');
  // Reuse the existing concurrency/counter guard and contextual company save.
  require(__hooks + '/finanz.js').configureNummernkreise(tx, firma, input.nummernkreisAenderungen);
  user.set('name', input.ownerName.trim());
  tx.save(user);
  marker.set('status', 'complete');
  tx.saveWithContext(new Context(null, KEY, { id: marker.id }), marker);
  return receipt(marker, 'committed');
}
exports.route = e => {
  const body = e.requestInfo().body;
  let input;
  try { input = JSON.parse(body.payload); } catch (_) { fail('SETUP_INVALID'); }
  let uploads = [];
  if (e.request.multipartForm && e.request.multipartForm.file && e.request.multipartForm.file.logo && e.request.multipartForm.file.logo.length) uploads = e.findUploadedFiles('logo');
  if (uploads.length > 1) fail('SETUP_INVALID');
  let result;
  e.app.runInTransaction(tx => { result = complete(tx, input, uploads); });
  return e.json(200, result);
};
exports.markerCreate = e => {
  if (e.record.id !== ID || e.record.getString('status') !== 'pending') fail('SETUP_INVALID');
  owner(e.app, e.record.getString('eigentuemer'), e.record.getString('firma'));
  e.next();
};
exports.markerUpdate = e => {
  const context = e.context.value(KEY);
  const old = e.record.original();
  if (!e.app.isTransactional() || !context || context.id !== ID || e.record.id !== ID || old.getString('status') !== 'pending' || e.record.getString('status') !== 'complete' || old.getString('firma') !== e.record.getString('firma') || old.getString('eigentuemer') !== e.record.getString('eigentuemer')) fail('SETUP_FORBIDDEN');
  e.next();
};
exports.markerDelete = () => { fail('SETUP_FORBIDDEN'); };
