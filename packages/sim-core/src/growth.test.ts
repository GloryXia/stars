import { describe,expect,it } from 'vitest';
import type { SeatCommandEnvelope } from '@stars/contracts';
import { createCivilization as createLiveCivilization,createSimulation,acceptCommand,advanceToRealSeconds,projectSeat,fixtureCommand,restoreSimulation,serializeSimulation,scheduleNodeReport,type SimulationState } from './index.js';
import { GROWTH_STEP_MS,YEAR_MS } from './growth.js';

// Numerical reference tests isolate growth/SDI from the competing fatal clock.
const createCivilization=(options:Parameters<typeof createLiveCivilization>[0]={})=>createLiveCivilization({...options,instability:false});
const telemetry=(state:SimulationState)=>projectSeat(state)['self.telemetry'];
function command(state:SimulationState,id:number,action:SeatCommandEnvelope['action']):SeatCommandEnvelope {
  return {...fixtureCommand(),command_id:`019a8700-0000-7000-8000-${id.toString().padStart(12,'0')}`,base_view_version:state.view_version,action};
}
function plan(state:SimulationState){acceptCommand(state,command(state,10,{type:'configure_allocation_plan',enabled:true,items:[{dimension:'world_up',target_level:2},{dimension:'persist',target_level:1}]}));}

