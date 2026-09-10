import { afterEach, describe, expect, it, vi } from 'vitest';
const tick=vi.hoisted(()=>vi.fn());
vi.mock('./runner',()=>({runWiederkehrendTick:tick}));
import { startInProcessScheduler } from './scheduler';
describe('scheduler overlap',()=>{
 afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.restoreAllMocks();globalThis.__zettelruhe_scheduler_started=false;globalThis.__zettelruhe_scheduler_running=false;});
 it('skips interval callbacks while the preceding tick is still running and resumes afterwards',async()=>{
  vi.useFakeTimers();vi.stubEnv('JOBS_DISABLED','false');vi.stubEnv('JOB_TICK_INTERVAL_MS','60000');vi.spyOn(console,'info').mockImplementation(()=>{});
  let finish!: (value:unknown)=>void;
  tick.mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValue({status:'ok',erzeugt:0});
  startInProcessScheduler();await vi.advanceTimersByTimeAsync(180000);expect(tick).toHaveBeenCalledTimes(1);
  finish({status:'ok',erzeugt:0});await vi.advanceTimersByTimeAsync(60000);expect(tick).toHaveBeenCalledTimes(2);
 });
});
