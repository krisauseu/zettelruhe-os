/** Local production-Next regression. No .env, real PB, cloud service or persistent data.
 * Prerequisite: cd app && npm run build -- --webpack
 * Run from repository root: node scripts/test-instance-redirect-local.mjs
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SignJWT } from '../app/node_modules/jose/dist/webapi/index.js';

const root = resolve(import.meta.dirname, '..');
if (process.argv.includes('--runtime')) {
  const { default: next } = await import('../app/node_modules/next/dist/server/next.js');
  const app = next({ dev: false, dir: resolve(root, 'app'), hostname: '127.0.0.1', port: Number(process.env.PORT) });
  await app.prepare();
  // Test-only internal origin, set after Next initializes its production server.
  process.env.__NEXT_PRIVATE_ORIGIN = process.env.REDIRECT_TEST_INTERNAL_ORIGIN;
  const server = http.createServer(app.getRequestHandler());
  server.listen(Number(process.env.PORT), '127.0.0.1');
  process.on('SIGTERM', () => { server.closeAllConnections(); server.close(() => process.exit(0)); });
} else {
const ingress = 'synthetic-local-ingress-'.repeat(2);
const controlToken = 'synthetic-local-control-'.repeat(2);
const key = 'synthetic-local-session-'.repeat(2);
const user = { userId: 'user1', email: 'owner@synthetic.invalid', name: 'Test', role: 'eigentuemer', firmaId: 'firma1' };
const nummernkreise = Object.fromEntries(Object.entries({ angebot: 'A-', rechnung: 'R-', gutschrift: 'G-', beleg: 'B-', kasse: 'K-', kontakt: 'KT-' }).map(([name, prefix]) => [name, { prefix, digits: 4, next: 1 }]));
let firma = { id: 'firma1', name: 'Vorher', steuermodus: 'kleinunternehmer', skr: 'skr03', nummernkreise };
let rechnung = { id: 'rechnung1', firma: 'firma1', kunde: '', status: 'entwurf', steuermodus: 'kleinunternehmer', rechnungsdatum: '2026-10-02', notiz: 'Vorher', betrag_netto: '10', betrag_ust: '0', betrag_brutto: '10' };
let positionen = [{ id: 'position1', firma: 'firma1', rechnung: 'rechnung1', sortierung: 0, bezeichnung: 'Test', menge: '1', einheit: 'Std.', einzelpreis: '10', betrag_netto: '10', betrag_ust: '0', betrag_brutto: '10' }];
let firmaWrites = 0, rechnungWrites = 0;
const resolvedHosts = [];
const unexpected = [];
let context;
function json(res, value, status = 200) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }
function list(items) { return { items, page: 1, perPage: 200, totalItems: items.length, totalPages: 1 }; }
const fixture = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://fixture.invalid');
    if (url.pathname === '/v1/resolve') {
      assert.equal(req.headers.authorization, `Bearer ${controlToken}`);
      const host = url.searchParams.get('hostname'); resolvedHosts.push(host);
      return json(res, context, host === 'tenant.synthetic.invalid' ? 200 : 404);
    }
    if (url.pathname.endsWith('/auth-with-password')) return json(res, { token: 'synthetic-admin' });
    assert.equal(req.headers.authorization, 'synthetic-admin');
    if (url.pathname === '/api/collections/instanz_einrichtung/records') return json(res, list([]));
    if (url.pathname === '/api/collections/users/records/user1') return json(res, user);
    if (url.pathname === '/api/collections/mitgliedschaften/records') return json(res, list([{ id: 'membership1', user: 'user1', firma: 'firma1', rolle: 'eigentuemer' }]));
    if (url.pathname === '/api/collections/firmen/records/firma1') {
      if (req.method === 'PATCH') {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        firma = { ...firma, ...JSON.parse(Buffer.concat(chunks).toString()) }; firmaWrites++;
      }
      return json(res, firma);
    }
    if (url.pathname === '/api/collections/rechnungen/records/rechnung1') return json(res, rechnung);
    if (url.pathname === '/api/collections/rechnungspositionen/records') return json(res, list(positionen));
    if (url.pathname === '/internal/zettelruhe/finanz/v1/rechnung/entwurf') {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const data = JSON.parse(Buffer.concat(chunks).toString());
      assert.equal(data.firma, 'firma1'); assert.equal(data.akteur, 'user1'); assert.equal(data.operation, 'update');
      rechnung = { ...rechnung, ...data.values }; positionen = data.positionen.map((p, i) => ({ ...p, id: `position${i + 1}`, firma: 'firma1', rechnung: 'rechnung1' })); rechnungWrites++;
      return json(res, { rechnung, positionen });
    }
    if (url.pathname === '/internal/zettelruhe/finanz/v1/zahlung/status') return json(res, { status: 'entwurf' });
    if (['zahlungen', 'kontakte', 'katalog_positionen'].some(c => url.pathname === `/api/collections/${c}/records`)) return json(res, list([]));
    unexpected.push(url.pathname); json(res, { message: 'Unexpected fixture request' }, 500);
  } catch (error) { unexpected.push(error.message); json(res, {}, 500); }
});
await new Promise(r => fixture.listen(0, '127.0.0.1', r));
const fixtureUrl = `http://127.0.0.1:${fixture.address().port}`;
context = { tenantId: 't_syntheticlocal', pocketbaseUrl: fixtureUrl, appUrl: 'https://tenant.synthetic.invalid', configVersion: 1, sessionVersion: 1, sessionSecret: key, adminEmail: 'admin@synthetic.invalid', adminPassword: 'synthetic', smtp: null };
const portProbe = http.createServer(); await new Promise(r => portProbe.listen(0, '127.0.0.1', r));
const port = portProbe.address().port; await new Promise(r => portProbe.close(r));
// Reproduce the Cloud transport boundary: Next's internal fetch arrives with
// the container Host, regardless of whether this Node version preserves Host.
let internalRedirects = 0;
const transport = http.createServer((req, res) => {
  internalRedirects++;
  if (req.headers['x-instance-app-host'] !== 'tenant.synthetic.invalid' ||
      !/^\d{13}\.[a-f0-9]{64}$/.test(req.headers['x-instance-app-host-proof'] ?? '')) {
    unexpected.push('Internal redirect missing authenticated canonical host');
    res.writeHead(500); res.end(); return;
  }
  const upstream = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${port}` } }, response => {
    res.writeHead(response.statusCode, response.headers); response.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(upstream);
});
await new Promise(r => transport.listen(0, '127.0.0.1', r));
const internalOrigin = `http://127.0.0.1:${transport.address().port}`;
const token = await new SignJWT({ ...user, tenantId: context.tenantId, sessionVersion: 1 }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(key));
// Whitelist environment: no user secrets or production service settings inherited.
const runtime = spawn(process.execPath, [resolve(root, 'scripts/test-instance-redirect-local.mjs'), '--runtime'], {
  cwd: resolve(root, 'app'), env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', JOBS_DISABLED: '1',
    INSTANCE_MODE: 'cloud', INSTANCE_CONTROL_URL: fixtureUrl, INSTANCE_CONTROL_TOKEN: controlToken, INSTANCE_INGRESS_TOKEN: ingress,
    PB_URL: fixtureUrl, APP_URL: context.appUrl, SESSION_SECRET: key,
    PORT: String(port), REDIRECT_TEST_INTERNAL_ORIGIN: internalOrigin, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
});
let runtimeLog = ''; runtime.stdout.on('data', d => runtimeLog += d); runtime.stderr.on('data', d => runtimeLog += d);
const baseHeaders = { host: 'tenant.synthetic.invalid', 'x-instance-ingress': ingress, cookie: `__Host-zettelruhe_session=${token}` };
async function request(path, headers = {}, body) {
  return new Promise((resolveResponse, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: body ? 'POST' : 'GET', headers: { ...baseHeaders, ...headers } }, res => {
      const chunks = []; res.on('data', d => chunks.push(d)); res.on('end', () => resolveResponse({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    }); req.on('error', reject); req.end(body);
  });
}
function checkPrivate(response) {
  assert.equal(response.headers['x-instance-app-host'], undefined);
  assert.equal(response.headers['x-instance-app-host-proof'], undefined);
  assert.ok(!Object.keys(response.headers).some(h => h.startsWith('x-middleware-request-')));
  assert.ok(!response.body.includes(ingress) && !response.body.includes(key));
}
async function save(path, actionName, fields, expectedText) {
  const redirectsBefore = internalRedirects;
  const page = await request(path); assert.equal(page.status, 200); checkPrivate(page);
  const manifest = JSON.parse(await readFile(resolve(root, 'app/.next/server/server-reference-manifest.json'), 'utf8'));
  const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === actionName);
  assert.ok(entry, `Action ${actionName} absent from built manifest`);
  const [id] = entry;
  assert.ok(page.body.includes(id), `${actionName} absent from rendered form`);
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(`_1_${name}`, value);
  form.set('0', '["$K1"]');
  const encoded = new Response(form); const body = Buffer.from(await encoded.arrayBuffer());
  const response = await request(path, { 'next-action': id, origin: context.appUrl, 'content-type': encoded.headers.get('content-type'), 'content-length': String(body.length) }, body);
  assert.equal(response.status, 200);
  assert.equal(response.headers['x-action-redirect'], `${path}?saved=1;push`);
  assert.match(response.headers['content-type'], /text\/x-component/);
  assert.ok(response.body.includes(expectedText), `Redirect payload missing ${expectedText}`);
  assert.equal(internalRedirects, redirectsBefore + 1, 'Action must actually fetch the target through the internal container transport');
  checkPrivate(response);
  const landing = await request(`${path}?saved=1`); assert.equal(landing.status, 200); assert.ok(landing.body.includes(expectedText)); checkPrivate(landing);
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (runtime.exitCode !== null) throw new Error('Next exited before ready');
    try { await request('/health'); ready = true; break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert.ok(ready, 'Next failed to start');
  const fields = { name: 'Gespeicherte Firma', steuermodus: 'kleinunternehmer', nummernkreise_expected: JSON.stringify(nummernkreise) };
  for (const [name, config] of Object.entries(nummernkreise)) for (const [field, value] of Object.entries(config)) fields[`nk_${name}_${field}`] = String(value);
  await save('/app/firma', 'updateFirmaAction', fields, 'Gespeicherte Firma'); assert.equal(firmaWrites, 1);
  console.log('PASS Firma: real Server Action → internal RSC redirect ?saved=1 → authenticated saved page');
  await save('/app/rechnungen/rechnung1', 'updateRechnungAction', { id: 'rechnung1', rechnungsdatum: '2026-10-02', notiz: 'Gespeicherte Rechnung', position_bezeichnung: 'Test', position_menge: '1', position_einheit: 'Std.', position_einzelpreis: '10' }, 'Gespeicherte Rechnung');
  assert.equal(rechnungWrites, 1);
  console.log('PASS Rechnung: real Server Action → internal RSC redirect ?saved=1 → authenticated saved page');
  assert.equal((await request('/app/firma?saved=1', { host: `127.0.0.1:${port}` })).status, 503);
  assert.equal((await request('/app/firma', { 'x-forwarded-host': 'foreign.synthetic.invalid' })).status, 503);
  assert.equal((await request('/app/firma?hostname=tenant.synthetic.invalid', { host: 'unknown.synthetic.invalid' })).status, 503);
  assert.equal((await request('/app/firma', { 'x-instance-app-host': 'tenant.synthetic.invalid', 'x-instance-app-host-proof': 'forged' })).status, 503);
  console.log('PASS container host alone, foreign forwarded host, unknown host/query and forged context rejected');
  assert.deepEqual(unexpected, []);
  assert.ok(resolvedHosts.filter(h => h !== 'unknown.synthetic.invalid').every(h => h === 'tenant.synthetic.invalid'));
  console.log('PASS canonical control resolution and no internal headers/secrets in browser responses');
} catch (error) {
  // Synthetic-only server output, no inherited environment or real service data.
  console.error(runtimeLog); throw error;
} finally {
  if (runtime.exitCode === null && runtime.signalCode === null) { runtime.kill('SIGTERM'); await once(runtime, 'exit'); }
  fixture.closeAllConnections(); await new Promise(r => fixture.close(r));
  transport.closeAllConnections(); await new Promise(r => transport.close(r));
}
}
