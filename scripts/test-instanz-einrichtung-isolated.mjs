#!/usr/bin/env node
// Production migrations/hooks, real PB 0.39.10, disposable tmpfs and synthetic
// fixtures only. Does not read .env, existing volumes, registers or credentials.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const image = process.env.EINRICHTUNG_PB_IMAGE || 'zettelruhe-pocketbase:latest';
const hooks = mkdtempSync(join(tmpdir(), 'zettelruhe-einrichtung-hooks-'));
cpSync(`${root}pocketbase/pb_hooks`, hooks, { recursive: true });
cpSync(`${root}scripts/fixtures/pb-einrichtung/failures.pb.js`, join(hooks, 'zz-setup-test-failures.pb.js'));
const containers = [];
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const markerId = 'initialsetup001';
const ownerId = 'setupowner00001';
const firmaId = 'setupfirma00001';
const endpoint = '/internal/zettelruhe/einrichtung/v1/abschliessen';
let groups = 0;
function pass(label) { groups += 1; console.log(`PASS ${label}`); }
async function start(label) {
  const name = `zettelruhe-einrichtung-${label}-${randomUUID()}`;
  docker('run', '-d', '--name', name, '--read-only', '--tmpfs', '/pb_data', '--tmpfs', '/tmp',
    '-p', '127.0.0.1::8090', '-v', `${hooks}:/test_hooks:ro`, '-v', `${root}pocketbase/pb_migrations:/test_migrations:ro`,
    '--entrypoint', '/pb/pocketbase', image, 'serve', '--dir=/pb_data', '--migrationsDir=/test_migrations', '--hooksDir=/test_hooks', '--http=0.0.0.0:8090');
  containers.push(name);
  const address = docker('port', name, '8090/tcp');
  assert.match(address, /^127\.0\.0\.1:\d+$/);
  const url = `http://${address}`;
  let ready = false;
  for (let i = 0; i < 100; i += 1) {
    try { ready = (await fetch(`${url}/api/health`)).ok; } catch { /* startup */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'isolated PocketBase did not start');
  const email = `${label}@synthetic.invalid`;
  const password = randomUUID();
  docker('exec', name, '/pb/pocketbase', 'superuser', 'upsert', email, password, '--dir=/pb_data', '--migrationsDir=/test_migrations');
  const auth = await fetch(`${url}/api/collections/_superusers/auth-with-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: email, password }) });
  assert.equal(auth.status, 200);
  const { token } = await auth.json();
  const call = async (method, path, body, asToken = token) => {
    const response = await fetch(url + path, { method, headers: { ...(asToken ? { Authorization: asToken } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    return { status: response.status, body: await response.json() };
  };
  const path = col => `/api/collections/${col}/records`;
  const create = async (col, body) => { const r = await call('POST', path(col), body); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  const read = async (col, id) => { const r = await call('GET', `${path(col)}/${id}`); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  const list = async col => { const r = await call('GET', `${path(col)}?perPage=100`); assert.equal(r.status, 200); return r.body; };
  const patch = async (col, id, values) => { const r = await call('PATCH', `${path(col)}/${id}`, values); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body; };
  const finish = (input, logo, asToken) => {
    const form = new FormData(); form.set('payload', JSON.stringify(input));
    if (logo) form.set('logo', new Blob([logo], { type: 'image/png' }), 'synthetic.png');
    return call('POST', endpoint, form, asToken);
  };
  return { call, path, create, read, list, patch, finish };
}
async function seed(pb, label) {
  assert.equal((await pb.list('instanz_einrichtung')).totalItems, 0);
  assert.equal((await pb.list('firmen')).totalItems, 0);
  assert.equal((await pb.list('users')).totalItems, 0);
  const firma = await pb.create('firmen', { id: firmaId, name: `Synthetic setup ${label}`, steuermodus: 'kleinunternehmer', skr: 'skr03', nummernkreise: { rechnung: { prefix: 'R-', digits: 4, next: 1 } } });
  const user = await pb.create('users', { id: ownerId, name: 'Einrichtung ausstehend', email: `owner-${label}@synthetic.invalid`, password: 'Synthetic-Setup-2026!', passwordConfirm: 'Synthetic-Setup-2026!', verified: true, role: 'eigentuemer', firma: firma.id });
  const membership = await pb.create('mitgliedschaften', { user: user.id, firma: firma.id, rolle: 'eigentuemer' });
  return { firma, user, membership };
}
function input(label) {
  return { akteur: ownerId, firma: firmaId, ownerName: `Echte Person ${label}`, values: { name: `Firma ${label}`, strasse: 'Testweg 1', plz: '12345', ort: 'Teststadt', land: 'DE', email: 'kontakt@synthetic.invalid', steuermodus: 'regelbesteuerung_ist', skr: 'skr03', dokument_kopftext: 'Testkopf' }, nummernkreisAenderungen: { rechnung: { expected: { prefix: 'R-', digits: 4, next: 1 }, value: { prefix: 'TEST-', digits: 5, next: 7 } } } };
}
async function pending(pb) { await pb.create('instanz_einrichtung', { id: markerId, eigentuemer: ownerId, firma: firmaId, status: 'pending' }); }
async function snapshot(pb) { return { firma: await pb.read('firmen', firmaId), user: await pb.read('users', ownerId), marker: await pb.read('instanz_einrichtung', markerId), memberships: await pb.list('mitgliedschaften'), users: await pb.list('users') }; }
try {
  assert.equal(docker('run', '--rm', '--network', 'none', '--entrypoint', '/pb/pocketbase', image, '--version'), 'pocketbase version 0.39.10');
  const a = await start('a');
  const seeded = await seed(a, 'A');
  assert.equal((await a.finish(input('A'))).status, 400);
  const historical = await a.read('users', ownerId);
  assert.equal(historical.name, seeded.user.name);
  assert.equal((await a.list('instanz_einrichtung')).totalItems, 0);
  const configured = await a.call('POST', '/internal/zettelruhe/finanz/v1/nummernkreis/konfigurieren', {
    firma: firmaId, akteur: ownerId,
    changes: { rechnung: { expected: { prefix: 'R-', digits: 4, next: 1 }, value: { prefix: 'R-', digits: 4, next: 1 } } },
  });
  assert.equal(configured.status, 200, JSON.stringify(configured.body));
  pass('empty optional state preserves self-hosting and historic users');
  const wrongId = await a.call('POST', a.path('instanz_einrichtung'), { id: 'wrongsetup00001', eigentuemer: ownerId, firma: firmaId, status: 'pending' });
  assert.equal(wrongId.status, 400);
  await pending(a);
  const original = await snapshot(a);
  for (const stage of ['firma', 'user', 'marker']) {
    const candidate = input('A');
    if (stage === 'firma') candidate.values.dokument_kopftext = 'setup-fail-firma';
    else candidate.ownerName = `setup-fail-${stage}`;
    const result = await a.finish(candidate);
    assert.equal(result.status, 400, `injected ${stage} failure: ${JSON.stringify(result.body)}`);
    assert.deepEqual(await snapshot(a), original, `${stage} rollback includes company, counters, user and marker`);
  }
  pass('database rollback after company, existing user and marker writes; resumable pending state');
  for (const mutate of [
    v => { v.ownerName = ''; },
    v => { v.ownerName = 'x'.repeat(201); },
    v => { v.values.strasse = ''; },
    v => { v.values.land = 'DEU'; },
    v => { v.values.email = 'bad@email'; },
    v => { v.values.steuermodus = 'unknown'; },
    v => { v.values.skr = 'skr04'; },
    v => { v.values.id = 'otherfirma00001'; },
    v => { v.values.role = 'eigentuemer'; },
    v => { v.nummernkreisAenderungen.rechnung.expected.next = 0; },
  ]) {
    const candidate = input('A'); mutate(candidate);
    assert.equal((await a.finish(candidate)).status, 400);
    assert.deepEqual(await snapshot(a), original);
  }
  pass('required data, immutable SKR/identity allowlist and stale number counters');
  const otherFirma = await a.create('firmen', { name: 'Synthetic foreign company', steuermodus: 'kleinunternehmer', skr: 'skr03', nummernkreise: { rechnung: { prefix: 'R-', digits: 4, next: 1 } } });
  const otherUser = await a.create('users', { name: 'Synthetic other owner', email: 'other@synthetic.invalid', password: 'Synthetic-Setup-2026!', passwordConfirm: 'Synthetic-Setup-2026!', verified: true, role: 'eigentuemer', firma: firmaId });
  await a.create('mitgliedschaften', { user: otherUser.id, firma: firmaId, rolle: 'eigentuemer' });
  await a.create('mitgliedschaften', { user: ownerId, firma: otherFirma.id, rolle: 'eigentuemer' });
  assert.equal((await a.finish({ ...input('A'), akteur: otherUser.id })).status, 400);
  assert.equal((await a.finish({ ...input('A'), firma: otherFirma.id })).status, 400);
  await a.patch('mitgliedschaften', seeded.membership.id, { rolle: 'lesen' });
  assert.equal((await a.finish(input('A'))).status, 400);
  await a.patch('mitgliedschaften', seeded.membership.id, { rolle: 'eigentuemer' });
  await a.patch('users', ownerId, { role: 'nutzer' });
  assert.equal((await a.finish(input('A'))).status, 400);
  await a.patch('users', ownerId, { role: 'eigentuemer' });
  pass('exact marker owner/company and both existing owner permissions');
  const auth = await a.call('POST', '/api/collections/users/auth-with-password', { identity: seeded.user.email, password: 'Synthetic-Setup-2026!' }, '');
  assert.equal(auth.status, 200);
  const ordinary = auth.body.token;
  assert.equal((await a.finish(input('A'), undefined, ordinary)).status, 403);
  assert.equal((await a.finish(input('A'), undefined, '')).status, 401);
  for (const [method, path, body] of [
    ['GET', a.path('instanz_einrichtung')],
    ['GET', `${a.path('instanz_einrichtung')}/${markerId}`],
    ['POST', a.path('instanz_einrichtung'), { id: 'othermarker0001' }],
    ['PATCH', `${a.path('instanz_einrichtung')}/${markerId}`, { status: 'complete' }],
    ['DELETE', `${a.path('instanz_einrichtung')}/${markerId}`],
    ['PATCH', `${a.path('firmen')}/${firmaId}`, { name: 'direct write' }],
    ['PATCH', `${a.path('users')}/${ownerId}`, { name: 'direct write' }],
  ]) assert.ok((await a.call(method, path, body, ordinary)).status >= 400);
  assert.equal((await a.call('PATCH', `${a.path('instanz_einrichtung')}/${markerId}`, { status: 'complete' })).status, 400);
  assert.equal((await a.call('DELETE', `${a.path('instanz_einrichtung')}/${markerId}`)).status, 400);
  pass('ordinary API and internal-route authorization cannot bypass completion');
  const b = await start('b');
  const seededB = await seed(b, 'B'); await pending(b);
  const beforeB = await snapshot(b);
  const beforeCommit = await snapshot(a);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==', 'base64');
  const result = await a.finish(input('A'), png);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.deepEqual(result.body, { result: 'committed', firmaId, eigentuemerId: ownerId, status: 'complete' });
  const after = await snapshot(a);
  assert.equal(after.firma.name, 'Firma A');
  assert.equal(after.firma.strasse, 'Testweg 1');
  assert.equal(after.firma.steuermodus, 'regelbesteuerung_ist');
  assert.ok(after.firma.logo.endsWith('.png'));
  assert.deepEqual(after.firma.nummernkreise.rechnung, { prefix: 'TEST-', digits: 5, next: 7 });
  assert.equal(after.user.name, 'Echte Person A');
  for (const key of ['id', 'email', 'role', 'firma', 'verified']) assert.equal(after.user[key], beforeCommit.user[key]);
  assert.deepEqual(after.memberships, beforeCommit.memberships);
  assert.equal(after.users.totalItems, beforeCommit.users.totalItems);
  assert.equal(after.marker.status, 'complete');
  assert.deepEqual(await snapshot(b), beforeB);
  pass('atomic completion changes only existing owner name; separate PB tenant with same IDs remains pending');
  const replay = await a.finish({ ...input('A'), ownerName: 'Must never overwrite' }, png);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.result, 'replayed');
  assert.deepEqual(await snapshot(a), after);
  assert.equal((await a.finish({ ...input('A'), akteur: otherUser.id })).status, 400);
  await a.patch('users', ownerId, { name: 'Später geänderter Name' });
  assert.equal((await a.read('users', ownerId)).name, 'Später geänderter Name');
  assert.equal((await a.read('instanz_einrichtung', markerId)).status, 'complete');
  pass('response-loss replay performs no writes; existing user management can change name later');
  const invalidLogo = await b.finish(input('B'), Buffer.from('invalid png'));
  assert.equal(invalidLogo.status, 400);
  assert.deepEqual(await snapshot(b), beforeB);
  const parallelB = await Promise.all([0, 1].map(() => b.finish({ ...input('B'), values: { ...input('B').values, logo_entfernen: true } })));
  parallelB.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.body)));
  assert.deepEqual(parallelB.map(result => result.body.result).sort(), ['committed', 'replayed']);
  assert.equal((await b.read('users', ownerId)).email, seededB.user.email);
  assert.equal((await b.read('firmen', firmaId)).logo, '');
  pass('invalid file keeps setup resumable; concurrent completion commits once and optional logo removal uses existing field');
  console.log(`PASS ${groups} isolated PocketBase setup test groups (0.39.10)`);
} catch (error) {
  console.error(error instanceof Error ? error.message.split('\n')[0].replace(/upsert .*/, 'upsert <redacted>') : 'Isolated setup test failed');
  process.exitCode = 1;
} finally {
  for (const name of containers.reverse()) docker('rm', '-f', name);
  rmSync(hooks, { recursive: true, force: true });
}
