import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(()=>({list:vi.fn(),actor:vi.fn(),due:vi.fn(),generate:vi.fn(),acquire:vi.fn(),release:vi.fn(),start:vi.fn(),finish:vi.fn()}));
vi.mock('@/lib/pb',()=>({listRecords:mocks.list}));
vi.mock('@/lib/finanz-transaktion',()=>({finanzSystemAkteur:mocks.actor}));
vi.mock('@/modules/sales/wiederkehrend-repository',()=>({listFaelligeWiederkehrende:mocks.due,erzeugeFaelligeAusVorlage:mocks.generate}));
vi.mock('./lock',()=>({tryAcquireLock:mocks.acquire,releaseLock:mocks.release}));
vi.mock('./runs',()=>({startJobRun:mocks.start,finishJobRun:mocks.finish}));
import { runWiederkehrendTick } from './runner';
describe('recurring runner coverage',()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.acquire.mockResolvedValue({id:'lock'});mocks.actor.mockResolvedValue('actor');mocks.start.mockResolvedValue({id:'run'});mocks.due.mockResolvedValue([]);mocks.generate.mockResolvedValue({rechnungen:[{id:'draft'}]});});
 it('processes company 51 even when earlier companies have no due templates',async()=>{
  mocks.list.mockImplementation(async(_col,opts)=>({items:opts.page===1?Array.from({length:50},(_,i)=>({id:String(i)})):[{id:'51'}],totalPages:2}));
  mocks.due.mockImplementation(async id=>id==='51'?[{id:'last'}]:[]);
  const result=await runWiederkehrendTick();
  expect(result.erzeugt).toBe(1);expect(mocks.due).toHaveBeenCalledTimes(51);expect(mocks.generate).toHaveBeenCalledWith('51','last',expect.anything());
 });
 it('releases the lease after a listing failure and reports the failed run',async()=>{
  mocks.list.mockRejectedValue(new Error('Synthetic listing failure'));
  expect((await runWiederkehrendTick()).status).toBe('fehler');
  expect(mocks.release).toHaveBeenCalledOnce();expect(mocks.finish).toHaveBeenCalledWith('run','fehler',expect.any(String),expect.anything());
 });
 it('does not start work when the lease is held',async()=>{
  mocks.acquire.mockResolvedValue(null);
  expect((await runWiederkehrendTick()).acquired).toBe(false);expect(mocks.start).not.toHaveBeenCalled();
 });
});
