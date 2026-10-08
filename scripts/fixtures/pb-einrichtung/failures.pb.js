// This hook is mounted exclusively by the disposable synthetic setup test.
onRecordUpdateExecute(e => {
  e.next();
  if (e.record.getString('dokument_kopftext') === 'setup-fail-firma') throw new BadRequestError('INJECT_FIRMA');
}, 'firmen');
onRecordUpdateExecute(e => {
  e.next();
  if (e.record.getString('name') === 'setup-fail-user') throw new BadRequestError('INJECT_USER');
}, 'users');
onRecordUpdateExecute(e => {
  e.next();
  const user = e.app.findRecordById('users', e.record.getString('eigentuemer'));
  if (user.getString('name') === 'setup-fail-marker') throw new BadRequestError('INJECT_MARKER');
}, 'instanz_einrichtung');
