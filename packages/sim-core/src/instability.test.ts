import { describe,expect,it } from 'vitest';
import { KAPPA_T,seatViewSchema,type SeatCommandEnvelope } from '@stars/contracts';
import { createCivilization,createSimulation,advanceToRealSeconds,acceptCommand,projectSeat,fixtureCommand,serializeSimulation,restoreSimulation,scheduleNodeReport,type SimulationState } from './index.js';
import { createInstability,instabilityRates,nextInstability,syncInstability } from './instability.js';
import { YEAR_MS } from './growth.js';

const telemetry=(state:SimulationState)=>projectSeat(state)['self.telemetry'];
function command(state:SimulationState,id:number,action:SeatCommandEnvelope['action']):SeatCommandEnvelope {
  return {...fixtureCommand(),command_id:`019a8700-0000-7000-8000-${id.toString().padStart(12,'0')}`,base_view_version:state.view_version,action};
}
function advanceMs(state:SimulationState,ms:number){return advanceToRealSeconds(state,(ms+0.01)/(KAPPA_T*1000));}
function forceClock(state:SimulationState,kind:'fatal'|'crisis',years:number){
  const h=state.instability!;
  h.anchor_sim_ms=state.t_sim_ms;h.fatal_remaining=1000;h.crisis_remaining=1000;
  h[`${kind}_remaining`]=h[`${kind}_rate`]*years;
  return nextInstability(h).time;
}

