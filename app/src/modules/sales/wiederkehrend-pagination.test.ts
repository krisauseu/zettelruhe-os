import { describe, expect, it, vi } from 'vitest';
const list=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/pb',()=>({listRecords:list,pbEq:(k:string,v:string)=>`${k} = "${v}"`}));
import { listFaelligeWiederkehrende } from './wiederkehrend-repository';
describe('due template pagination',()=>{
 it('reads template 201 before processing shrinks the due set',async()=>{
  list.mockImplementation(async(_col,opts)=>({items:Array.from({length:opts.page===1?200:1},(_,i)=>({id:`${opts.page}-${i}`,firma:'f',aktiv:true,naechstes_datum:'2026-09-10',rhythmus:'monatlich'})),totalPages:2}));
  const result=await listFaelligeWiederkehrende('f','2026-09-10');expect(result).toHaveLength(201);expect(result[200].id).toBe('2-0');
 });
});
