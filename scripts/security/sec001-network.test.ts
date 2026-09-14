// Mounted as src/lib/sec001-network.test.ts only in the isolated Node 22 test image.
import { createServer as tcpServer } from 'node:net';
import { createServer as httpServer } from 'node:http';
import { once } from 'node:events';
import { afterEach, expect, it } from 'vitest';
import { sendMail } from './smtp';
import { evatrAbfrage } from '../modules/ustid/evatr';

afterEach(() => { for (const k of ['SMTP_HOST','SMTP_PORT','SMTP_FROM']) delete process.env[k]; });
it('delivers PDF bytes through real nodemailer SMTP to an isolated sink', async () => {
  let message = '';
  const server = tcpServer(socket => {
    socket.write('220 synthetic.invalid ESMTP\r\n');
    let buffer = '', data = false;
    socket.on('data', chunk => {
      buffer += chunk.toString();
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n'), line = buffer.slice(0,end); buffer = buffer.slice(end+2);
        if(data) { if(line === '.') { data=false; socket.write('250 queued\r\n'); } else message += line+'\r\n'; }
        else if(line.startsWith('EHLO')) socket.write('250 synthetic.invalid\r\n');
        else if(line === 'DATA') { data=true; socket.write('354 send message\r\n'); }
        else if(line === 'QUIT') socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    process.env.SMTP_HOST='127.0.0.1'; process.env.SMTP_PORT=String((server.address() as {port:number}).port); process.env.SMTP_FROM='sender@synthetic.invalid';
    const pdf=Buffer.from('%PDF-1.4\nSEC-001 synthetic\n%%EOF');
    const result=await sendMail({to:'recipient@synthetic.invalid',subject:'SEC-001',text:'Synthetic only',attachments:[{filename:'synthetic.pdf',content:pdf}]});
    expect(result.accepted).toEqual(['recipient@synthetic.invalid']);
    expect(message).toContain(pdf.toString('base64')); expect(message).toContain('application/pdf');
  } finally { await new Promise<void>(resolve=>server.close(()=>resolve())); }
});
it('uses real HTTP for BZSt response, malformed response and timeout handling', async () => {
  const seen: string[]=[];
  const server=httpServer((req,res)=> {
    let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
      seen.push(body);
      if(req.url?.includes('timeout')) return;
      res.setHeader('Content-Type','application/json');
      if(req.url?.includes('invalid')) {res.end('not json');return;}
      res.writeHead(404).end(JSON.stringify({status:'evatr-2001',id:'synthetic'}));
    });
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const baseUrl='http://127.0.0.1:'+(server.address() as {port:number}).port;
  const input={anfragendeUstid:'DE123456789',angefragteUstid:'ATU12345678'};
  try {
    expect((await evatrAbfrage(input,{baseUrl})).status).toBe('evatr-2001');
    expect(JSON.parse(seen[0])).toEqual(input);
    await expect(evatrAbfrage(input,{baseUrl:baseUrl+'/invalid'})).rejects.toThrow('Unerwartete Antwort');
    await expect(evatrAbfrage(input,{baseUrl:baseUrl+'/timeout',timeoutMs:30})).rejects.toThrow('nicht rechtzeitig');
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
