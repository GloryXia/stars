import { describe,expect,it } from 'vitest';
import { DEV_CONTEXT } from '@stars/contracts';
import { createCivilization,acceptCommand,advanceToRealSeconds } from '@stars/sim-core';
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
  it('persists extinction even on a rejected order and keeps accepted retries valid across restart',async()=>{
    let time=0;
    const repository=new TestRepository();
    const state=createCivilization({seed:'http-extinction',evolution:{initial_points:10}});
    state.instability!.fatal_remaining=state.instability!.fatal_rate;
    state.instability!.crisis_remaining=1000;
    repository.snapshot={simulation:state,anchor_real_ms:0};
    const {app}=createApp({repository,devToken:token,now:()=>time});
    const build={...command,action:{type:'allocate_evolution_point',dimension:'obs'}};
    const accepted=await app.inject({method:'POST',url:'/api/commands',headers,payload:build});
    expect(accepted.statusCode).toBe(200);
    time=60001;
    const next={...build,command_id:'019a8700-0000-7000-8000-000000000002'};
    const rejected=await app.inject({method:'POST',url:'/api/commands',headers,payload:next});
    expect(rejected.statusCode).toBe(409);expect(rejected.json().error.code).toBe('CIVILIZATION_EXTINCT');
    const final=(await app.inject({url:'/api/dev/bootstrap',headers})).json().view;
    expect(final['extinction.report']).toMatchObject({extinct:true,cause:'ColdWar_SelfDestruct'});
    expect(final['self.telemetry']).toMatchObject({active_construction:null,v_e_rate_per_sim_yr:0});
    await app.close();time=120_000_000;
    const restarted=createApp({repository,devToken:token,now:()=>time}).app;
    const restored=(await restarted.inject({url:'/api/dev/bootstrap',headers})).json().view;
    expect(restored['extinction.report']).toEqual(final['extinction.report']);
    expect(restored['self.telemetry']).toEqual(final['self.telemetry']);
    expect((await restarted.inject({method:'POST',url:'/api/commands',headers,payload:build})).body).toBe(accepted.body);
    expect((await restarted.inject({method:'POST',url:'/api/commands',headers,payload:next})).body).toBe(rejected.body);
    expect(repository.receipts.size).toBe(2);
    await restarted.close();
  });
  it('creates real Tier 1 seats by default and restores their seeded growth after restart',async()=>{
    let time=0;
    const repository=new TestRepository();
    const {app}=createApp({repository,devToken:token,now:()=>time});
    const initial=(await app.inject({url:'/api/dev/bootstrap',headers})).json().view;
    expect(initial['self.telemetry']).toMatchObject({k_tier:1,k_value:0.56,n_worlds:1,evo_points_avail:0});
    const locked=await app.inject({method:'POST',url:'/api/commands',headers,payload:command});
    expect(locked.statusCode).toBe(409);expect(locked.json().error.code).toBe('EXPEDITION_LOCKED');
    const build={...command,command_id:'019a8700-0000-7000-8000-000000000002',action:{type:'allocate_evolution_point' as const,dimension:'world_up' as const}};
    expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:build})).statusCode).toBe(200);
    await app.close();time=1_800_000;
    const restarted=createApp({repository,devToken:token,now:()=>time});
    const view=(await restarted.app.inject({url:'/api/dev/bootstrap',headers})).json().view;
    const reference=createCivilization();acceptCommand(reference,build);
    expect(view).toEqual(advanceToRealSeconds(reference,1800));
    expect(view['self.telemetry'].n_worlds).toBe(2);
    expect(view['self.telemetry'].k_value).toBeGreaterThan(0.56);
    await restarted.app.close();
  });
  it('authenticates before reading, rejects cross-seat and forged worker principals, blocks external agents',async()=>{
    const {app}=createApp({newSeatMode:'m1_fixture',repository:new TestRepository(),devToken:token,now:()=>0});
    expect((await app.inject('/api/dev/bootstrap')).statusCode).toBe(401);
    expect((await app.inject({url:'/api/seats/unknown/view',headers})).statusCode).toBe(404);
    for(const [kind,status] of [['internal_ai',403],['l1_reflex',403],['external_agent',501]] as const){
      expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,principal:{...DEV_PRINCIPAL,kind}}})).statusCode).toBe(status);
    }
    expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,civ_gen:2}})).statusCode).toBe(404);
    await app.close();
  });
  it('atomically deduplicates concurrent retries, conflicts on changed input and restores persisted progression',async()=>{
    let time=0;const repository=new TestRepository();const {app}=createApp({newSeatMode:'m1_fixture',repository,devToken:token,now:()=>time});
    const requests=await Promise.all(Array.from({length:5},()=>app.inject({method:'POST',url:'/api/commands',headers,payload:command})));
    expect(requests.map(r=>r.statusCode)).toEqual([200,200,200,200,200]);
    expect(new Set(requests.map(r=>r.body)).size).toBe(1);expect(repository.receipts.size).toBe(1);
    expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,action:{type:'dispatch_expedition',target_node_id:'C'}}})).statusCode).toBe(409);
    time=2639_000;
    const before=await app.inject({url:'/api/dev/bootstrap',headers});expect(before.json().view['self.telemetry'].controlled_node_count).toBe(1);
    await app.close();
    const restarted=createApp({newSeatMode:'m1_fixture',repository,devToken:token,now:()=>2640_000});
    const after=await restarted.app.inject({url:'/api/dev/bootstrap',headers});expect(after.json().view['self.telemetry'].controlled_node_count).toBe(2);
    expect(after.body).not.toContain('return_available');expect(after.body).not.toContain('state_snapshot');
    await restarted.app.close();
  });
  it('rejects stale views and invalid values without acknowledging success',async()=>{
    const {app}=createApp({newSeatMode:'m1_fixture',repository:new TestRepository(),devToken:token,now:()=>0});
    expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,base_view_version:20}})).statusCode).toBe(409);
    expect((await app.inject({method:'POST',url:'/api/commands',headers,payload:{...command,action:{type:'dispatch_expedition',target_node_id:''}}})).statusCode).toBe(400);
    await app.close();
  });
  it('persists queued construction, deduplicates allocation and catches up after restart',async()=>{
    let time=0;
    const repository=new TestRepository();
    const {app}=createApp({newSeatMode:'m1_fixture',repository,devToken:token,now:()=>time});
    const build={...command,action:{type:'allocate_evolution_point',dimension:'persist',queue_op:'enqueue'}};
    const replies=await Promise.all(Array.from({length:4},()=>app.inject({method:'POST',url:'/api/commands',headers,payload:build})));
    expect(replies.map(reply=>reply.statusCode)).toEqual([200,200,200,200]);
    expect(new Set(replies.map(reply=>reply.body)).size).toBe(1);
    const bootstrap=(await app.inject({url:'/api/dev/bootstrap',headers})).json();
    expect(bootstrap.view['self.telemetry'].build_queue).toHaveLength(1);
    expect(bootstrap.view['self.telemetry'].build_queue[0].status).toBe('waiting_points');
    const rate=bootstrap.view['self.telemetry'].v_e_rate_per_sim_yr;
    // Close before points are sufficient, then restart beyond construction finish.
    time=60_000;
    await app.inject({url:'/api/dev/bootstrap',headers});
    await app.close();
    time=(60/rate+900+1)*1000;
    const restarted=createApp({newSeatMode:'m1_fixture',repository,devToken:token,now:()=>time});
    const view=(await restarted.app.inject({url:'/api/dev/bootstrap',headers})).json().view;
    expect(view['self.telemetry']).toMatchObject({tech_levels_5:{persist:1},active_construction:null,build_queue:[]});
    expect(view['self.telemetry'].evo_points_avail).toBeCloseTo(view['self.telemetry'].evo_points_earned_total-1,12);
    const retry=await restarted.app.inject({method:'POST',url:'/api/commands',headers,payload:build});
    expect(retry.body).toBe(replies[0]!.body);
    expect(repository.receipts.size).toBe(1);
    expect(view).not.toHaveProperty('evolution');
    await restarted.app.close();
  });
  it('persists and deduplicates a long term plan across disconnect and restart',async()=>{
    let time=0;
    const repository=new TestRepository();
    const {app}=createApp({newSeatMode:'m1_fixture',repository,devToken:token,now:()=>time});
    const plan={...command,action:{type:'configure_allocation_plan',enabled:true,items:[{dimension:'world_up',target_level:3}]}};
    const replies=await Promise.all(Array.from({length:3},()=>app.inject({method:'POST',url:'/api/commands',headers,payload:plan})));
    expect(replies.map(reply=>reply.statusCode)).toEqual([200,200,200]);
    expect(new Set(replies.map(reply=>reply.body)).size).toBe(1);
    await app.close();
    time=3_600_000;
    const restarted=createApp({newSeatMode:'m1_fixture',repository,devToken:token,now:()=>time});
    const view=(await restarted.app.inject({url:'/api/dev/bootstrap',headers})).json().view;
    expect(view['self.telemetry']).toMatchObject({n_worlds:3,active_construction:null,build_queue:[],allocation_plan:{enabled:true,cursor_index:1}});
    expect((await restarted.app.inject({method:'POST',url:'/api/commands',headers,payload:plan})).body).toBe(replies[0]!.body);
    expect(repository.receipts.size).toBe(1);
    await restarted.app.close();
  });
});
