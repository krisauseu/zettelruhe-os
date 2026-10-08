import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const tick=vi.hoisted(()=>vi.fn());
const setup=vi.hoisted(()=>vi.fn());
vi.mock('./runner',()=>({runWiederkehrendTick:tick}));
vi.mock('@/lib/initial-setup',()=>({getInitialSetup:setup}));
import { getInstanceContext, type InstanceContext } from '@/lib/instance-context';
import { startInProcessScheduler } from './scheduler';
describe('scheduler overlap',()=>{
 beforeEach(()=>{setup.mockResolvedValue(null);vi.stubEnv('INSTANCE_MODE','selfhost');});
 afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();tick.mockReset();setup.mockReset();globalThis.__zettelruhe_scheduler_started=false;globalThis.__zettelruhe_scheduler_running=false;globalThis.__zettelruhe_scheduler_timer=undefined;});
 it('skips interval callbacks while the preceding tick is still running and resumes afterwards',async()=>{
  vi.useFakeTimers();vi.stubEnv('JOBS_DISABLED','false');vi.stubEnv('JOB_TICK_INTERVAL_MS','60000');vi.spyOn(console,'info').mockImplementation(()=>{});
  let finish!: (value:unknown)=>void;
  tick.mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValue({status:'ok',erzeugt:0});
  startInProcessScheduler();await vi.advanceTimersByTimeAsync(180000);expect(tick).toHaveBeenCalledTimes(1);
  finish({status:'ok',erzeugt:0});await vi.advanceTimersByTimeAsync(60000);expect(tick).toHaveBeenCalledTimes(2);
 });
});

describe('scheduler initial setup',()=>{
 const hostname='setup-a.app.synthetic.invalid';
 const context: InstanceContext={tenantId:'t_setupaaaa',pocketbaseUrl:'http://pb-setup-a:8090',appUrl:`https://${hostname}`,configVersion:1,sessionVersion:1,sessionSecret:'synthetic-session-secret-setup-32-characters',adminEmail:'scheduler@synthetic.invalid',adminPassword:'synthetic-only',smtp:null};
 const state={id:'initialsetup001',eigentuemer:'setupowner00001',firma:'setupfirma00001',status:'pending'};
 let order: string[];
 beforeEach(()=>{
  vi.useFakeTimers();vi.stubEnv('JOBS_DISABLED','false');vi.stubEnv('JOB_TICK_INTERVAL_MS','60000');
  vi.stubEnv('INSTANCE_MODE','cloud');vi.stubEnv('INSTANCE_CONTROL_URL','http://control.synthetic.invalid');vi.stubEnv('INSTANCE_CONTROL_TOKEN','synthetic-control-token-32-characters');
  vi.spyOn(console,'info').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});
  order=[];tick.mockImplementation(async()=>{order.push('tick');return {status:'ok',erzeugt:0};});
  vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
   const url=new URL(input);
   if(url.pathname==='/v1/instances'){order.push('hosts');return Response.json([hostname]);}
   expect(url.pathname).toBe('/v1/resolve');expect(url.searchParams.get('hostname')).toBe(hostname);
   order.push('resolve');return Response.json(context);
  }));
 });
 afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();tick.mockReset();setup.mockReset();globalThis.__zettelruhe_scheduler_started=false;globalThis.__zettelruhe_scheduler_running=false;globalThis.__zettelruhe_scheduler_timer=undefined;});
 it('resolves the allowed tenant before skipping pending setup, then resumes after completion',async()=>{
  let status='pending';
  const setupTenants: string[]=[];
  setup.mockImplementation(async()=>{order.push('setup');setupTenants.push((await getInstanceContext()).tenantId);return {...state,status};});
  startInProcessScheduler();await vi.advanceTimersByTimeAsync(30000);
  expect(order).toEqual(['hosts','resolve','setup']);expect(tick).not.toHaveBeenCalled();
  status='complete';await vi.advanceTimersByTimeAsync(30000);
  expect(order).toEqual(['hosts','resolve','setup','hosts','resolve','setup','tick']);
  expect(setupTenants).toEqual([context.tenantId,context.tenantId]);expect(tick).toHaveBeenCalledTimes(1);
 });
 it('fails closed when persisted setup cannot be read and recovers on a later tick',async()=>{
  setup.mockImplementation(async()=>{order.push('setup');throw new Error('synthetic setup unavailable');});
  startInProcessScheduler();await vi.advanceTimersByTimeAsync(30000);
  expect(order).toEqual(['hosts','resolve','setup']);expect(tick).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledWith('[jobs] Instanzlauf nicht verfügbar');
  setup.mockImplementation(async()=>{order.push('setup');return {...state,status:'complete'};});
  await vi.advanceTimersByTimeAsync(30000);expect(tick).toHaveBeenCalledTimes(1);
 });
 it.each(['hosts','resolve'])('keeps the existing %s access gate before reading setup',async(blocked)=>{
  setup.mockResolvedValue({...state,status:'complete'});
  vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
   const stage=new URL(input).pathname==='/v1/instances'?'hosts':'resolve';order.push(stage);
   return stage===blocked?new Response(null,{status:503}):Response.json([hostname]);
  }));
  startInProcessScheduler();await vi.advanceTimersByTimeAsync(30000);
  expect(order).toEqual(blocked==='hosts'?['hosts']:['hosts','resolve']);
  expect(setup).not.toHaveBeenCalled();expect(tick).not.toHaveBeenCalled();
 });
});