describe('seeded civilization growth',()=>{
  it('starts at K=.56 in Tier 1 and rejects early expeditions without mutation',()=>{
    const state=createCivilization({seed:'cold'});
    expect(telemetry(state)).toMatchObject({k_value:0.56,k_max_confirmed:0.86,k_tier:1,n_worlds:1,n_eff_stars:1,stage:'single_planet',evo_points_avail:0});
    const before=serializeSimulation(state);
    expect(()=>acceptCommand(state,fixtureCommand())).toThrow('EXPEDITION_LOCKED');
    expect(serializeSimulation(state)).toBe(before);
    advanceToRealSeconds(state,1);
    expect(telemetry(state).k_value).toBeGreaterThan(0.56);
    expect(telemetry(state).evo_points_avail).toBeGreaterThan(0);
  });
  it('stays within the 5-year integrator error budget against an independent RK4 reference',()=>{
    // Independently integrated GDD equations with Python RK4, dt=.01 sim yr,
    // neutral traits, Xi=0, fixed SDI=.27, one world/star. No production helper.
    const reference=[
      [100,0.5853539563808067,0.41530174666834185],
      [220,0.6356214145662218,0.9390877858224269],
      [340,0.7102777663014304,1.5093917552813745],
      [500,0.7994436587627499,2.366336089121179],
      [1000,0.8580298739524445,5.359423874626792],
    ];
    const state=createCivilization({evolution:{growth:{seed:'reference',stochastic:false},inputs:{sdi_fraction:0.27}}});
    for(const [years,k,points] of reference){
      advanceToRealSeconds(state,years!*60);
      expect(Math.abs(telemetry(state).k_value-k!)).toBeLessThan(0.0025);
      expect(Math.abs(telemetry(state).evo_points_earned_total-points!)).toBeLessThan(0.004);
    }
  });
  it('preserves identical random state, ledgers and queues under polling and offline catchup',()=>{
    const offline=createCivilization({seed:'replay-growth'});plan(offline);
    let polled=restoreSimulation(serializeSimulation(offline));
    for(let real=37;real<90000;real+=37){
      advanceToRealSeconds(polled,real);
      if(real%3700===0)polled=restoreSimulation(serializeSimulation(polled));
    }
    expect(advanceToRealSeconds(polled,90000)).toEqual(advanceToRealSeconds(offline,90000));
    expect(serializeSimulation(polled)).toBe(serializeSimulation(offline));
    expect(telemetry(polled)).toMatchObject({n_worlds:2,tech_levels_5:{persist:1},allocation_plan:{cursor_index:2}});
  });
  it('uses a seed-dependent, bounded stochastic trajectory whose RNG does not advance on reads',()=>{
    const a=createCivilization({seed:'alpha'}),b=createCivilization({seed:'beta'});
    const rng=a.evolution.growth!.rng_state;
    for(const real of [0,1,17,299.999])advanceToRealSeconds(a,real);
    expect(a.evolution.growth!.rng_state).toBe(rng);
    advanceToRealSeconds(a,300);
    expect(a.evolution.growth!.rng_state).not.toBe(rng);
    for(let real=600;real<=60000;real+=300){
      const view=advanceToRealSeconds(a,real)['self.telemetry'];
      advanceToRealSeconds(b,real);
      expect(view.pi_productivity.xi_stochastic_factor).toBeGreaterThanOrEqual(Math.exp(-0.65));
      expect(view.pi_productivity.xi_stochastic_factor).toBeLessThanOrEqual(Math.exp(0.65));
      expect(view.k_value).toBeLessThanOrEqual(0.86);
    }
    expect(telemetry(a).evo_points_earned_total).not.toBe(telemetry(b).evo_points_earned_total);
    expect(a.evolution.growth!.jump).not.toBe(0);
  });
  it('honors zero production damping without preventing free physical construction',()=>{
    const state=createCivilization({evolution:{inputs:{sdi_fraction:1}}});
    acceptCommand(state,command(state,1,{type:'allocate_evolution_point',dimension:'world_up'}));
    advanceToRealSeconds(state,60000);
    expect(telemetry(state)).toMatchObject({k_value:0.56,evo_points_avail:0,n_worlds:2,active_construction:null});
  });
  it('crosses minimum-K gates within a grid cell and never starts before the threshold',()=>{
    const state=createCivilization({evolution:{growth:{seed:'gate',stochastic:false}}});
    acceptCommand(state,command(state,1,{type:'configure_allocation_plan',enabled:true,items:[{dimension:'world_up',min_k:0.5601}]}));
    const crossing=0.0001/state.evolution.growth!.k_slope_per_yr*60;
    expect(crossing).toBeLessThan(300);
    advanceToRealSeconds(state,crossing-0.0001);
    expect(telemetry(state).active_construction).toBeNull();
    advanceToRealSeconds(state,crossing+0.0001);
    expect(telemetry(state).active_construction?.dimension).toBe('world_up');
    expect(telemetry(state).k_value).toBeGreaterThanOrEqual(0.5601);
    expect(state.evolution.growth!.next_tick_sim_ms).toBe(GROWTH_STEP_MS);
  });
  it('keeps all hidden frontier outcomes identical until a causal receipt unlocks capacity',()=>{
    const states=(['success','no-ack','unavailable'] as const).map(branch=>{
      const state=createCivilization({seed:'causal-growth',branch,evolution:{n_worlds:2,tech_levels_5:{persist:1}}});
      acceptCommand(state,fixtureCommand());return state;
    });
    for(const real of [240,2400,2639,2639.999999]){
      const views=states.map(state=>advanceToRealSeconds(state,real));
      expect(views[0]).toEqual(views[1]);expect(views[0]).toEqual(views[2]);
    }
    advanceToRealSeconds(states[0]!,2640);
    advanceToRealSeconds(states[1]!,2640);
    expect(telemetry(states[0]!).k_max_confirmed).toBeCloseTo(1.05+0.38*Math.log(2),12);
    expect(telemetry(states[1]!).k_max_confirmed).toBeCloseTo(0.86+0.14*Math.log(2),12);
    // Receipt changes future growth, never retroactively awards points or raises K.
    expect(telemetry(states[0]!).k_value).toBe(telemetry(states[1]!).k_value);
    expect(telemetry(states[0]!).evo_points_earned_total).toBe(telemetry(states[1]!).evo_points_earned_total);
  });
  it('runs legal construction, first expedition and delayed Tier 2 advancement end to end',()=>{
    const state=createCivilization({seed:'full-cold-loop'});plan(state);
    advanceToRealSeconds(state,24000);
    expect(telemetry(state)).toMatchObject({n_worlds:2,tech_levels_5:{persist:1},k_tier:1});
    acceptCommand(state,command(state,11,{type:'dispatch_expedition',target_node_id:'B'}));
    acceptCommand(state,command(state,12,{type:'configure_allocation_plan',enabled:true,items:[{dimension:'k_tier_up',target_level:2}]}));
    expect(telemetry(state).build_queue[0]?.status).toBe('waiting_prerequisite');
    advanceToRealSeconds(state,26639);
    expect(telemetry(state).n_eff_stars).toBe(1);
    advanceToRealSeconds(state,26640);
    expect(telemetry(state).n_eff_stars).toBe(2);
    advanceToRealSeconds(state,120000);
    expect(telemetry(state)).toMatchObject({k_tier:2,stage:'multi_star',allocation_plan:{cursor_index:1}});
    expect(telemetry(state).k_value).toBeGreaterThan(1.10);
  });
  it('clamps only after a received damage report, preserving already earned points',()=>{
    const state=createCivilization({seed:'damage',evolution:{n_worlds:2,tech_levels_5:{persist:2}}});
    acceptCommand(state,fixtureCommand());advanceToRealSeconds(state,120000);
    expect(telemetry(state).k_value).toBeGreaterThan(1.10);
    const before=telemetry(state).evo_points_earned_total;
    scheduleNodeReport(state,{event_id:'destroy-B',t_source_sim_s:state.t_sim_ms/1000,t_arrive_sim_s:(state.t_sim_ms+4*YEAR_MS)/1000,status:'destroyed'});
    advanceToRealSeconds(state,120239);
    expect(telemetry(state).k_value).toBeGreaterThan(1.10);
    advanceToRealSeconds(state,120240);
    expect(telemetry(state).k_value).toBeCloseTo(0.86+0.14*Math.log(2),12);
    expect(telemetry(state).evo_points_earned_total).toBeGreaterThan(before);
    expect(()=>restoreSimulation(serializeSimulation(state))).not.toThrow();
  });
  it('migrates fixed v4 worlds without restarting their economy or enabling random growth',()=>{
    const fixed=createSimulation();advanceToRealSeconds(fixed,1234);
    const old=JSON.parse(serializeSimulation(fixed));old.snapshot_version=4;delete old.evolution.growth;
    const restored=restoreSimulation(old);
    expect(restored.evolution.growth).toBeNull();
    expect(advanceToRealSeconds(restored,6000)).toEqual(advanceToRealSeconds(fixed,6000));
  });
  it('rejects impossible random-clock, slope and capacity snapshots',()=>{
    const state=createCivilization();advanceToRealSeconds(state,317);
    const raw=JSON.parse(serializeSimulation(state));
    for(const patch of [{next_tick_sim_ms:1},{k_slope_per_yr:100},{confirmed_stars:4},{k_max:2}]){
      expect(()=>restoreSimulation({...raw,evolution:{...raw.evolution,growth:{...raw.evolution.growth,...patch}}})).toThrow('INVALID_GROWTH_SNAPSHOT');
    }
  });
});
