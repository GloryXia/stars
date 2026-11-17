import { describe,expect,it } from 'vitest';
import type { AllocationPlanConfig } from '@stars/contracts';
import { acceptCommand,advanceToRealSeconds,createSimulation,fixtureCommand,projectSeat,restoreSimulation,serializeSimulation,type SimulationState } from './index.js';

const view=(state:SimulationState)=>projectSeat(state)['self.telemetry'];
function configure(state:SimulationState,config:AllocationPlanConfig,id=10) {
  return {...fixtureCommand(),command_id:`019a8700-0000-7000-8000-${id.toString().padStart(12,'0')}`,base_view_version:state.view_version,action:{type:'configure_allocation_plan' as const,...config}};
}
function manual(state:SimulationState,dimension:'obs'|'world_up',id:number,queue_index?:number) {
  return {...fixtureCommand(),command_id:`019a8700-0000-7000-8000-${id.toString().padStart(12,'0')}`,base_view_version:state.view_version,
    action:{type:'allocate_evolution_point' as const,dimension,...(queue_index===undefined ? {} : {queue_op:'remove_at' as const,queue_index})}};
}
const route:AllocationPlanConfig={enabled:true,items:[{dimension:'persist',target_level:2},{dimension:'world_up',target_level:3}]};

describe('long term allocation plan',()=>{
  it('completes target levels in order and advances the cursor only on completion',()=>{
    const state=createSimulation({evolution:{initial_points:3,inputs:{sdi_fraction:1}}});
    const command=configure(state,route);
    const result=acceptCommand(state,command);
    expect(view(state).allocation_plan.cursor_index).toBe(0);
    expect(view(state).active_construction).toMatchObject({dimension:'persist',target_level:1});
    advanceToRealSeconds(state,900);
    expect(view(state)).toMatchObject({allocation_plan:{cursor_index:0},active_construction:{dimension:'persist',target_level:2}});
    advanceToRealSeconds(state,3600);
    expect(view(state)).toMatchObject({allocation_plan:{cursor_index:1},active_construction:{dimension:'world_up',target_level:2}});
    advanceToRealSeconds(state,7200);
    expect(view(state)).toMatchObject({allocation_plan:{cursor_index:2},active_construction:null,n_worlds:3,evo_points_avail:0});
    expect(acceptCommand(state,command)).toEqual(result);
    expect(state.evolution.spent_points).toBe(3);
    expect(JSON.stringify(projectSeat(state))).not.toContain('plan_index');
  });
  it('pauses waiting work and resumes at the same goal without consuming points twice',()=>{
    const state=createSimulation();
    acceptCommand(state,configure(state,route));
    expect(view(state).build_queue[0]?.status).toBe('waiting_points');
    acceptCommand(state,configure(state,{...route,enabled:false},11));
    expect(view(state).build_queue).toEqual([]);
    advanceToRealSeconds(state,6000);
    expect(view(state).active_construction).toBeNull();
    acceptCommand(state,configure(state,route,12));
    expect(view(state).active_construction?.dimension).toBe('persist');
    acceptCommand(state,configure(state,{...route,enabled:false},13));
    advanceToRealSeconds(state,6900);
    expect(view(state).tech_levels_5.persist).toBe(1);
    expect(view(state).active_construction).toBeNull();
    expect(view(state).allocation_plan.cursor_index).toBe(0);
    expect(state.evolution.spent_points).toBe(1);
  });
  it('replacing a plan preserves paid construction and manual FIFO work',()=>{
    const state=createSimulation({evolution:{initial_points:5}});
    acceptCommand(state,configure(state,route));
    acceptCommand(state,manual(state,'obs',1));
    acceptCommand(state,configure(state,{enabled:true,items:[{dimension:'world_up',target_level:2}]},11));
    expect(view(state).build_queue.map(item=>item.dimension)).toEqual(['obs','world_up']);
    advanceToRealSeconds(state,900);
    expect(view(state).active_construction?.dimension).toBe('obs');
    expect(view(state).allocation_plan.cursor_index).toBe(0);
    advanceToRealSeconds(state,3600);
    expect(view(state)).toMatchObject({n_worlds:2,tech_levels_5:{obs:1,persist:1},allocation_plan:{cursor_index:1}});
  });
  it('respects min_k and tier prerequisites, and skips already attained targets',()=>{
    const state=createSimulation({evolution:{initial_points:20,k_tier:1}});
    acceptCommand(state,configure(state,{enabled:true,items:[{dimension:'world_up',target_level:2,min_k:1.5}]}));
    advanceToRealSeconds(state,6000);
    expect(view(state)).toMatchObject({active_construction:null,build_queue:[],allocation_plan:{cursor_index:0}});
    acceptCommand(state,configure(state,{enabled:true,items:[{dimension:'obs',target_level:3}]},11));
    advanceToRealSeconds(state,9600);
    expect(view(state)).toMatchObject({tech_levels_5:{obs:2},active_construction:null,allocation_plan:{cursor_index:0}});
    expect(view(state).build_queue[0]?.status).toBe('waiting_prerequisite');
    acceptCommand(state,configure(state,{enabled:true,items:[{dimension:'obs',target_level:2},{dimension:'world_up'}]},12));
    expect(view(state)).toMatchObject({allocation_plan:{cursor_index:1},active_construction:{dimension:'world_up',target_level:2}});
  });
  it('keeps the queue bounded and replenishes when manual work frees a slot',()=>{
    const state=createSimulation({evolution:{initial_points:20}});
    for(let id=1;id<=3;id++) acceptCommand(state,manual(state,'world_up',id));
    for(let id=4;id<=6;id++) acceptCommand(state,manual(state,'obs',id));
    expect(view(state).build_queue).toHaveLength(5);
    acceptCommand(state,configure(state,{enabled:true,items:[{dimension:'persist'}]}));
    expect(view(state).build_queue).toHaveLength(5);
    advanceToRealSeconds(state,1800);
    expect(view(state).build_queue).toHaveLength(5);
    expect(view(state).build_queue.at(-1)?.dimension).toBe('persist');
  });
  it('manual removal pauses its plan instead of immediately recreating the removed item',()=>{
    const state=createSimulation();
    const config:AllocationPlanConfig={enabled:true,items:[{dimension:'obs'}]};
    acceptCommand(state,configure(state,config));
    acceptCommand(state,manual(state,'obs',1,0));
    expect(view(state)).toMatchObject({build_queue:[],allocation_plan:{enabled:false,cursor_index:0}});
    acceptCommand(state,configure(state,config,11));
    expect(view(state).build_queue).toHaveLength(1);
  });
  it('matches one offline jump across multiple goals to polling and snapshot restores',()=>{
    const original=createSimulation();
    acceptCommand(original,configure(original,{enabled:true,items:[{dimension:'persist',target_level:2},{dimension:'world_up',target_level:4},{dimension:'obs',target_level:2}]}));
    const offline=restoreSimulation(serializeSimulation(original));
    let polled=restoreSimulation(serializeSimulation(original));
    for(let real=31;real<60000;real+=31) {
      advanceToRealSeconds(polled,real);
      if(real%3100===0) polled=restoreSimulation(serializeSimulation(polled));
    }
    expect(advanceToRealSeconds(polled,60000)).toEqual(advanceToRealSeconds(offline,60000));
    expect(serializeSimulation(polled)).toBe(serializeSimulation(offline));
    expect(view(polled).allocation_plan.cursor_index).toBe(3);
  });
  it('rejects invalid goals, oversized plans and forged scope without state changes',()=>{
    const state=createSimulation();
    const before=serializeSimulation(state);
    for(const items of [[{dimension:'k_tier_up',target_level:4}],[{dimension:'world_up',target_level:1}],Array.from({length:21},()=>({dimension:'obs'})),[{dimension:'obs',min_k:NaN}]]) {
      expect(()=>acceptCommand(state,configure(state,{enabled:true,items} as AllocationPlanConfig))).toThrow('INVALID_COMMAND');
    }
    const command=configure(state,route);
    expect(()=>acceptCommand(state,{...command,principal:{...command.principal,granted_scopes:['READ_SEAT_VIEW']}})).toThrow('MISSING_SCOPE');
    expect(serializeSimulation(state)).toBe(before);
  });
  it('migrates v3 economic snapshots without restarting their ledger or active work',()=>{
    const state=createSimulation({evolution:{initial_points:2}});
    acceptCommand(state,manual(state,'obs',1));
    advanceToRealSeconds(state,30);
    const old=JSON.parse(serializeSimulation(state));
    old.snapshot_version=3;
    delete old.evolution.allocation_plan;
    delete old.evolution.plan_target_level;
    const restored=restoreSimulation(old);
    expect(view(restored).allocation_plan).toEqual({enabled:false,cursor_index:0,items:[]});
    expect(advanceToRealSeconds(restored,900)).toEqual(advanceToRealSeconds(state,900));
  });
});
