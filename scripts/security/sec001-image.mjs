// Only UUID-named disposable resources, loopback ingress, internal network, synthetic files.
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import https from 'node:https';
import assert from 'node:assert/strict';
const image=process.env.SEC001_NEXT_IMAGE;
const reference=process.env.SEC001_CADDY_REFERENCE;
assert.ok(image && reference,'Set SEC001_NEXT_IMAGE and read-only SEC001_CADDY_REFERENCE');
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
assert.match(docker('context','inspect','--format','{{.Endpoints.docker.Host}}'),/^unix:\/\//);
const dir=mkdtempSync(join(tmpdir(),'sec001-image-')),prefix='zr-sec001-'+randomUUID(),containers=[];
let net=false,front=false;
try {
 docker('network','create','--internal',prefix);net=true;docker('network','create',prefix+'-front');front=true;
 docker('run','--rm','--network','none','--user','0','-v',dir+':/fixtures','--entrypoint','node',image,'-e',`const s=require('sharp');if(s.versions.heif!=='1.23.2')throw Error('Unexpected libheif '+s.versions.heif);Promise.all(['png','avif'].map(f=>s({create:{width:8,height:8,channels:3,background:'red'}}).toFormat(f).toFile('/fixtures/test.'+f)))`);
 writeFileSync(join(dir,'disguised.png'),readFileSync(join(dir,'test.avif')));
 writeFileSync(join(dir,'truncated.avif'),readFileSync(join(dir,'test.avif')).subarray(0,32));
 const start=(name,args)=>{const n=prefix+'-'+name;docker('run','-d','--name',n,...args);containers.push(n);return n;};
 const next=start('next',['--network',prefix,'--network-alias','next','-v',dir+':/app/public/sec001:ro','-e','JOBS_DISABLED=true','-e','PB_URL=http://127.0.0.1:1','-e','SESSION_SECRET='+randomUUID()+randomUUID(),image]);
 let config=readFileSync(resolve(reference),'utf8');
 assert.ok(config.includes('@image_optimizer path /_next/image') && config.includes('redir * /brand/zettelruhe-mark.png 302'));
 config=config.replace('{$PILOT_HOST_A}, {$PILOT_HOST_B} {','https://a.sec001.test, https://b.sec001.test {\n tls internal');
 writeFileSync(join(dir,'Caddyfile'),config);
 const proxy=start('proxy',['--network',prefix+'-front','-p','127.0.0.1::443','-v',dir+':/fixture:ro','--tmpfs','/data','--tmpfs','/config','-e','INSTANCE_INGRESS_TOKEN='+randomUUID()+randomUUID(),'caddy:2.10-alpine','caddy','run','--config','/fixture/Caddyfile','--adapter','caddyfile']);
 docker('network','connect',prefix,proxy);
 await new Promise(r=>setTimeout(r,500));
 const binding=docker('port',proxy,'443/tcp');assert.match(binding,/^127\.0\.0\.1:\d+$/);const port=Number(binding.split(':')[1]);
 const request=(path,method='GET')=>new Promise((resolve,reject)=>{const q=https.request({hostname:'127.0.0.1',port,servername:'a.sec001.test',rejectUnauthorized:false,path,method,headers:{Host:'a.sec001.test',Accept:'image/avif,image/webp,*/*'}},r=>{const b=[];r.on('data',c=>b.push(c));r.on('end',()=>resolve({status:r.statusCode,type:r.headers['content-type'],location:r.headers.location,bytes:Buffer.concat(b).length}));});q.on('error',reject);q.setTimeout(5000,()=>q.destroy(Error('timeout')));q.end();});
 for(let i=0;i<100;i++){try{if((await request('/brand/zettelruhe-mark.png')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const paths=['/_next/image','/_next/image/','//_next/image','/_next//image','/%5fnext/image','/_next/%69mage','/_next%2fimage','/_next/image%3f','/x/../_next/image'];
 let count=0;
 for(const path of paths)for(const file of ['test.avif','disguised.png','truncated.avif']) {
  const q='?url='+encodeURIComponent('/sec001/'+file)+'&w=64&q=75';
  const r=await request(path+q);assert.ok([302,307,308,400,403,404,503].includes(r.status),JSON.stringify({path,file,...r}));
  if(path==='/_next/image'){assert.equal(r.status,302);assert.equal(r.location,'/brand/zettelruhe-mark.png');}
  console.log(JSON.stringify({path,file,...r}));count++;
 }
 for(const method of ['HEAD','POST'])assert.equal((await request('/_next/image?url=%2Fsec001%2Ftest.avif&w=64&q=75',method)).status,302);
 for(const source of ['http://169.254.169.254/latest/meta-data/','http://pb:8090/api/health','/app/belege/synthetic/datei','/_next/image?url=/sec001/test.avif&w=64&q=75'])assert.equal((await request('/_next/image?url='+encodeURIComponent(source)+'&w=64&q=75')).status,302);
 const native=JSON.parse(docker('exec',next,'node','-e',`(async()=>{const r=await fetch('http://127.0.0.1:3000/_next/image?url=%2Fsec001%2Ftest.avif&w=64&q=75');console.log(JSON.stringify({status:r.status,type:r.headers.get('content-type')}))})()`));
 console.log(JSON.stringify({directPatchedOptimizer:native}));
 assert.ok([200,400,415].includes(native.status));
 console.log('PASS '+count+' manipulated image requests, HEAD/POST, SSRF/private/nested URLs; original proxy rule retained; libheif 1.23.2.');
} finally {for(const n of containers.reverse())docker('rm','-f',n);if(net)docker('network','rm',prefix);if(front)docker('network','rm',prefix+'-front');rmSync(dir,{recursive:true,force:true});}
