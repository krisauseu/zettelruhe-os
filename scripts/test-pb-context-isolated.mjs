#!/usr/bin/env node
// Real PB 0.39.10, synthetic tmpfs only. No existing volume, .env or app start.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const name = `zettelruhe-context-${randomUUID()}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let created = false;
try {
  assert.equal(docker('run', '--rm', '--network', 'none', '--entrypoint', '/pb/pocketbase', 'zettelruhe-pocketbase:latest', '--version'), 'pocketbase version 0.39.10');
  docker('run', '-d', '--name', name, '--read-only', '--tmpfs', '/pb_data', '--tmpfs', '/tmp', '-p', '127.0.0.1::8090',
    '-v', `${root}pocketbase/pb_migrations:/migrations:ro`, '-v', `${root}scripts/fixtures/pb-context:/hooks:ro`,
    '--entrypoint', '/pb/pocketbase', 'zettelruhe-pocketbase:latest', 'serve', '--dir=/pb_data', '--migrationsDir=/migrations', '--hooksDir=/hooks', '--http=0.0.0.0:8090');
  created = true;
  const address = docker('port', name, '8090/tcp');
  assert.match(address, /^127\.0\.0\.1:\d+$/);
  const url = `http://${address}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${url}/api/health`)).ok) break; } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const password = randomUUID();
  const email = 'context@synthetic.invalid';
  docker('exec', name, '/pb/pocketbase', 'superuser', 'upsert', email, password, '--dir=/pb_data', '--migrationsDir=/migrations');
  const login = await fetch(`${url}/api/collections/_superusers/auth-with-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: email, password }) });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const request = async (method, path, body) => {
    const r = await fetch(url + path, { method, headers: { Authorization: token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.text() };
  };
  const records = col => `/api/collections/${col}/records`;
  const create = async (col, body) => {
    const r = await request('POST', records(col), body);
    assert.equal(r.status, 200, r.body);
    return JSON.parse(r.body);
  };
  const firma = await create('firmen', { name: 'Synthetic context probe', steuermodus: 'kleinunternehmer', skr: 'skr03', nummernkreise: { beleg: { prefix: 'B-', digits: 4, next: 1 } } });
  const kontakt = await create('kontakte', { firma: firma.id, name: 'Synthetic supplier' });
  const beleg = await create('belege', { firma: firma.id, lieferant: kontakt.id, belegdatum: '2026-09-05', richtung: 'ausgabe', betrag_netto: '1.00', betrag_ust: '0.00', betrag_brutto: '1.00', status: 'entwurf', notiz: 'before' });
  const check = async (label, method, path, body, ok) => {
    const r = await request(method, path, body);
    assert.equal(r.status >= 200 && r.status < 300, ok, `${label}: ${r.status} ${r.body}`);
    console.log(`PASS ${label}`);
    return r;
  };
  const probe = mode => `/internal/tp022/probe/${beleg.id}/${mode}`;
  await check('saveWithContext reaches transactional record hook', 'POST', probe('save'), {}, true);
  await check('saveNoValidateWithContext reaches record hook', 'POST', probe('no-validate'), {}, true);
  await check('missing context denied even inside transaction', 'POST', probe('no-context'), {}, false);
  await check('generic PATCH cannot forge context', 'PATCH', `${records('belege')}/${beleg.id}`, { notiz: 'forged', skipGuard: true, 'tp022.operation': { id: beleg.id } }, false);
  await check('generic DELETE denied', 'DELETE', `${records('belege')}/${beleg.id}`, undefined, false);
  await check('contact deletion cannot bypass update hook through SaveNoValidate', 'DELETE', `${records('kontakte')}/${kontakt.id}`, undefined, false);
  await check('company cascade cannot bypass delete hook', 'DELETE', `${records('firmen')}/${firma.id}`, undefined, false);
  await check('error after contextual save rolls back', 'POST', probe('rollback'), {}, false);
  const current = await request('GET', `${records('belege')}/${beleg.id}`);
  assert.equal(JSON.parse(current.body).notiz, 'no-validate');
  assert.equal(JSON.parse(current.body).lieferant, kontakt.id);
  await check('deleteWithContext reaches transactional record hook', 'POST', probe('delete'), {}, true);
  console.log('PASS all context/cascade prerequisites');
} catch (error) {
  console.error(error instanceof Error ? error.message.split('\n')[0].replace(/upsert .*/, 'upsert <redacted>') : 'Probe failed');
  if (created) console.error(docker('logs', name).split('\n').filter(line => !line.includes('pbinstall/')).join('\n'));
  process.exitCode = 1;
} finally {
  if (created) docker('rm', '-f', name);
}
