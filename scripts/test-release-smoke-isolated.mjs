#!/usr/bin/env node
// Release smoke: fresh setup + offline synthetic upgrade/restore. Never reads .env/backups.
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'zettelruhe-release-smoke-'));
const prefix='zr-release-'+randomUUID();
const images={pb:process.env.RELEASE_PB_IMAGE || 'zettelruhe-release-pb:20260910',next:process.env.RELEASE_NEXT_IMAGE || 'zettelruhe-release-next:20260910'};
const resources={containers:[],volumes:[],network:false};
const docker=(...args)=>{try{return execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:20*1024*1024}).trim();}catch{throw new Error('Docker operation failed: '+args[0]);}};
function cleanup(){for(const name of resources.containers.reverse())try{docker('rm','-f',name);}catch{}for(const name of resources.volumes)try{docker('volume','rm',name);}catch{}if(resources.network)try{docker('network','rm',prefix);}catch{}rmSync(temp,{recursive:true,force:true});}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{cleanup();process.exit(0);});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(url){for(let i=0;i<150;i++){try{if((await fetch(url)).ok)return;}catch{}await pause(200);}throw new Error('Test service did not become ready');}
const secrets={email:'release@synthetic.invalid',password:randomUUID(),session:randomUUID()+randomUUID()};
async function pb(which, old=false){
 const name=prefix+'-'+which,volume=name+'-data';
 const credentials={email:which+'@synthetic.invalid',password:randomUUID()};
 docker('volume','create',volume);resources.volumes.push(volume);
 const args=['run','-d','--name',name,'--network',prefix,'--network-alias',which,'-p','127.0.0.1::8090','-v',volume+':/pb_data','-e','PB_SUPERUSER_EMAIL='+credentials.email,'-e','PB_SUPERUSER_PASSWORD='+credentials.password];
 if(old)args.push('-v',temp+'/old-hooks:/pb/pb_hooks:ro','-v',temp+'/old-migrations:/pb/pb_migrations:ro');
 args.push(images.pb);docker(...args);resources.containers.push(name);
 const address=docker('port',name,'8090/tcp');if(!/^127\.0\.0\.1:\d+$/.test(address))throw new Error('Non-loopback PB');
 const url='http://'+address;console.log('Starting synthetic PB: '+which);try{await ready(url+'/api/health');}catch{console.error(docker('logs',name).split('\n').slice(-8).join('\n').replaceAll(credentials.password,'<redacted>'));throw new Error('PB did not start: '+which);}return {name,volume,url,...credentials};
}
async function client(instance){
 const auth=await fetch(instance.url+'/api/collections/_superusers/auth-with-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:instance.email,password:instance.password})});if(!auth.ok)throw new Error('Synthetic authentication failed');const {token}=await auth.json();
 async function api(path,body,method='POST') {const r=await fetch(instance.url+path,{method,headers:{Authorization:token,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body!==undefined?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error('Synthetic API failed: '+path.split('?')[0]+' '+r.status);return r.status===204?null:r.json();}
 return {api,token,create:(col,body)=>api('/api/collections/'+col+'/records',body),list:col=>api('/api/collections/'+col+'/records?perPage=500',undefined,'GET')};
}
async function next(instance,port){
 const name=prefix+'-next-'+port,url='http://127.0.0.1:'+port;
 docker('run','-d','--name',name,'--network',prefix,'-p','127.0.0.1:'+port+':3000','-e','APP_URL='+url,'-e','PB_URL=http://'+instance.name+':8090','-e','PB_SUPERUSER_EMAIL='+instance.email,'-e','PB_SUPERUSER_PASSWORD='+instance.password,'-e','SESSION_SECRET='+randomUUID()+randomUUID(),'-e','JOBS_DISABLED=true',images.next);resources.containers.push(name);
 await ready(url+'/health');const health=await(await fetch(url+'/health')).json();if(!health.ok)throw new Error('Health JSON is not ready');return {name,url};
}
try{
 docker('network','create',prefix);resources.network=true;
 // The old files are obtained from the requested base, not from a running installation.
 for(const [from,to] of [['pb_hooks','old-hooks'],['pb_migrations','old-migrations']]){
  mkdirSync(join(temp,to));
  const files=execFileSync('git',['ls-tree','-r','--name-only','f48be21','pocketbase/'+from],{cwd:root,encoding:'utf8'}).trim().split('\n');
  for(const file of files){const rel=file.slice(('pocketbase/'+from+'/').length);mkdirSync(join(temp,to,rel,'..'),{recursive:true});writeFileSync(join(temp,to,rel),execFileSync('git',['show','f48be21:'+file],{cwd:root}));}
 }
 const fresh=await pb('fresh');const fc=await client(fresh);
 if((await fc.list('firmen')).totalItems!==0)throw new Error('Fresh volume was not empty');
 const app=await next(fresh,43127);
 const landing=await fetch(app.url,{redirect:'manual'});if(![303,307].includes(landing.status)||!landing.headers.get('location')?.includes('/setup'))throw new Error('Fresh setup redirect missing');
 console.log('Fresh install: empty volume, migrations, health JSON and setup redirect passed.');
 const setup=await fetch(app.url+'/setup/submit',{method:'POST',body:new URLSearchParams({name:'Synthetic release owner',email:secrets.email,password:secrets.password,passwordConfirm:secrets.password,firmaName:'Synthetic fresh release',strasse:'Musterstrasse 1',plz:'12345',ort:'Musterstadt',steuermodus:'regelbesteuerung_ist',skr:'skr03'}),redirect:'manual'});
 if(setup.status!==303 || !setup.headers.get('location')?.endsWith('/app'))throw new Error('Fresh setup failed');
 const freshCookie=setup.headers.getSetCookie().find(c=>c.startsWith('zettelruhe_session='))?.split(';')[0];
 if(!freshCookie || !(await fetch(app.url+'/app',{headers:{Cookie:freshCookie}})).ok)throw new Error('Fresh owner session failed');
 console.log('Fresh setup: synthetic owner, company and authenticated dashboard passed.');

 const old=await pb('old',true),oc=await client(old);
 const firma=await oc.create('firmen',{name:'Synthetic upgrade company',steuermodus:'kleinunternehmer',skr:'skr03',nummernkreise:{beleg:{prefix:'B-',digits:4,next:1}}});
 const user=await oc.create('users',{email:'upgrade@synthetic.invalid',password:secrets.password,passwordConfirm:secrets.password,role:'eigentuemer',firma:firma.id});
 await oc.create('mitgliedschaften',{firma:firma.id,user:user.id,rolle:'eigentuemer'});
 const fd=new FormData();const values={firma:firma.id,status:'entwurf',belegdatum:'2026-09-10',buchungsdatum:'2026-09-10',richtung:'ausgabe',betrag_netto:'42.00',betrag_ust:'0.00',betrag_brutto:'42.00',steuersatz:'',kategorie:'Synthetic upgrade',notiz:'Synthetic file preservation',konto:'',lieferant:'',kunde:''};
 for(const [k,v]of Object.entries(values))fd.set(k,v);
 const fileBytes=Buffer.from('%PDF-1.4\n% synthetic release fixture\n%%EOF\n');fd.set('datei',new Blob([fileBytes],{type:'application/pdf'}),'synthetic.pdf');
 const beleg=await oc.create('belege',fd);
 const expected={...values,datei:beleg.datei};delete expected.firma;delete expected.status;
 await oc.api('/internal/zettelruhe/finanz/v1/beleg/festschreiben',{firma:firma.id,akteur:user.id,id:beleg.id,expected});
 const before={};for(const col of ['firmen','users','mitgliedschaften','belege','buchungsjournal'])before[col]=(await oc.list(col)).items;
 // Offline backup of ONLY this newly created synthetic volume, including storage.
 docker('stop',old.name);
 docker('run','--rm','--network','none','-v',old.volume+':/source:ro','-v',temp+':/backup','--entrypoint','sh',images.pb,'-c','tar czf /backup/synthetic-backup.tar.gz -C /source .');
 const restored=await pb('restore');docker('stop',restored.name);
 // Restore into its own freshly created volume, which has no user data.
 docker('run','--rm','--network','none','-v',restored.volume+':/target','-v',temp+':/backup:ro','--entrypoint','sh',images.pb,'-c','find /target -mindepth 1 -maxdepth 1 -exec rm -rf {} \\; && tar xzf /backup/synthetic-backup.tar.gz -C /target');
 docker('start',restored.name);restored.url='http://'+docker('port',restored.name,'8090/tcp');console.log('Starting restored synthetic PB');await ready(restored.url+'/api/health');const rc=await client(restored);
 for(const col of Object.keys(before)){
  const after=(await rc.list(col)).items;
  const normalize=rows=>rows.map(r=>{const {collectionId,collectionName,expand,...rest}=r;return rest;}).sort((a,b)=>a.id.localeCompare(b.id));
  if(JSON.stringify(normalize(before[col]))!==JSON.stringify(normalize(after)))throw new Error('Restore changed synthetic collection: '+col);
 }
 const record=(await rc.list('belege')).items[0];
 const ft=await rc.api('/api/files/token',{});
 const restoredFile=await fetch(`${restored.url}/api/files/belege/${record.id}/${record.datei[0]}?token=${encodeURIComponent(ft.token)}`);
 if(!restoredFile.ok || createHash('sha256').update(Buffer.from(await restoredFile.arrayBuffer())).digest('hex')!==createHash('sha256').update(fileBytes).digest('hex'))throw new Error('Restored file hash mismatch');
 const restoreApp=await next(restored,43128);
 const login=new URLSearchParams({email:'upgrade@synthetic.invalid',password:secrets.password});
 const signed=await fetch(restoreApp.url+'/login/submit',{method:'POST',body:login,redirect:'manual'});
 const cookie=signed.headers.getSetCookie().find(c=>c.startsWith('zettelruhe_session='))?.split(';')[0];if(!cookie)throw new Error('Restore login failed');
 for(const path of ['/app','/app/belege','/app/journal']){const r=await fetch(restoreApp.url+path,{headers:{Cookie:cookie}});if(!r.ok)throw new Error('Restore page failed');}
 console.log('Synthetic f48be21 upgrade/restore: collections unchanged, file SHA-256 identical, login/dashboard/receipts/journal passed.');
 writeFileSync(join(temp,'session.json'),JSON.stringify({temp,prefix,app:app.url,pb:fresh.url,restoreApp:restoreApp.url,email:secrets.email,password:secrets.password,pbEmail:fresh.email,pbPassword:fresh.password}),{mode:0o600});
 console.log('Browser fixture: '+join(temp,'session.json'));
 if(process.argv.includes('--keep')){console.log('Fixture remains available for up to 60 minutes; SIGTERM removes only its own resources.');await pause(60*60*1000);}
}catch(error){console.error('Release smoke failed:',error instanceof Error?error.message.split('\n')[0].replace(/upsert .*/,'upsert <redacted>'):'unknown');process.exitCode=1;}
finally{cleanup();console.log('Release smoke resources removed.');}
