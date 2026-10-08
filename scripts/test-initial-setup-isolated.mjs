#!/usr/bin/env node
// Real production Next + two fresh PB 0.39.10 instances. Synthetic tmpfs only.
// Prerequisite: cd app && npm run build -- --webpack
// Run from root: node scripts/test-initial-setup-isolated.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
if (process.argv.includes('--runtime')) {
  const { default: next } = await import('../app/node_modules/next/dist/server/next.js');
  const app = next({ dev: false, dir: resolve(root, 'app'), hostname: '127.0.0.1', port: Number(process.env.PORT) });
  await app.prepare();
  process.env.__NEXT_PRIVATE_ORIGIN = `http://127.0.0.1:${process.env.PORT}`;
  const server = http.createServer(app.getRequestHandler());
  server.listen(Number(process.env.PORT), '127.0.0.1');
  process.on('SIGTERM', () => { server.closeAllConnections(); server.close(() => process.exit(0)); });
} else {
  const prefix = `zettelruhe-setup-${randomUUID()}`;
  const ingress = 'synthetic-setup-ingress-'.repeat(3);
  const controlToken = 'synthetic-setup-control-'.repeat(3);
  const password = randomUUID();
  const ownerId = 'initialowner001', firmaId = 'initialfirma001';
  const nummernkreise = Object.fromEntries(Object.entries({ angebot: 'A-', rechnung: 'R-', gutschrift: 'G-', beleg: 'B-', kasse: 'K-', kontakt: 'KT-' })
    .map(([key, prefix]) => [key, { prefix, digits: 4, next: 1 }]));
  const containers = [], runtimes = [];
  let control, runtimeLog = '', deniedHost = '';
  const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const freePort = async () => {
    const server = http.createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port; await new Promise(r => server.close(r)); return port;
  };
  async function ready(url, headers = {}) {
    for (let i = 0; i < 150; i++) {
      try { if ((await fetch(url, { headers })).ok) return; } catch { /* isolated startup */ }
      await pause(100);
    }
    throw new Error('Synthetic service did not start');
  }
  async function pocketbase(label) {
    const name = `${prefix}-${label}`;
    docker('run', '-d', '--name', name, '--read-only', '--tmpfs', '/pb_data', '--tmpfs', '/tmp',
      '-p', '127.0.0.1::8090', '-v', `${root}/pocketbase/pb_migrations:/migrations:ro`,
      '-v', `${root}/pocketbase/pb_hooks:/hooks:ro`, '--entrypoint', '/pb/pocketbase',
      'zettelruhe-pocketbase:latest', 'serve', '--dir=/pb_data', '--migrationsDir=/migrations', '--hooksDir=/hooks', '--http=0.0.0.0:8090');
    containers.push(name);
    const address = docker('port', name, '8090/tcp'); assert.match(address, /^127\.0\.0\.1:\d+$/);
    const url = `http://${address}`; await ready(`${url}/api/health`);
    const adminEmail = `${label}@synthetic.invalid`, adminPassword = randomUUID();
    docker('exec', name, '/pb/pocketbase', 'superuser', 'upsert', adminEmail, adminPassword, '--dir=/pb_data', '--migrationsDir=/migrations');
    const auth = await fetch(`${url}/api/collections/_superusers/auth-with-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: adminEmail, password: adminPassword }),
    });
    assert.equal(auth.status, 200); const { token } = await auth.json();
    const api = async (path, body, method = 'POST') => {
      const response = await fetch(url + path, { method, headers: { Authorization: token, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }) });
      const text = await response.text(); assert.ok(response.ok, `Synthetic PB ${method} ${path}: ${response.status} ${text}`);
      return text ? JSON.parse(text) : null;
    };
    const record = (col, id) => api(`/api/collections/${col}/records/${id}`, undefined, 'GET');
    return { name, url, adminEmail, adminPassword, api, record, create: (col, values) => api(`/api/collections/${col}/records`, values),
      list: col => api(`/api/collections/${col}/records?perPage=200`, undefined, 'GET') };
  }
  async function seed(pb, label) {
    await pb.create('firmen', { id: firmaId, name: `Firma ${label} aus Checkout`, steuermodus: 'kleinunternehmer', skr: 'skr03', nummernkreise });
    await pb.create('users', { id: ownerId, name: 'Eigentümer:in', email: `owner-${label}@synthetic.invalid`, password, passwordConfirm: password,
      verified: true, role: 'eigentuemer', firma: firmaId });
    await pb.create('mitgliedschaften', { id: 'initialmember01', user: ownerId, firma: firmaId, rolle: 'eigentuemer' });
    await pb.create('instanz_einrichtung', { id: 'initialsetup001', eigentuemer: ownerId, firma: firmaId, status: 'pending' });
  }
  async function runtime(env) {
    const port = await freePort();
    const processRuntime = spawn(process.execPath, [resolve(root, 'scripts/test-initial-setup-isolated.mjs'), '--runtime'], {
      cwd: resolve(root, 'app'), env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'production', JOBS_DISABLED: '1',
        NEXT_TELEMETRY_DISABLED: '1', PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    runtimes.push(processRuntime); processRuntime.stdout.on('data', data => runtimeLog += data); processRuntime.stderr.on('data', data => runtimeLog += data);
    for (let i = 0; i < 150; i++) {
      if (processRuntime.exitCode !== null) throw new Error('Synthetic Next exited during startup');
      try { if ((await request(port, env.INSTANCE_MODE === 'cloud' ? 'a.synthetic.invalid' : 'localhost', '/health')).status === 200) return port; } catch { /* isolated startup */ }
      await pause(100);
    }
    throw new Error('Synthetic Next did not start');
  }
  async function request(port, host, path, cookie = '', fields, headers = {}) {
    const body = fields instanceof URLSearchParams ? fields.toString() : fields;
    return new Promise((resolveResponse, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path, method: body === undefined ? 'GET' : 'POST',
        headers: { host, 'x-instance-ingress': ingress, origin: `https://${host}`, ...(cookie ? { cookie } : {}),
          ...(fields instanceof URLSearchParams ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...headers } }, res => {
        const chunks = []; res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolveResponse({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
      }); req.on('error', reject); req.end(body);
    });
  }
  async function action(port, host, path, cookie, name, fields) {
    const manifest = JSON.parse(await readFile(resolve(root, 'app/.next/server/server-reference-manifest.json'), 'utf8'));
    const entry = Object.entries(manifest.node).find(([, value]) => value.exportedName === name);
    assert.ok(entry, `Action ${name} absent from production manifest`);
    const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(`_1_${key}`, String(value)); data.set('0', '["$K1"]');
    const encoded = new Response(data), body = Buffer.from(await encoded.arrayBuffer());
    return request(port, host, path, cookie, body, { 'next-action': entry[0], 'content-type': encoded.headers.get('content-type'), 'content-length': String(body.length) });
  }
  function fields(label, ownerName = 'Alex Beispiel') {
    const result = { name: `Vollständige Firma ${label}`, owner_name: ownerName, strasse: 'Beispielstraße 1', plz: '12345', ort: 'Beispielstadt', land: 'DE',
      steuermodus: 'kleinunternehmer', nummernkreise_expected: JSON.stringify(nummernkreise) };
    for (const [key, config] of Object.entries(nummernkreise)) for (const [field, value] of Object.entries(config)) result[`nk_${key}_${field}`] = value;
    return result;
  }
  const cookieOf = response => response.headers['set-cookie']?.find(value => /^(?:__Host-)?zettelruhe_session=/.test(value))?.split(';')[0];
  try {
    assert.equal(docker('run', '--rm', '--network', 'none', '--entrypoint', '/pb/pocketbase', 'zettelruhe-pocketbase:latest', '--version'), 'pocketbase version 0.39.10');
    const a = await pocketbase('a'), b = await pocketbase('b');
    // Prove the existing self-hosted setup redirect on a genuinely empty PB.
    const selfPort = await runtime({ INSTANCE_MODE: 'self-hosted', PB_URL: b.url, APP_URL: 'http://localhost',
      PB_SUPERUSER_EMAIL: b.adminEmail, PB_SUPERUSER_PASSWORD: b.adminPassword, SESSION_SECRET: 'synthetic-selfhost-session-'.repeat(2) });
    assert.equal((await request(selfPort, 'localhost', '/')).headers.location, '/setup');
    await seed(a, 'a'); await seed(b, 'b');
    const contexts = Object.fromEntries([[a, 'a'], [b, 'b']].map(([pb, label]) => [`${label}.synthetic.invalid`, {
      tenantId: `t_syntheticsetup${label}`, pocketbaseUrl: pb.url, appUrl: `https://${label}.synthetic.invalid`, configVersion: 1, sessionVersion: 1,
      sessionSecret: `synthetic-${label}-session-`.repeat(3), adminEmail: pb.adminEmail, adminPassword: pb.adminPassword, smtp: null,
    }]));
    control = http.createServer((req, res) => {
      assert.equal(req.headers.authorization, `Bearer ${controlToken}`);
      const url = new URL(req.url, 'http://synthetic.invalid'), host = url.searchParams.get('hostname');
      const value = contexts[host], status = host === deniedHost ? 403 : value ? 200 : 404;
      res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(status === 200 ? value : { error: 'unavailable' }));
    });
    await new Promise(r => control.listen(0, '127.0.0.1', r));
    const port = await runtime({ INSTANCE_MODE: 'cloud', INSTANCE_CONTROL_URL: `http://127.0.0.1:${control.address().port}`,
      INSTANCE_CONTROL_TOKEN: controlToken, INSTANCE_INGRESS_TOKEN: ingress });
    const signed = await request(port, 'a.synthetic.invalid', '/login/submit', '', new URLSearchParams({ email: 'owner-a@synthetic.invalid', password }));
    assert.equal(signed.status, 303); assert.equal(signed.headers.location, 'https://a.synthetic.invalid/app/firma');
    const aCookie = cookieOf(signed); assert.ok(aCookie);
    const bSigned = await request(port, 'b.synthetic.invalid', '/login/submit', '', new URLSearchParams({ email: 'owner-b@synthetic.invalid', password }));
    assert.equal(bSigned.headers.location, 'https://b.synthetic.invalid/app/firma'); const bCookie = cookieOf(bSigned); assert.ok(bCookie);
    const page = await request(port, 'a.synthetic.invalid', '/app/firma', aCookie);
    assert.equal(page.status, 200); assert.ok(page.body.includes('name="owner_name"')); assert.ok(!page.body.includes('Synthetic Owner'));
    const setupManifest = JSON.parse(await readFile(resolve(root, 'app/.next/server/server-reference-manifest.json'), 'utf8'));
    const setupAction = Object.entries(setupManifest.node).find(([, value]) => value.exportedName === 'completeFirmaEinrichtungAction');
    assert.ok(setupAction && page.body.includes(setupAction[0]), 'Pending form must reference the completion action');
    assert.ok(!page.body.includes('href="/app/rechnungen"')); assert.ok(page.body.includes('Abmelden'));
    assert.equal((await request(port, 'a.synthetic.invalid', '/app/kontakte', aCookie)).headers.location, 'https://a.synthetic.invalid/app/firma');
    const blocked = await action(port, 'a.synthetic.invalid', '/app/firma', aCookie, 'createKontaktAction', { name: 'Forbidden', ist_kunde: 'on' });
    assert.equal(blocked.headers['x-action-redirect'], '/app/firma;push'); assert.equal((await a.list('kontakte')).totalItems, 0);
    console.log('PASS first login, persistent page gate, reduced UI and server-action gate on setup URL');

    const beforeUser = await a.record('users', ownerId), beforeMember = (await a.list('mitgliedschaften')).items;
    const invalid = await action(port, 'a.synthetic.invalid', '/app/firma', aCookie, 'completeFirmaEinrichtungAction', fields('a', ''));
    assert.ok(invalid.headers['x-action-redirect']?.startsWith('/app/firma?error='));
    assert.equal((await a.record('instanz_einrichtung', 'initialsetup001')).status, 'pending');
    assert.equal((await a.record('users', ownerId)).name, beforeUser.name);
    // An actual DB conflict must roll back every part of the completion.
    await a.create('firmen', { name: 'Bereits verwendeter Firmenname', steuermodus: 'kleinunternehmer', skr: 'skr03', nummernkreise });
    const conflict = await action(port, 'a.synthetic.invalid', '/app/firma', aCookie, 'completeFirmaEinrichtungAction', { ...fields('a'), name: 'Bereits verwendeter Firmenname' });
    assert.ok(conflict.headers['x-action-redirect']?.startsWith('/app/firma?error='));
    assert.equal((await a.record('instanz_einrichtung', 'initialsetup001')).status, 'pending');
    assert.equal((await a.record('users', ownerId)).name, beforeUser.name); assert.equal((await a.record('firmen', firmaId)).name, 'Firma a aus Checkout');
    const relogin = await request(port, 'a.synthetic.invalid', '/login/submit', '', new URLSearchParams({ email: 'owner-a@synthetic.invalid', password }));
    assert.equal(relogin.headers.location, 'https://a.synthetic.invalid/app/firma');
    const staleSetupFields = fields('a');
    const saved = await action(port, 'a.synthetic.invalid', '/app/firma', aCookie, 'completeFirmaEinrichtungAction', staleSetupFields);
    assert.equal(saved.headers['x-action-redirect'], '/app;push');
    assert.equal((await a.record('instanz_einrichtung', 'initialsetup001')).status, 'complete');
    const afterUser = await a.record('users', ownerId);
    for (const key of ['id', 'email', 'role', 'firma']) assert.equal(afterUser[key], beforeUser[key]);
    assert.equal(afterUser.name, 'Alex Beispiel'); assert.deepEqual((await a.list('mitgliedschaften')).items, beforeMember);
    assert.equal((await a.record('firmen', firmaId)).name, 'Vollständige Firma a');
    assert.equal((await request(port, 'a.synthetic.invalid', '/app', aCookie)).status, 200);
    console.log('PASS validation, transactional DB failure, resume and atomic completion of existing identities');

    assert.equal((await b.record('instanz_einrichtung', 'initialsetup001')).status, 'pending');
    assert.equal((await b.record('users', ownerId)).name, 'Eigentümer:in'); assert.equal((await b.record('firmen', firmaId)).name, 'Firma b aus Checkout');
    assert.equal((await request(port, 'b.synthetic.invalid', '/app/firma', aCookie)).headers.location, 'https://b.synthetic.invalid/login');
    assert.equal((await request(port, 'a.synthetic.invalid', '/app/firma?hostname=b.synthetic.invalid', bCookie)).headers.location, 'https://a.synthetic.invalid/login');
    deniedHost = 'a.synthetic.invalid';
    assert.equal((await action(port, 'a.synthetic.invalid', '/app/firma', aCookie, 'updateFirmaAction', fields('a'))).status, 503); deniedHost = '';
    const renamed = await action(port, 'a.synthetic.invalid', '/app/nutzer', aCookie, 'setzeNameAction', { userId: ownerId, name: 'Alex Neuername' });
    assert.equal(renamed.headers['x-action-redirect'], '/app/nutzer?saved=1;push'); assert.equal((await a.record('users', ownerId)).name, 'Alex Neuername');
    assert.equal((await b.record('users', ownerId)).name, 'Eigentümer:in');
    const edited = await action(port, 'a.synthetic.invalid', '/app/firma', aCookie, 'updateFirmaAction', { ...fields('a'), name: 'Später geänderte Firma a' });
    assert.equal(edited.headers['x-action-redirect'], '/app/firma?saved=1;push');
    const completedRecords = { user: await a.record('users', ownerId), firma: await a.record('firmen', firmaId), marker: await a.record('instanz_einrichtung', 'initialsetup001') };
    const replayed = await action(port, 'a.synthetic.invalid', '/app/firma', aCookie, 'completeFirmaEinrichtungAction', staleSetupFields);
    assert.equal(replayed.headers['x-action-redirect'], '/app;push');
    assert.deepEqual({ user: await a.record('users', ownerId), firma: await a.record('firmen', firmaId), marker: await a.record('instanz_einrichtung', 'initialsetup001') }, completedRecords);
    console.log('PASS separate real PB tenants, cross-tenant cookies/query, denied control access, later rename and stale setup-form replay');

    const selfLogin = await request(selfPort, 'localhost', '/login/submit', '', new URLSearchParams({ email: 'owner-b@synthetic.invalid', password }));
    assert.equal(selfLogin.headers.location, 'http://localhost/app'); const selfCookie = cookieOf(selfLogin); assert.ok(selfCookie);
    assert.equal((await request(selfPort, 'localhost', '/app', selfCookie)).status, 200);
    const selfFirma = await request(selfPort, 'localhost', '/app/firma', selfCookie);
    assert.equal(selfFirma.status, 200); assert.ok(!selfFirma.body.includes('name="owner_name"'));
    assert.equal((await b.record('instanz_einrichtung', 'initialsetup001')).status, 'pending');
    console.log('PASS unchanged self-hosted empty setup, login/dashboard/company UI and no Cloud-marker effects');
  } catch (error) {
    console.error(runtimeLog); console.error(error instanceof Error ? error.message.split('\n')[0].replace(/upsert .*/, 'upsert <redacted>') : 'Isolated setup test failed');
    for (const name of containers) try { console.error(docker('logs', name).split('\n').filter(line => !line.includes('pbinstall/')).slice(-12).join('\n')); } catch { /* cleanup below */ }
    process.exitCode = 1;
  } finally {
    for (const runtime of runtimes) if (runtime.exitCode === null && runtime.signalCode === null) { runtime.kill('SIGTERM'); await once(runtime, 'exit'); }
    if (control) { control.closeAllConnections(); await new Promise(r => control.close(r)); }
    for (const name of containers.reverse()) try { docker('rm', '-f', name); } catch { /* only newly created resources */ }
  }
}
