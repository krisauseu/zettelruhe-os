#!/usr/bin/env node
// Disposable UI fixture only: no .env, production volume or reusable release switch.
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'zettelruhe-rc-ui-'));
const name = `zettelruhe-rc-ui-${randomUUID()}`;
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let created = false, next;
function cleanup() { next?.kill('SIGTERM'); if (created) { docker('rm', '-f', name); created = false; } }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { cleanup(); process.exit(0); });
try {
  if (docker('run', '--rm', '--network', 'none', '--entrypoint', '/pb/pocketbase', 'zettelruhe-pocketbase:latest', '--version') !== 'pocketbase version 0.39.10') throw new Error('Expected PB 0.39.10');
  cpSync(join(root, 'pocketbase/pb_hooks'), join(temp, 'hooks'), { recursive: true });
  cpSync(join(root, 'pocketbase/pb_migrations'), join(temp, 'migrations'), { recursive: true });
  cpSync(join(root, 'app/src'), join(temp, 'app/src'), { recursive: true });
  cpSync(join(root, 'app/public'), join(temp, 'app/public'), { recursive: true });
  for (const f of ['package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'next-env.d.ts']) cpSync(join(root, 'app', f), join(temp, 'app', f));
  symlinkSync(join(root, 'app/node_modules'), join(temp, 'app/node_modules'));
  for (const [f, marker] of [['hooks/reverse-charge.js', 'exports.RC_PUBLIC_ENABLED = true;'], ['app/src/modules/expenses/reverse-charge.ts', 'export const RC_PUBLIC_ENABLED = true;']]) {
    if (!readFileSync(join(temp, f), 'utf8').includes(marker)) throw new Error('Release marker not enabled');
  }
  docker('run', '-d', '--name', name, '--read-only', '--tmpfs', '/pb_data', '--tmpfs', '/tmp', '-p', '127.0.0.1::8090', '-v', `${temp}/hooks:/hooks:ro`, '-v', `${temp}/migrations:/migrations:ro`, '--entrypoint', '/pb/pocketbase', 'zettelruhe-pocketbase:latest', 'serve', '--dev', '--dir=/pb_data', '--migrationsDir=/migrations', '--hooksDir=/hooks', '--http=0.0.0.0:8090');
  created = true;
  const address = docker('port', name, '8090/tcp');
  if (!/^127\.0\.0\.1:\d+$/.test(address)) throw new Error('Not loopback');
  const pb = `http://${address}`;
  for (let i=0;i<100;i++) { try { if ((await fetch(pb+'/api/health')).ok) break; } catch {} await new Promise(r=>setTimeout(r,100)); }
  const email = 'rc-ui@synthetic.invalid', password = randomUUID();
  docker('exec', name, '/pb/pocketbase', 'superuser', 'upsert', email, password, '--dir=/pb_data', '--migrationsDir=/migrations');
  const auth = await fetch(pb+'/api/collections/_superusers/auth-with-password', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({identity:email,password}) });
  const {token} = await auth.json();
  async function create(col, body) { const r=await fetch(`${pb}/api/collections/${col}/records`, {method:'POST',headers:{Authorization:token,'Content-Type':'application/json'},body:JSON.stringify(body)}); const data=await r.json(); if(!r.ok) throw new Error(JSON.stringify(data)); return data; }
  const counts=await (await fetch(pb+'/api/collections/firmen/records?perPage=1', {headers:{Authorization:token}})).json();
  if(counts.totalItems!==0) throw new Error('Expected empty database');
  const firmen=[];
  for(const mode of ['kleinunternehmer','regelbesteuerung_ist']) {
    const nummernkreise=Object.fromEntries([['angebot','A-'],['rechnung','R-'],['gutschrift','G-'],['beleg','B-'],['kasse','K-'],['kontakt','KT-']].map(([k,prefix])=>[k,{prefix,digits:4,next:1}]));
    const firma=await create('firmen',{name:`RC UI ${mode}`,steuermodus:mode,skr:'skr03',nummernkreise}); firmen.push(firma.id);
    await create('kontakte',{firma:firma.id,name:'Synthetic Ireland Services',ist_lieferant:true,land:'IE',ust_id:'DE123456789',ausgaben_steuerstandard:'eu_dienstleistung'});
    await create('kontakte',{firma:firma.id,name:'Synthetic US Services',ist_lieferant:true,land:'US',ausgaben_steuerstandard:'drittland_dienstleistung'});
  }
  const user=await create('users',{email,password,passwordConfirm:password,name:'RC UI synthetic',role:'eigentuemer',firma:firmen[0]});
  for(const firma of firmen) await create('mitgliedschaften',{firma,user:user.id,rolle:'eigentuemer'});
  const server=createServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r)); const port=server.address().port; await new Promise(r=>server.close(r));
  const url=`http://127.0.0.1:${port}`;
  const manifest={temp,name,url,pb,email,password,firmen};
  writeFileSync(join(temp,'session.json'),JSON.stringify(manifest),{mode:0o600});
  console.log(`Synthetic UI session: ${join(temp,'session.json')}\nURL: ${url}`);
  next=spawn(process.execPath,[join(root,'app/node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{cwd:join(temp,'app'),stdio:'inherit',env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'development',JOBS_DISABLED:'true',NEXT_TELEMETRY_DISABLED:'1',PB_URL:pb,PB_SUPERUSER_EMAIL:email,PB_SUPERUSER_PASSWORD:password,SESSION_SECRET:randomUUID()+randomUUID(),APP_URL:url}});
  const timer=setTimeout(()=>next.kill('SIGTERM'),30*60*1000);
  await new Promise(r=>next.on('exit',r)); clearTimeout(timer);
} catch(e) { if (created) console.error(docker('logs', name).split('\n').slice(-12).join('\n')); console.error(e instanceof Error ? e.message.split('\n')[0].replace(/upsert .*/, 'upsert <redacted>') : 'UI fixture failed'); process.exitCode=1; }
finally { cleanup(); rmSync(temp,{recursive:true,force:true}); }
