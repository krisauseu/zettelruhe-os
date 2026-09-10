// Test-only hooks, copied only into the disposable integration container.
for (const col of ['wiederkehrende_rechnungen','bank_bewegungen','rechnungen']) {
  onRecordUpdate(e => {
    const firma=e.app.findRecordById('firmen',e.record.getString('firma'));
    if(firma.getString('name').startsWith('Release-fail-'+e.record.collection().name)) throw new BadRequestError('INJECT_RELEASE_WRITE');
    e.next();
  },col);
}
onRecordDelete(e => {
  const firma=e.app.findRecordById('firmen',e.record.getString('firma'));
  if(firma.getString('name').startsWith('Release-fail-delete')) throw new BadRequestError('INJECT_RELEASE_DELETE');
  e.next();
},'zahlungen');
onRecordCreate(e => {
  const firma=e.app.findRecordById('firmen',e.record.getString('firma'));
  if(firma.getString('name').startsWith('Release-fail-journal') && e.record.getString('quelle_typ')==='zahlung' && e.record.getString('steuersatz')==='19') throw new BadRequestError('INJECT_RELEASE_STAFFEL');
  e.next();
},'buchungsjournal');
