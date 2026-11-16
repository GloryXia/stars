import { describe,expect,it } from 'vitest';
import { DEV_CONTEXT } from '@stars/contracts';
import { createApp, DEV_PRINCIPAL } from './app.js';
import type { Receipt, SeatRepository, StoredState } from './repository.js';
class TestRepository implements SeatRepository {
  snapshot:unknown={}; receipts=new Map<string,Receipt>(); queue=Promise.resolve();
  async ready(){}
  async transaction<T>(_context:unknown,_account:string,fn:Parameters<SeatRepository['transaction']>[2]):Promise<T>{
    const prior=this.queue;let unlock!:()=>void;this.queue=new Promise<void>(r=>{unlock=r;});await prior;
    const receipts=new Map(this.receipts);let saved=structuredClone(this.snapshot);
    try{const value=await fn({snapshot:saved,receipt:async(kind,id)=>receipts.get(kind+id),save:async(state:StoredState)=>{saved=structuredClone(state);},record:async(kind,id,r)=>{receipts.set(kind+id,r);}});this.snapshot=saved;this.receipts=receipts;return value as T;}finally{unlock();}
  }
}
const token='test-token-for-local-fixture-only-12345';
const headers={authorization:'Bearer '+token};
const command={...DEV_CONTEXT,command_id:'019a8700-0000-7000-8000-000000000001',base_view_version:0,principal:DEV_PRINCIPAL,action:{type:'dispatch_expedition',target_node_id:'B'}};
describe('HTTP gateway',()=>{
  it('authenticates before reading, rejects cross-seat and forged worker principals, blocks external agents',async()=>{
    const {app}=createApp({repository:new TestRepository(),devToken:token,now:()=>0});
    expect((await app.inject('/api/dev/bootstrap')).statusCode).toBe(401);
    expect((await app.inject({url:'/api/seats/unknown/view',headers})).statusCode).toBe(404);
    for(const [kind,status] of [['internal_ai',403],['l1_reflex',403],['external_agent',501]] as const){
      expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,principal:{...DEV_PRINCIPAL,kind}}})).statusCode).toBe(status);
    }
    expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,civ_gen:2}})).statusCode).toBe(404);
    await app.close();
  });
  it('atomically deduplicates concurrent retries, conflicts on changed input and restores persisted progression',async()=>{
    let time=0;const repository=new TestRepository();const {app}=createApp({repository,devToken:token,now:()=>time});
    const requests=await Promise.all(Array.from({length:5},()=>app.inject({method:'POST',url:'/api/commands',headers,payload:command})));
    expect(requests.map(r=>r.statusCode)).toEqual([200,200,200,200,200]);
    expect(new Set(requests.map(r=>r.body)).size).toBe(1);expect(repository.receipts.size).toBe(1);
    expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,action:{type:'dispatch_expedition',target_node_id:'C'}}})).statusCode).toBe(409);
    time=2639_000;
    const before=await app.inject({url:'/api/dev/bootstrap',headers});expect(before.json().view['self.telemetry'].controlled_node_count).toBe(1);
    await app.close();
    const restarted=createApp({repository,devToken:token,now:()=>2640_000});
    const after=await restarted.app.inject({url:'/api/dev/bootstrap',headers});expect(after.json().view['self.telemetry'].controlled_node_count).toBe(2);
    expect(after.body).not.toContain('return_available');expect(after.body).not.toContain('state_snapshot');
    await restarted.app.close();
  });
  it('rejects stale views and invalid values without acknowledging success',async()=>{
    const {app}=createApp({repository:new TestRepository(),devToken:token,now:()=>0});
    expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,base_view_version:20}})).statusCode).toBe(409);
    expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,action:{type:'dispatch_expedition',target_node_id:''}}})).statusCode).toBe(400);
    await app.close();
  });
});
