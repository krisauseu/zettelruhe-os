/* Real HTTP regression through local Caddy. Run via test-pocketbase-isolation.sh.
 * Secrets stay in memory; only synthetic records are mutated and cleaned up.
 * Superuser is used for setup/control, never as the normal-user test identity.
 */
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');

async function main() {
  assert.equal(process.env.PB_URL, 'http://pocketbase:8090', 'Local PB target required');
  assert.equal(process.env.APP_URL, 'http://localhost', 'Local App target required');
  const base = 'http://caddy';
  const marker = `ISOLATION-TP020-${randomBytes(6).toString('hex')}`;
  const cleanup = [];
  const results = [];
  let admin;
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  async function request(path, { token, cookie, method = 'GET', body } = {}) {
    assert.ok(path.startsWith('/') && !path.startsWith('//'));
    const headers = { Host: 'localhost', Origin: 'http://localhost' };
    if (token) headers.Authorization = token;
    if (cookie) headers.Cookie = cookie;
    if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
      headers['Content-Type'] = 'application/json'; body = JSON.stringify(body);
    }
    return fetch(base + path, { method, headers, body, redirect: 'manual' });
  }
  async function json(path, opts) {
    const r = await request(path, opts);
    if (!r.ok) throw Error(`Setup/control request failed: ${r.status} ${path.split('?')[0]}`);
    return r.json();
  }
  const records = c => `/api/collections/${c}/records`;
  async function create(c, body) {
    const r = await json(records(c), { token: admin, method: 'POST', body });
    cleanup.push([c, r.id]); return r;
  }
  function check(group, label, ok, actual) { results.push({ group, label, ok, actual }); }
  function multipart(values, field, bytes = png, type = 'image/png', filename = 'isolation.png') {
    const fd = new FormData();
    for (const [k,v] of Object.entries(values)) fd.set(k, String(v));
    fd.set(field, new Blob([bytes], { type }), filename); return fd;
  }
  try {
    admin = (await json('/api/collections/_superusers/auth-with-password', { method: 'POST', body: {
      identity: process.env.PB_SUPERUSER_EMAIL, password: process.env.PB_SUPERUSER_PASSWORD,
    }})).token;
    const schema = (await json('/api/collections?perPage=200', { token: admin })).items.filter(c => !c.system);
    const firms = (await json(records('firmen') + '?sort=id', { token: admin })).items;
    assert.equal(firms.length, 2, 'Exactly two existing test firms required');
    const [a,b] = firms;
    const accounts = [];
    for (const [label, memberships] of [
      ['A-lesen', [[a,'lesen']]], ['A-bearbeiten', [[a,'bearbeiten']]],
      ['B-lesen', [[b,'lesen']]], ['B-bearbeiten', [[b,'bearbeiten']]],
      ['AB', [[a,'eigentuemer'],[b,'lesen']]], ['ohne-Mitgliedschaft', []],
    ]) {
      const password = randomBytes(24).toString('base64url');
      const email = `${marker}-${label}@example.invalid`.toLowerCase();
      const user = await create('users', multipart({ email, password, passwordConfirm: password,
        name: `${marker} ${label}`, role: 'nutzer', firma: memberships[0]?.[0].id || '', verified: true }, 'avatar'));
      for (const [firma,rolle] of memberships) await create('mitgliedschaften', { user: user.id, firma: firma.id, rolle });
      const auth = await json('/api/collections/users/auth-with-password', { method:'POST', body:{identity:email,password} });
      check('auth', label, auth.record.id === user.id && !!auth.token, 'PB password login');
      const fileToken = (await json('/api/files/token', { token:auth.token, method:'POST' })).token;
      const login = await request('/login/submit', {method:'POST', body:new URLSearchParams({email,password})});
      const cookie = login.headers.getSetCookie().find(s=>s.startsWith('zettelruhe_session='))?.split(';')[0];
      check('next', `${label} login`, login.status === 303 && !!cookie, login.status);
      accounts.push({label,token:auth.token,fileToken,cookie,user,memberships});
      const own=await json(records('users')+'/'+user.id+'?expand=firma', {token:auth.token});
      check('auth',`${label} own record without firm expansion`,own.id===user.id&&!own.expand?.firma,200);
      const refreshed=await json('/api/collections/users/auth-refresh?expand=firma', {token:auth.token,method:'POST'});
      check('auth',`${label} auth refresh without firm expansion`,refreshed.record.id===user.id&&!refreshed.record.expand?.firma,200);
      const avatar=await request(`/api/files/users/${user.id}/${user.avatar}?token=${encodeURIComponent(fileToken)}`);
      check('auth',`${label} own protected avatar`,avatar.ok&&Buffer.from(await avatar.arrayBuffer()).equals(png),avatar.status);
    }
    const receipts = [];
    for (const firma of firms) {
      const contact = await create('kontakte', { firma:firma.id, name:marker, ist_kunde:true, ist_lieferant:true });
      const receipt = await create('belege', multipart({ firma:firma.id, belegdatum:'2026-09-05', richtung:'ausgabe',
        status:'entwurf', betrag_netto:'1.00', betrag_ust:'0.00', betrag_brutto:'1.00', steuersatz:'0', notiz:marker,
        lieferant:contact.id }, 'datei'));
      receipts.push(receipt);
      // Known IDs also for the two initially empty collections. No external BZSt call.
      await create('fahrten',{firma:firma.id,kunde:contact.id,datum:'2026-09-05',km:'1',status:'nicht_abrechenbar',notiz:marker});
      await create('ust_id_pruefungen',{firma:firma.id,ziel_typ:'kontakt',ziel_id:contact.id,art:'einfach',
        anfragende_ust_id:'DE000000000',abgefragte_ust_id:'ATU00000000',status:marker});
    }
    const guests = [{label:'anonym'}, ...accounts];
    // Every collection: list, filter, known IDs, expansions; sample IDs are read-only.
    for (const col of schema) {
      const sample = (await json(records(col.name)+'?perPage=1', {token:admin})).items[0];
      for (const actor of guests) {
        for (const suffix of ['', '?filter='+encodeURIComponent(`id != ''`)+'&expand=firma,user,lieferant',
          ...(sample ? [`/${sample.id}?expand=firma,user,lieferant`] : [])]) {
          const r = await request(records(col.name)+suffix, actor);
          // Own users record remains readable; no business collection is a direct client API.
          if (col.name === 'users') {
            const body = r.ok ? await r.json() : {};
            const returned = body.items || (body.id ? [body] : []);
            check('read',`${actor.label} ${col.name}${suffix.startsWith('/')?'/id':'/list'}`,
              returned.every(v=>v.id===actor.user?.id) && returned.every(v=>!v.expand?.firma), r.status);
          } else {
            check('read',`${actor.label} ${col.name}${suffix.startsWith('/')?'/id':'/list'}`,r.status===403,r.status);
          }
        }
        // Empty payload cannot create a record even if a rule regresses; status must be locked (403), not validation (400).
        if (col.name !== 'users') {
          const r = await request(records(col.name), {...actor,method:'POST',body:{}});
          check('write',`${actor.label} create ${col.name}`,r.status===403,r.status);
        }
      }
      for (const rule of ['createRule','updateRule','deleteRule']) check('schema',`${col.name}.${rule}`,col[rule]===null,'locked');
      for (const f of col.fields.filter(f=>f.type==='file')) check('schema',`${col.name}.${f.name} protected`,f.protected===true,f.protected);
    }
    // Cross-firm targeted filters and relation expansion from a known receipt.
    for (const actor of guests) for (const rec of receipts) {
      for (const path of [records('belege')+'?filter='+encodeURIComponent(`firma="${rec.firma}"`),
        records('belege')+`/${rec.id}?expand=firma,lieferant,lieferant.firma`]) {
        const r=await request(path,actor);
        check('cross-firm',`${actor.label} receipt ${rec.firma===a.id?'A':'B'}`,r.status===403,r.status);
      }
    }
    // Files: all existing file fields, including originals and configured thumbnails.
    // Superuser discovers URLs only. No file response is printed or saved.
    let filesChecked = 0;
    for (const col of schema.filter(c=>c.fields.some(f=>f.type==='file'))) {
      const rows = (await json(records(col.name)+'?perPage=500', {token:admin})).items;
      for (const field of col.fields.filter(f=>f.type==='file')) {
        const row=rows.find(r=>Array.isArray(r[field.name])?r[field.name].length:r[field.name]);
        if (!row) continue;
        const filename=Array.isArray(row[field.name])?row[field.name][0]:row[field.name];
        filesChecked++;
        const nextPath = {
          firmen: '/app/firma/logo',
          belege: `/app/belege/${row.id}/datei?name=${encodeURIComponent(filename)}`,
          rechnungen: `/app/rechnungen/${row.id}/pdf`,
          angebote: `/app/angebote/${row.id}/pdf`,
          e_rechnungen_empfang: `/app/e-rechnungen/${row.id}/datei`,
          e_rechnungen_versand: `/app/rechnungen/${row.rechnung}/e-rechnung/${row.id}`,
        }[col.name];
        if(nextPath) {
          const firmaId=col.name==='firmen'?row.id:row.firma;
          const member=accounts.find(actor=>actor.memberships.length===1&&actor.memberships[0][0].id===firmaId);
          assert.ok(member,'A file-owning firm needs a test member');
          // Control bytes are never used as evidence of normal-user authorization.
          const serviceFileToken=(await json('/api/files/token',{token:admin,method:'POST'})).token;
          const control=await request(`/api/files/${col.name}/${row.id}/${encodeURIComponent(filename)}?token=${encodeURIComponent(serviceFileToken)}`);
          assert.ok(control.ok,'Existing file must be readable for comparison');
          const expected=Buffer.from(await control.arrayBuffer());
          const allowed=await request(nextPath,{cookie:member.cookie});
          check('next',`${col.name} original download`,allowed.ok&&Buffer.from(await allowed.arrayBuffer()).equals(expected),allowed.status);
          check('next',`${col.name} private response`,allowed.headers.get('cache-control')?.includes('private')&&!allowed.headers.has('location'),allowed.status);
          const anonymous=await request(nextPath);
          check('next',`${col.name} anonymous download`,anonymous.status>=300&&anonymous.status<400,anonymous.status);
          if(col.name!=='firmen') {
            const foreign=accounts.find(actor=>actor.memberships.length===1&&actor.memberships[0][0].id!==firmaId);
            const denied=await request(nextPath,{cookie:foreign.cookie});
            check('next',`${col.name} foreign download`,denied.status===404,denied.status);
          }
        }
        for (const actor of guests) for (const suffix of ['', '?thumb='+(field.thumbs?.[0]||'200x200'), '?download=1']) {
          const path=`/api/files/${col.name}/${row.id}/${encodeURIComponent(filename)}${suffix}`;
          const r=await request(path,actor);
          const ownAvatar=col.name==='users' && actor.user?.id===row.id;
          check('files',`${actor.label} ${col.name}.${field.name} ${suffix||'original'}`,
            ownAvatar ? [200,403,404].includes(r.status) : [403,404].includes(r.status),r.status);
          if (actor.fileToken) {
            const ft=await request(path+(suffix?'&':'?')+'token='+encodeURIComponent(actor.fileToken));
            check('files',`${actor.label} file-token ${col.name}.${field.name}`,
              ownAvatar ? ft.ok : [403,404].includes(ft.status),ft.status);
          }
        }
      }
    }
    console.log(`File fields with actual HTTP fixtures: ${filesChecked}`);
    check('files','all seven file fields have an HTTP fixture',filesChecked===7,filesChecked);
    // Valid writes exclusively against disposable records; detect self-role escalation too.
    for (const actor of guests) {
      const body={firma:b.id,belegdatum:'2026-09-05',richtung:'ausgabe',status:'entwurf',betrag_netto:'1',betrag_ust:'0',betrag_brutto:'1',notiz:marker};
      const cr=await request(records('belege'),{...actor,method:'POST',body});
      if(cr.ok) cleanup.push(['belege',(await cr.json()).id]);
      check('write',`${actor.label} valid create B`,cr.status===403,cr.status);
      for (const rec of receipts) for (const [method,payload] of [['PATCH',{notiz:marker+'-changed',firma:b.id}],['DELETE',undefined]]) {
        const r=await request(records('belege')+'/'+rec.id,{...actor,method,body:payload});
        check('write',`${actor.label} ${method} receipt`,r.status===403,r.status);
      }
      if(actor.user) {
        const r=await request(records('users')+'/'+actor.user.id,{...actor,method:'PATCH',body:{role:'eigentuemer',firma:b.id}});
        check('write',`${actor.label} self escalation`,r.status===403,r.status);
      }
      const fileWrite=await request(records('belege')+'/'+receipts[1].id,
        {...actor,method:'PATCH',body:multipart({},'datei')});
      check('write',`${actor.label} direct file replacement B`,fileWrite.status===403,fileWrite.status);
      const membership=await json(records('mitgliedschaften')+'?filter='+encodeURIComponent(`user="${accounts[0].user.id}"`),{token:admin});
      const roleWrite=await request(records('mitgliedschaften')+'/'+membership.items[0].id,
        {...actor,method:'PATCH',body:{rolle:'eigentuemer',firma:b.id}});
      check('write',`${actor.label} membership escalation`,roleWrite.status===403,roleWrite.status);
    }
    // Next cookie has no meaning for the PB API; PB token has no meaning for Next.
    const reader=accounts[0], editor=accounts[1], dual=accounts[4];
    let r=await request(records('belege'),{cookie:reader.cookie});
    check('auth','Next cookie at PB',r.status===403,r.status);
    r=await request(`/app/belege/${receipts[0].id}/datei`,{token:reader.token});
    check('auth','PB token at Next',r.status>=300&&r.status<400,r.status);
    for(const actor of accounts.filter(x=>x.memberships.length)) {
      for(const rec of receipts) {
        const allowed=actor.memberships[0][0].id===rec.firma;
        const r=await request(`/app/belege/${rec.id}/datei`,{cookie:actor.cookie});
        const data=Buffer.from(await r.arrayBuffer());
        check('next',`${actor.label} download ${rec.firma===a.id?'A':'B'}`,
          allowed ? r.ok&&data.equals(png) : r.status===404,r.status);
      }
      const page=await request('/app/belege',{cookie:actor.cookie});
      const html=await page.text();
      const own=receipts.find(rec=>rec.firma===actor.memberships[0][0].id);
      const other=receipts.find(rec=>rec.firma!==actor.memberships[0][0].id);
      check('next',`${actor.label} receipt list`,page.ok&&html.includes(own.id)&&!html.includes(other.id),page.status);
    }
    for(const actor of [reader,dual]) {
      const sw=await request('/app/firma/wechseln',{cookie:actor.cookie,method:'POST',body:new URLSearchParams({firmaId:b.id})});
      const changed=sw.headers.getSetCookie().find(s=>s.startsWith('zettelruhe_session='))?.split(';')[0];
      check('next',`${actor.label} switch B`,actor===dual ? !!changed : !changed&&!!sw.headers.get('location')?.includes('error='),sw.status);
      if(changed) {
        const dl=await request(`/app/belege/${receipts[1].id}/datei`,{cookie:changed});
        check('next','AB download after switch',dl.ok&&Buffer.from(await dl.arrayBuffer()).equals(png),dl.status);
        const old=await request(`/app/belege/${receipts[0].id}/datei`,{cookie:changed});
        check('next','AB old firm after switch',old.status===404,old.status);
      }
    }
    // Submit the server-rendered Next action form, with the real action reference.
    const page=await request('/app/belege/neu',{cookie:editor.cookie});
    const html=await page.text();
    const form=[...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)].map(m=>m[1]).find(s=>s.includes('name="belegdatum"'));
    assert.ok(form,'Upload form must exist');
    const fd=multipart({belegdatum:'2026-09-05',richtung:'ausgabe',betrag_brutto:'1.00',steuersatz:'0',bezeichnung:marker},'datei');
    for(const tag of form.matchAll(/<input\b[^>]*>/g)) {
      const name=tag[0].match(/name="([^"]+)"/)?.[1];
      if(name?.startsWith('$ACTION_')) fd.set(name,tag[0].match(/value="([^"]*)"/)?.[1]?.replaceAll('&quot;','"').replaceAll('&amp;','&')||'');
    }
    assert.ok([...fd.keys()].some(k=>k.startsWith('$ACTION_')),'Rendered action reference required');
    const upload=await request('/app/belege/neu',{cookie:editor.cookie,method:'POST',body:fd});
    const id=upload.headers.get('location')?.match(/\/app\/belege\/([a-z0-9]{15})\?created=1/)?.[1];
    check('next','editor multipart upload',upload.status===303&&!!id,upload.status);
    if(id) {
      cleanup.push(['belege',id]);
      const record=await json(records('belege')+'/'+id,{token:admin});
      check('next','upload belongs to active firm',record.firma===a.id,record.firma===a.id);
      const dl=await request(`/app/belege/${id}/datei`,{cookie:reader.cookie});
      check('next','reader downloads Next upload',dl.ok&&Buffer.from(await dl.arrayBuffer()).equals(png),dl.status);
    }
    const denied=await request('/app/belege/neu',{cookie:reader.cookie,method:'POST',body:fd});
    const unexpectedId=denied.headers.get('location')?.match(/\/app\/belege\/([a-z0-9]{15})\?created=1/)?.[1];
    if(unexpectedId) cleanup.push(['belege',unexpectedId]);
    check('next','reader upload forbidden',denied.status===303&&!!denied.headers.get('location')?.includes('error='),denied.status);
  } finally {
    for(const [c,id] of cleanup.reverse()) {
      const r=await request(records(c)+'/'+id,{token:admin,method:'DELETE'});
      if(![204,404].includes(r.status)) throw Error(`Fixture cleanup failed: ${c}/${id} (${r.status})`);
    }
    console.log(`Synthetic records cleaned: ${cleanup.length}`);
    for(const group of [...new Set(results.map(r=>r.group))]) {
      const rows=results.filter(r=>r.group===group);
      console.log(`${group}: ${rows.filter(r=>r.ok).length}/${rows.length} passed`);
    }
    const failed=results.filter(r=>!r.ok);
    for(const row of failed.slice(0,15)) console.log(`FAIL ${row.group} ${row.label}; actual=${row.actual}`);
    console.log(`TOTAL ${results.length-failed.length}/${results.length}; failures=${failed.length}`);
    if(failed.length) process.exitCode=1;
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
