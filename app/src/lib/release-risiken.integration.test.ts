/** Release regressions. Run only through the disposable PB starter. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createRecord, getRecord, updateRecord, listRecords, pbEq, DEFAULT_NUMMERNKREISE } from './pb';
import { createRechnung, festschreibenRechnung, storniereRechnung as cancelInvoice } from '@/modules/sales/repository';
import { createZahlung as createPayment, deleteZahlung as deletePayment } from '@/modules/payments/repository';
import { createWiederkehrendeRechnung, erzeugeFaelligeAusVorlage } from '@/modules/sales/wiederkehrend-repository';
import { matchBewegungToRechnung as matchMovement } from '@/modules/banking/repository';
import { tryAcquireLock, releaseLock } from '@/modules/jobs/lock';
const session = vi.hoisted(() => ({ firmaId: '', userId: '' }));

const realFetch = globalThis.fetch;
let firma: string, kunde: string;
const datum = '2026-09-10';
const createZahlung = (f: string, input: Parameters<typeof createPayment>[1], opts: Parameters<typeof createPayment>[2] = {}) => createPayment(f,input,{...opts,akteur:session.userId});
const deleteZahlung = (f: string,id: string) => deletePayment(f,id,{akteur:session.userId});
const storniereRechnung = (f: string,id: string) => cancelInvoice(f,id,{akteur:session.userId});
const matchBewegungToRechnung = (f: string,id: string,r: string) => matchMovement(f,id,r,{akteur:session.userId});

async function rows(col: string) { return (await listRecords<{id: string; [key: string]: unknown}>(col, {filter: pbEq('firma',firma),perPage:500})).items; }
async function invoice() {
 const r=await createRechnung(firma,{kunde,rechnungsdatum:datum,positionen:[{bezeichnung:'Synthetic service',menge:'1',einzelpreis:'100',steuersatz:''}]},{akteur:session.userId});
 await festschreibenRechnung(firma,r.id,{akteur:session.userId}); return r;
}
function failOnce(path: string, method: string) {
 let failed=false;
 vi.stubGlobal('fetch',async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
  if (!failed && String(url).includes(path) && init?.method === method) { failed=true; throw new Error('INJECT release write failure'); }
  return realFetch(url,init);
 });
}
describe.skipIf(process.env.TP022_ISOLATED !== '1')('Release failure and concurrency cases',()=>{
 beforeEach(async()=>{
  vi.stubGlobal('fetch',realFetch);
  firma=(await createRecord<{id:string}>('firmen',{name:'Synthetic release '+randomUUID(),steuermodus:'kleinunternehmer',skr:'skr03',nummernkreise:structuredClone(DEFAULT_NUMMERNKREISE)})).id;
  kunde=(await createRecord<{id:string}>('kontakte',{firma,name:'Synthetic customer',ist_kunde:true})).id;
  const password=randomUUID();
  session.firmaId=firma;
  session.userId=(await createRecord<{id:string}>('users',{email:randomUUID()+'@synthetic.invalid',password,passwordConfirm:password,role:'eigentuemer',firma})).id;
  await createRecord('mitgliedschaften',{firma,user:session.userId,rolle:'eigentuemer'});
 });
 afterEach(()=>vi.unstubAllGlobals());
 it('expired lock takeover has exactly one winner, old release cannot clear it',async()=>{
  const key='release-'+randomUUID();
  const old=await tryAcquireLock(key,'old');
  await updateRecord('job_locks',old!.id,{expires_at:'2020-01-01T00:00:00.000Z'});
  const locks=await Promise.all(['a','b'].map(holder=>tryAcquireLock(key,holder)));
  expect(locks.filter(Boolean)).toHaveLength(1);
  await releaseLock(key,'old');
  expect(await tryAcquireLock(key,'c')).toBeNull();
 });
 it('same holder cannot acquire an unexpired lock twice',async()=>{
  const key='release-'+randomUUID();
  await tryAcquireLock(key,'same');
  expect(await tryAcquireLock(key,'same')).toBeNull();
 });
 it('recurring failure after draft creation never duplicates an occurrence',async()=>{
  const v=await createWiederkehrendeRechnung(firma,{bezeichnung:'Synthetic recurring',kunde,naechstes_datum:datum,rhythmus:'monatlich',aktiv:true,positionen:[{bezeichnung:'Service',menge:'1',einzelpreis:'100',steuersatz:''}]});
  failOnce('/collections/wiederkehrende_rechnungen/records/'+v.id,'PATCH');
  await erzeugeFaelligeAusVorlage(firma,v.id,{heute:datum,akteur:session.userId}).catch(()=>undefined);
  vi.stubGlobal('fetch',realFetch);
  await erzeugeFaelligeAusVorlage(firma,v.id,{heute:datum,akteur:session.userId}).catch(()=>undefined);
  expect(await rows('rechnungen')).toHaveLength(1);
  expect((await getRecord<{naechstes_datum:string}>('wiederkehrende_rechnungen',v.id)).naechstes_datum).toBe('2026-10-10');
 });
 it('parallel recurring requests create one occurrence',async()=>{
  const v=await createWiederkehrendeRechnung(firma,{bezeichnung:'Synthetic recurring',kunde,naechstes_datum:datum,rhythmus:'monatlich',aktiv:true,positionen:[{bezeichnung:'Service',menge:'1',einzelpreis:'100',steuersatz:''}]});
  await Promise.allSettled([1,2].map(()=>erzeugeFaelligeAusVorlage(firma,v.id,{heute:datum,akteur:session.userId})));
  expect(await rows('rechnungen')).toHaveLength(1);
 });
 it('bank match failure and replay cannot book the movement twice',async()=>{
  const r=await invoice();
  const konto=await createRecord<{id:string}>('bankkonten',{firma,name:'Synthetic bank',iban:'DE89370400440532013000'});
  const bew=await createRecord<{id:string}>('bank_bewegungen',{firma,bankkonto:konto.id,datum,betrag:'40.00',richtung:'eingang',status:'offen',idempotenz_schluessel:randomUUID()});
  failOnce('/collections/bank_bewegungen/records/'+bew.id,'PATCH');
  await matchBewegungToRechnung(firma,bew.id,r.id).catch(()=>undefined);
  vi.stubGlobal('fetch',realFetch);
  await matchBewegungToRechnung(firma,bew.id,r.id).catch(()=>undefined);
  expect(await rows('zahlungen')).toHaveLength(1);
  expect((await getRecord<{status:string}>('bank_bewegungen',bew.id)).status).toBe('gematcht');
 });
 it('parallel payments cannot overpay',async()=>{
  const r=await invoice();
  const results=await Promise.allSettled([1,2].map(()=>createZahlung(firma,{rechnung:r.id,datum,betrag:'60.00'})));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(await rows('zahlungen')).toHaveLength(1);
 });
 it('failed payment deletion leaves either active payment and journal or neither',async()=>{
  const r=await invoice(); const {zahlung}=await createZahlung(firma,{rechnung:r.id,datum,betrag:'40'});
  failOnce('/collections/zahlungen/records/'+zahlung.id,'DELETE');
  await deleteZahlung(firma,zahlung.id).catch(()=>undefined);
  vi.stubGlobal('fetch',realFetch);
  const payments=await rows('zahlungen'), journal=await rows('buchungsjournal');
  const originals=journal.filter(j=>j.quelle_typ==='zahlung');
  const active=originals.filter(j=>!journal.some(s=>s.storno_von===j.id));
  expect(active.length).toBe(payments.length);
 });
 it('invoice cancellation replay has one reversal per original',async()=>{
  const r=await invoice(); await createZahlung(firma,{rechnung:r.id,datum,betrag:'40'});
  await Promise.allSettled([1,2].map(()=>storniereRechnung(firma,r.id)));
  const journal=await rows('buchungsjournal');
  for(const j of journal.filter(j=>j.quelle_typ==='rechnung'||j.quelle_typ==='zahlung')) expect(journal.filter(s=>s.storno_von===j.id)).toHaveLength(1);
  expect((await getRecord<{status:string}>('rechnungen',r.id)).status).toBe('storniert');
 });
 it('rolls back the draft if advancing the template fails inside PB',async()=>{
  const v=await createWiederkehrendeRechnung(firma,{bezeichnung:'Synthetic recurring',kunde,naechstes_datum:datum,rhythmus:'monatlich',aktiv:true,positionen:[{bezeichnung:'Service',menge:'1',einzelpreis:'100',steuersatz:''}]});
  await updateRecord('firmen',firma,{name:'Release-fail-wiederkehrende_rechnungen-'+firma});
  await expect(erzeugeFaelligeAusVorlage(firma,v.id,{heute:datum,akteur:session.userId})).rejects.toThrow();
  expect(await rows('rechnungen')).toHaveLength(0);
  await updateRecord('firmen',firma,{name:'Synthetic repaired '+firma});
  await erzeugeFaelligeAusVorlage(firma,v.id,{heute:datum,akteur:session.userId});
  expect(await rows('rechnungen')).toHaveLength(1);
 });
 it('rolls back payment and journal when the bank link fails',async()=>{
  const r=await invoice();
  const konto=await createRecord<{id:string}>('bankkonten',{firma,name:'Synthetic bank',iban:'DE89370400440532013000'});
  const bew=await createRecord<{id:string}>('bank_bewegungen',{firma,bankkonto:konto.id,datum,betrag:'40.00',richtung:'eingang',status:'offen',idempotenz_schluessel:randomUUID()});
  await updateRecord('firmen',firma,{name:'Release-fail-bank_bewegungen-'+firma});
  await expect(matchBewegungToRechnung(firma,bew.id,r.id)).rejects.toThrow();
  expect(await rows('zahlungen')).toHaveLength(0);expect((await rows('buchungsjournal')).filter(j=>j.quelle_typ==='zahlung')).toHaveLength(0);
  await updateRecord('firmen',firma,{name:'Synthetic repaired '+firma});
  const matches=await Promise.all([1,2].map(()=>matchBewegungToRechnung(firma,bew.id,r.id)));
  expect(matches[0].zahlungId).toBe(matches[1].zahlungId);expect(await rows('zahlungen')).toHaveLength(1);
  await deleteZahlung(firma,matches[0].zahlungId);
  expect((await getRecord<{status:string}>('bank_bewegungen',bew.id)).status).toBe('offen');
 });
 it('rolls back reversals when payment deletion fails, then allows replay',async()=>{
  const r=await invoice();const {zahlung}=await createZahlung(firma,{rechnung:r.id,datum,betrag:'40'});
  await updateRecord('firmen',firma,{name:'Release-fail-delete-'+firma});
  await expect(deleteZahlung(firma,zahlung.id)).rejects.toThrow();
  expect(await rows('zahlungen')).toHaveLength(1);expect((await rows('buchungsjournal')).filter(j=>j.storno_von)).toHaveLength(0);
  await updateRecord('firmen',firma,{name:'Synthetic repaired '+firma});
  await deleteZahlung(firma,zahlung.id);await deleteZahlung(firma,zahlung.id);
  expect(await rows('zahlungen')).toHaveLength(0);expect((await rows('buchungsjournal')).filter(j=>j.storno_von)).toHaveLength(1);
 });
 it('rolls back invoice reversals if the final status write fails',async()=>{
  const r=await invoice();await createZahlung(firma,{rechnung:r.id,datum,betrag:'40'});
  await updateRecord('firmen',firma,{name:'Release-fail-rechnungen-'+firma});
  await expect(storniereRechnung(firma,r.id)).rejects.toThrow();
  expect((await rows('buchungsjournal')).filter(j=>j.storno_von)).toHaveLength(0);
  expect((await getRecord<{status:string}>('rechnungen',r.id)).status).toBe('teilbezahlt');
  await updateRecord('firmen',firma,{name:'Synthetic repaired '+firma});
  await storniereRechnung(firma,r.id);await storniereRechnung(firma,r.id);
  expect((await rows('buchungsjournal')).filter(j=>j.storno_von)).toHaveLength(2);
 });
 it('does not persist half a multi-rate payment journal',async()=>{
  await updateRecord('firmen',firma,{steuermodus:'regelbesteuerung_ist'});
  const r=await createRechnung(firma,{kunde,rechnungsdatum:datum,positionen:[{bezeichnung:'Low',menge:'1',einzelpreis:'100',steuersatz:'7'},{bezeichnung:'Standard',menge:'1',einzelpreis:'100',steuersatz:'19'}]},{akteur:session.userId});
  await festschreibenRechnung(firma,r.id,{akteur:session.userId});
  await updateRecord('firmen',firma,{name:'Release-fail-journal-'+firma});
  await expect(createZahlung(firma,{rechnung:r.id,datum,betrag:'226'})).rejects.toThrow();
  expect(await rows('zahlungen')).toHaveLength(0);expect((await rows('buchungsjournal')).filter(j=>j.quelle_typ==='zahlung')).toHaveLength(0);
  await updateRecord('firmen',firma,{name:'Synthetic repaired '+firma});
  await createZahlung(firma,{rechnung:r.id,datum,betrag:'113'});await createZahlung(firma,{rechnung:r.id,datum,betrag:'113'});
  const journal=(await rows('buchungsjournal')).filter(j=>j.quelle_typ==='zahlung');
  expect(journal).toHaveLength(4);expect(journal.reduce((n,j)=>n+Math.round(Number(j.betrag_ust)*100),0)).toBe(2600);
 });
 it('replays a committed payment after a lost response and rejects changed payload',async()=>{
  const r=await invoice();let lost=false;
  vi.stubGlobal('fetch',async(url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
    const response=await realFetch(url,init);
    if(!lost && String(url).endsWith('/zahlung/anlegen') && response.ok){lost=true;throw new Error('INJECT lost committed response');}
    return response;
  });
  const id='releasepay00001';
  await createZahlung(firma,{rechnung:r.id,datum,betrag:'40'},{id});
  await createZahlung(firma,{rechnung:r.id,datum,betrag:'40'},{id});
  expect(await rows('zahlungen')).toHaveLength(1);
  await expect(createZahlung(firma,{rechnung:r.id,datum,betrag:'41'},{id})).rejects.toThrow();
 });
 it('serializes a new payment against invoice cancellation',async()=>{
  const r=await invoice();
  await Promise.allSettled([createZahlung(firma,{rechnung:r.id,datum,betrag:'40'}),storniereRechnung(firma,r.id)]);
  expect((await getRecord<{status:string}>('rechnungen',r.id)).status).toBe('storniert');
  const journal=await rows('buchungsjournal');
  for(const original of journal.filter(j=>j.quelle_typ==='zahlung')) expect(journal.filter(j=>j.storno_von===original.id)).toHaveLength(1);
  await expect(updateRecord('rechnungen',r.id,{status:'offen'})).rejects.toThrow();
 });

});
