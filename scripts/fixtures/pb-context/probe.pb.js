// Test-only prerequisite probe. Never copied to the production image.
routerAdd('POST', '/internal/tp022/probe/{id}/{mode}', (e) => {
  const mode = e.request.pathValue('mode');
  const id = e.request.pathValue('id');
  let result;
  e.app.runInTransaction((tx) => {
    const record = tx.findRecordById('belege', id);
    const ctx = new Context(null, 'tp022.operation', { operation: mode, firma: record.getString('firma'), id: record.id });
    if (mode === 'delete') tx.deleteWithContext(ctx, record);
    else {
      record.set('notiz', mode);
      if (mode === 'no-context') tx.save(record);
      else if (mode === 'no-validate') tx.saveNoValidateWithContext(ctx, record);
      else tx.saveWithContext(ctx, record);
    }
    result = { ok: true };
    if (mode === 'rollback') throw new Error('EXPECTED_ROLLBACK');
  });
  return e.json(200, result);
}, $apis.requireSuperuserAuth());

onRecordUpdate((e) => {
  const c = e.context.value('tp022.operation');
  if (!e.app.isTransactional() || !c || c.id !== e.record.id || c.firma !== e.record.getString('firma')) {
    throw new Error('EXPECTED_CONTEXT_GUARD');
  }
  e.next();
}, 'belege');
onRecordDelete((e) => {
  const c = e.context.value('tp022.operation');
  if (!e.app.isTransactional() || !c || c.operation !== 'delete' || c.id !== e.record.id || c.firma !== e.record.getString('firma')) {
    throw new Error('EXPECTED_DELETE_GUARD');
  }
  e.next();
}, 'belege');
