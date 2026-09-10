// Only the disposable starter mounts this fixture. No corresponding production route.
routerAdd('POST', '/internal/rc-test/{id}/seed', e => {
  const id = e.request.pathValue('id');
  const input = e.requestInfo().body;
  e.app.db().newQuery('UPDATE belege SET rc = {:rc} WHERE id = {:id}').bind({ id, rc: JSON.stringify(input.rc) }).execute();
  return e.json(200, { ok: true });
}, $apis.requireSuperuserAuth());
