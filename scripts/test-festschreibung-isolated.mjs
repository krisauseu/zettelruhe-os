#!/usr/bin/env node
// TP-022: own disposable PB container, no existing volumes, credentials or .env.
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, cpSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const name = `zettelruhe-tp022-${randomUUID()}`;
const image = process.env.TP022_PB_IMAGE || 'zettelruhe-pocketbase:latest';
const docker = (...args) => execFileSync('docker', args, {
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const hooks = mkdtempSync(join(tmpdir(), 'tp022-hooks-'));
cpSync(`${root}pocketbase/pb_hooks`, hooks, { recursive: true });
cpSync(`${root}scripts/fixtures/pb-beleg/failures.pb.js`, join(hooks, 'zz-test-failures.pb.js'));
cpSync(`${root}scripts/fixtures/pb-rc/failures.pb.js`, join(hooks, 'zz-rc-test-failures.pb.js'));
cpSync(`${root}scripts/fixtures/pb-release/failures.pb.js`, join(hooks, 'zz-release-test-failures.pb.js'));
const migrations = mkdtempSync(join(tmpdir(), 'tp022-migrations-'));
cpSync(`${root}pocketbase/pb_migrations`, migrations, { recursive: true });
cpSync(`${root}scripts/fixtures/pb-rc/1730002799_rc_synthetic_bestand.js`, join(migrations, '1730002799_rc_synthetic_bestand.js'));
const rcCore = true;
if (!readFileSync(join(hooks, 'reverse-charge.js'), 'utf8').includes('exports.RC_PUBLIC_ENABLED = true;')) throw new Error('RC release marker not enabled');
let created = false;
let test;
function cleanup() {
  if (created) {
    docker('rm', '-f', name);
    created = false;
    console.log('TP-022: Testcontainer samt tmpfs-Daten und Dateien entfernt.');
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { test?.kill(signal); cleanup(); process.exit(1); });
}
try {
  const version = docker('run', '--rm', '--network', 'none', '--entrypoint', '/pb/pocketbase', image, '--version');
  if (version !== 'pocketbase version 0.39.10') throw new Error(`Falsche Testversion: ${version}`);
  docker('run', '-d', '--name', name, '--read-only', '--tmpfs', '/pb_data', '--tmpfs', '/tmp',
    '-p', '127.0.0.1::8090', '-v', `${hooks}:/tp022_hooks:ro`, '-v', `${migrations}:/tp022_migrations:ro`,
    '--entrypoint', '/pb/pocketbase', image, 'serve', '--dev', '--dir=/pb_data',
    '--migrationsDir=/tp022_migrations', '--hooksDir=/tp022_hooks', '--http=0.0.0.0:8090');
  created = true;
  const address = docker('port', name, '8090/tcp');
  if (!/^127\.0\.0\.1:\d+$/.test(address)) throw new Error('Unerwartete Portbindung');
  const url = `http://${address}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(`${url}/api/health`)).ok; } catch { /* starting */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) { console.error(docker('logs', name).split('\n').slice(-20).join('\n')); throw new Error('Isolierte PocketBase startet nicht'); }
  const password = randomUUID();
  const email = 'tp022@synthetic.invalid';
  docker('exec', name, '/pb/pocketbase', 'superuser', 'upsert', email, password,
    '--dir=/pb_data', '--migrationsDir=/tp022_migrations');
  const auth = await fetch(`${url}/api/collections/_superusers/auth-with-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password }),
  });
  if (!auth.ok) throw new Error('Testbestand: Anmeldung fehlgeschlagen');
  const { token } = await auth.json();
  const empty = await fetch(`${url}/api/collections/firmen/records?perPage=2&fields=id,name`, {
    headers: { Authorization: token },
  });
  const initial = empty.ok ? await empty.json() : null;
  if (!initial || initial.totalItems !== 1 || initial.items[0].id !== 'rcmigration0001' || initial.items[0].name !== 'RC migration synthetic') {
    throw new Error('TP-022 verweigert einen bereits befuellten Testbestand');
  }
  console.log(`TP-022: ${version}, neuer tmpfs-Bestand mit geprüfter synthetischer Migrationsfixture, isolierter Loopback-Port.`);
  test = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
    'src/lib/festschreibung.integration.test.ts',
    'src/lib/beleg-transaktion.integration.test.ts',
    'src/lib/rechnung-transaktion.integration.test.ts',
    'src/lib/kasse-transaktion.integration.test.ts', 'src/lib/rc-transaktion.integration.test.ts', 'src/lib/release-risiken.integration.test.ts', ...process.argv.slice(2).filter(arg => arg !== '--rc-kern')], {
    cwd: `${root}app`, stdio: 'inherit',
    env: { ...process.env, RC_CORE_TEST: '1', TP022_ISOLATED: '1', TP022_BELEG_ISOLATED: '1', TP022_RECHNUNG_ISOLATED: '1', TP022_KASSE_ISOLATED: '1', PB_URL: url,
      PB_SUPERUSER_EMAIL: email, PB_SUPERUSER_PASSWORD: password, JOBS_DISABLED: 'true' },
  });
  process.exitCode = await new Promise((resolve, reject) => {
    test.on('error', reject);
    test.on('exit', (code) => resolve(code ?? 1));
  });
  if (process.exitCode) console.error(docker('logs', name).split('\n').filter(line => /error|Error|INJECT/.test(line) && !line.includes('pbinstall/')).join('\n'));
  const counts = {};
  for (const col of ['firmen', 'kontakte', 'rechnungen', 'rechnungspositionen', 'belege', 'kassenbuch_eintraege', 'buchungsjournal']) {
    const response = await fetch(`${url}/api/collections/${col}/records?perPage=1&fields=id`, {
      headers: { Authorization: token },
    });
    if (!response.ok) throw new Error('Testdatenbilanz: Lesen fehlgeschlagen');
    counts[col] = (await response.json()).totalItems;
  }
  counts.storageFiles = Number(docker('exec', name, 'sh', '-c',
    'if [ -d /pb_data/storage ]; then find /pb_data/storage -type f | wc -l; else echo 0; fi'));
  console.log('TP-022 synthetischer Bestand vor Bereinigung:', JSON.stringify(counts));
} catch (error) {
  // Do not print child-process arguments: upsert contains disposable credentials.
  console.error(error instanceof Error ? error.message.split('\n')[0].replace(/upsert .*/, 'upsert <redacted>') : 'Teststart fehlgeschlagen');
  process.exitCode = 1;
} finally {
  cleanup();
  rmSync(hooks, { recursive: true, force: true });
  rmSync(migrations, { recursive: true, force: true });
}
