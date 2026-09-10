// Only accepts the manifest from test-release-smoke-isolated.mjs. Synthetic data only.
import { readFileSync, writeFileSync } from 'node:fs';
const path=process.argv[2];
if(!path || !/zettelruhe-release-smoke-[^/]+\/session\.json$/.test(path))throw new Error('Expected isolated release manifest');
const m=JSON.parse(readFileSync(path,'utf8'));
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(m.pb))throw new Error('Expected loopback PB');
const auth=await fetch(m.pb+'/api/collections/_superusers/auth-with-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identity:m.pbEmail,password:m.pbPassword})});
if(!auth.ok)throw new Error('Synthetic authentication failed');const {token}=await auth.json();
async function api(path,body,method='POST'){const r=await fetch(m.pb+path,{method,headers:{Authorization:token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error('Fixture API failure '+r.status+' '+path);return r.json();}
const create=(c,v)=>api('/api/collections/'+c+'/records',v);
const firma=(await api('/api/collections/firmen/records',null,'GET')).items[0];
const email='browser@synthetic.invalid',password='Synthetic-UI-Only-43127!';
const user=await create('users',{email,password,passwordConfirm:password,name:'Synthetic browser owner',role:'eigentuemer',firma:firma.id});
await create('mitgliedschaften',{firma:firma.id,user:user.id,rolle:'eigentuemer'});
const supplier=await create('kontakte',{firma:firma.id,name:'Synthetic Ireland Services',ist_lieferant:true,land:'IE',ausgaben_steuerstandard:'eu_dienstleistung'});
const customer=await create('kontakte',{firma:firma.id,name:'Synthetic customer',ist_kunde:true,strasse:'Musterweg 2',plz:'12345',ort:'Musterstadt',land:'DE'});
for(const [name,amount,date]of [['Software','100.00','2026-09-10'],['Büro','50.00','2026-09-10'],['Reisen','75.00','2026-08-10']]){
 await create('kategorien',{firma:firma.id,name,richtung:'ausgabe',aktiv:true});
 const values={firma:firma.id,status:'entwurf',belegdatum:date,buchungsdatum:date,richtung:'ausgabe',betrag_netto:amount,betrag_ust:'0.00',betrag_brutto:amount,steuersatz:'0',kategorie:name,notiz:'Synthetic '+name,konto:'',lieferant:'',kunde:''};
 const b=await create('belege',values),expected={...values,datei:[]};delete expected.firma;delete expected.status;
 await api('/internal/zettelruhe/finanz/v1/beleg/festschreiben',{firma:firma.id,akteur:user.id,id:b.id,expected});
}
const values={kunde:customer.id,rechnungsdatum:'2026-09-10',leistungszeitraum_von:'',leistungszeitraum_bis:'',faellig_am:'2026-09-24',notiz:'Synthetic release invoice',betrag_netto:'100.00',betrag_ust:'19.00',betrag_brutto:'119.00',steuermodus:'regelbesteuerung_ist'};
const draft=await api('/internal/zettelruhe/finanz/v1/rechnung/entwurf',{firma:firma.id,akteur:user.id,operation:'create',values,positionen:[{sortierung:1,bezeichnung:'Synthetic service',menge:'1',einheit:'Stk.',einzelpreis:'100.00',steuersatz:'19',betrag_netto:'100.00',betrag_ust:'19.00',betrag_brutto:'119.00',katalog_position:''}]});
const bank=await create('bankkonten',{firma:firma.id,name:'Synthetic bank',iban:'DE89370400440532013000'});
await create('bank_bewegungen',{firma:firma.id,bankkonto:bank.id,datum:'2026-09-10',betrag:'40.00',richtung:'eingang',status:'offen',idempotenz_schluessel:'synthetic-browser-match',verwendungszweck:'Synthetic release invoice'});
const ku=await create('firmen',{name:'Synthetic Kleinunternehmer',steuermodus:'kleinunternehmer',skr:'skr03',nummernkreise:firma.nummernkreise});
await create('mitgliedschaften',{firma:ku.id,user:user.id,rolle:'eigentuemer'});
await create('kontakte',{firma:ku.id,name:'Synthetic US Services',ist_lieferant:true,land:'US',ausgaben_steuerstandard:'drittland_dienstleistung'});
writeFileSync(path,JSON.stringify({...m,browserEmail:email,browserPassword:password,firma:firma.id,akteur:user.id,supplier:supplier.id,invoice:draft.rechnung.id,ku:ku.id}),{mode:0o600});
console.log('Synthetic browser fixtures created: two firms, category expenses, recurring/RC partners, invoice draft and bank movement.');