describe('civilization instability lifecycle',()=>{
  it('uses the specified continuous rates and preserves integrated exposure when rates change',()=>{
    expect(instabilityRates(0)).toEqual({fatal:0,crisis:0});
    expect(instabilityRates(0.38)).toEqual({fatal:0.0015,crisis:0});
    expect(instabilityRates(1).fatal).toBe(0.4515);
    expect(instabilityRates(1).crisis).toBeCloseTo(1.12875,14);
    const h=createInstability('clock',0,0.38);
    h.fatal_remaining=0.003;h.crisis_remaining=100;
    expect(nextInstability(h).time).toBe(2*YEAR_MS);
    syncInstability(h,YEAR_MS,0.19); // One half-exposure remains, at 1/8 the rate.
    expect(nextInstability(h).time).toBe(9*YEAR_MS);
    const before=structuredClone(h);syncInstability(h,2*YEAR_MS,0.19);
    expect(h).toEqual(before);
  });
  it('applies a local crisis at its clock crossing without deleting earned points or construction',()=>{
    const options={seed:'crisis',evolution:{inputs:{k_value:0.8},initial_points:10}};
    const state=createCivilization(options),reference=createCivilization({...options,instability:false});
    const build=command(state,1,{type:'allocate_evolution_point',dimension:'world_up'});
    acceptCommand(state,build);acceptCommand(reference,build);
    const due=forceClock(state,'crisis',1);
    advanceMs(state,due-1);
    expect(telemetry(state).instability.crisis_count).toBe(0);
    advanceMs(reference,due);advanceMs(state,due);
    expect(telemetry(state).k_value).toBeCloseTo(telemetry(reference).k_value-0.015,12);
    expect(telemetry(state).evo_points_avail).toBeCloseTo(telemetry(reference).evo_points_avail,12);
    expect(telemetry(state).active_construction?.dimension).toBe('world_up');
    expect(telemetry(state).instability).toMatchObject({crisis_count:1,last_event:{kind:'local_crisis',t_sim_s:due/1000}});
    expect(state.extinction.extinct).toBe(false);
    expect(()=>restoreSimulation(serializeSimulation(state))).not.toThrow();
  });
  it('freezes the ledger and projects a single fatal report; new commands fail while accepted retries remain valid',()=>{
    const state=createCivilization({seed:'terminal',evolution:{initial_points:10}});
    const build=command(state,1,{type:'allocate_evolution_point',dimension:'obs'}),result=acceptCommand(state,build);
    const due=forceClock(state,'fatal',1);
    advanceMs(state,due);
    expect(state.extinction).toEqual({extinct:true,cause:'ColdWar_SelfDestruct',t_extinct_sim_s:due/1000,posthumous_callbacks:[]});
    expect(telemetry(state)).toMatchObject({active_construction:null,build_queue:[],allocation_plan:{enabled:false},v_e_rate_per_sim_yr:0,pi_productivity:{total:0},tech_levels_5:{obs:0}});
    expect(state.evolution.spent_points).toBe(1);
    expect(acceptCommand(state,build)).toEqual(result);
    const saved=serializeSimulation(state);
    for(const action of [{type:'allocate_evolution_point',dimension:'world_up'},{type:'dispatch_expedition',target_node_id:'B'},{type:'configure_allocation_plan',enabled:true,items:[]},{type:'set_node_coordination',node_id:'B',mode:'sync'}] satisfies SeatCommandEnvelope['action'][]){
      expect(()=>acceptCommand(state,command(state,2,action))).toThrow('CIVILIZATION_EXTINCT');
      expect(serializeSimulation(state)).toBe(saved);
    }
    const restored=restoreSimulation(saved),final=telemetry(state);
    advanceToRealSeconds(restored,120000);advanceToRealSeconds(state,120000);
    expect(telemetry(state)).toEqual(final);
    expect(serializeSimulation(restored)).toBe(serializeSimulation(state));
    expect(seatViewSchema.safeParse(projectSeat(state)).success).toBe(true);
  });
  it('keeps physical in-flight events scheduled after death without reviving the coordinator from a receipt',()=>{
    const state=createCivilization({seed:'late',evolution:{n_worlds:2,tech_levels_5:{persist:1},inputs:{k_value:0.8}}});
    acceptCommand(state,fixtureCommand());
    const due=forceClock(state,'fatal',1);advanceMs(state,due);
    const final=projectSeat(state),queued=state.events.length;
    expect(queued).toBeGreaterThan(0);
    advanceToRealSeconds(state,3000);
    expect(state.expedition_arrived).toBe(true);
    expect(state.events.length).toBe(0);
    expect(projectSeat(state)['self.network']).toEqual(final['self.network']);
    expect(projectSeat(state)['extinction.report']).toEqual(final['extinction.report']);
    expect(telemetry(state)).toEqual(final['self.telemetry']);
  });
  it('collapses immediately at raw SDI >=100 without a shield or remote network',()=>{
    const state=createCivilization({seed:'overload',evolution:{tech_levels_5:{obs:4}}});
    expect(state.extinction).toMatchObject({extinct:true,cause:'SDI_System_Collapse',t_extinct_sim_s:0});
    expect(telemetry(state).sdi_raw).toBeGreaterThan(100);
    expect(()=>restoreSimulation(serializeSimulation(state))).not.toThrow();
  });
  it('uses a persist-3 shield once, returns to 50%, then collapses on the next upward crossing',()=>{
    const state=createCivilization({seed:'shield',evolution:{k_tier:3,tech_levels_5:{persist:3,obs:4}}});
    expect(state.extinction.extinct).toBe(false);
    expect(state.instability?.shield_used).toBe(true);
    expect(telemetry(state)).toMatchObject({sdi_total:50,instability:{shield_available:false,last_event:{kind:'shield'}}});
    // Isolate the threshold from the independent cold-war clock.
    state.instability!.fatal_remaining=1000;state.instability!.crisis_remaining=1000;
    let restored=restoreSimulation(serializeSimulation(state));
    advanceToRealSeconds(state,300);advanceToRealSeconds(restored,300);
    expect(state.extinction).toMatchObject({extinct:true,cause:'SDI_System_Collapse'});
    expect(serializeSimulation(restored)).toBe(serializeSimulation(state));
  });
  it('permanently secedes an overextended node and rejects later confirmations and resync',()=>{
    const state=createCivilization({seed:'secede',evolution:{n_worlds:2,tech_levels_5:{persist:1},growth:{seed:'secede',d_self:1.15}}});
    acceptCommand(state,fixtureCommand());
    state.instability!.fatal_remaining=1000;state.instability!.crisis_remaining=1000;
    advanceToRealSeconds(state,6000);
    expect(state.extinction.extinct).toBe(false);
    expect(telemetry(state).instability.last_event?.kind).toBe('secession');
    expect(state.nodes.find(node=>node.node_id==='B')?.last_confirmed_status).toBe('seceded');
    expect(telemetry(state)).toMatchObject({n_eff_stars:1,active_sync_span_ly:0.05});
    expect(()=>acceptCommand(state,command(state,2,{type:'set_node_coordination',node_id:'B',mode:'sync'}))).toThrow('INVALID_NODE');
    scheduleNodeReport(state,{event_id:'late-confirm',status:'confirmed',t_source_sim_s:state.t_sim_ms/1000,t_arrive_sim_s:(state.t_sim_ms+4*YEAR_MS)/1000});
    advanceToRealSeconds(state,6240);
    expect(state.nodes.find(node=>node.node_id==='B')?.last_confirmed_status).toBe('seceded');
    expect(()=>restoreSimulation(serializeSimulation(state))).not.toThrow();
  });
  it('has identical crisis/death outcomes across polling, offline catchup and restarts',()=>{
    const offline=createCivilization({seed:'replay-instability',evolution:{inputs:{k_value:0.8}}});
    let polled=restoreSimulation(serializeSimulation(offline));
    for(let real=7;real<18000;real+=7){
      advanceToRealSeconds(polled,real);
      if(real%70===0)polled=restoreSimulation(serializeSimulation(polled));
    }
    advanceToRealSeconds(polled,18000);advanceToRealSeconds(offline,18000);
    expect(polled.extinction.extinct).toBe(true);
    expect(serializeSimulation(polled)).toBe(serializeSimulation(offline));
  });
  it('keeps hidden success/no-ack/unavailable branches identical before receipt, including hazard clocks',()=>{
    const states=(['success','no-ack','unavailable'] as const).map(branch=>{
      const state=createCivilization({seed:'causal-hazard',branch,evolution:{n_worlds:2,tech_levels_5:{persist:1}}});acceptCommand(state,fixtureCommand());return state;
    });
    for(const real of [240,2400,2639.999]){
      const projections=states.map(state=>advanceToRealSeconds(state,real));
      expect(projections[0]).toEqual(projections[1]);expect(projections[0]).toEqual(projections[2]);
      expect(states[0]!.instability).toEqual(states[1]!.instability);expect(states[0]!.instability).toEqual(states[2]!.instability);
    }
  });
  it('preserves old v6 SDI-only saves and fixed M1 references without enabling hazards',()=>{
    const state=createCivilization({instability:false});advanceToRealSeconds(state,317);
    const legacy=JSON.parse(serializeSimulation(state));legacy.snapshot_version=6;
    delete legacy.instability;delete legacy.extinction;delete legacy.evolution.halted_sim_ms;
    const restored=restoreSimulation(legacy);
    expect(restored.instability).toBeNull();expect(createSimulation().instability).toBeNull();
    expect(advanceToRealSeconds(restored,60000)).toEqual(advanceToRealSeconds(state,60000));
  });
  it('rejects inconsistent rates, past-due clocks, future events and partial extinction snapshots',()=>{
    const state=createCivilization();advanceToRealSeconds(state,317);
    const raw=JSON.parse(serializeSimulation(state));
    for(const patch of [{fatal_rate:100},{fatal_remaining:0},{anchor_sim_ms:100*YEAR_MS},{last_event:{kind:'shield',t_sim_s:100*YEAR_MS/1000}}]){
      expect(()=>restoreSimulation({...raw,instability:{...raw.instability,...patch}})).toThrow('INVALID_INSTABILITY_SNAPSHOT');
    }
    expect(()=>restoreSimulation({...raw,extinction:{extinct:true,cause:'SDI_System_Collapse',t_extinct_sim_s:0,posthumous_callbacks:[]}})).toThrow('INVALID_EXTINCTION_SNAPSHOT');
  });
});
