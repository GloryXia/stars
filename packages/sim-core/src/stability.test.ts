import { describe,expect,it } from 'vitest';
import type { SeatCommandEnvelope } from '@stars/contracts';
import { acceptCommand,advanceToRealSeconds,createCivilization as createLiveCivilization,fixtureCommand,projectSeat,restoreSimulation,serializeSimulation,type SimulationState } from './index.js';
import { YEAR_MS } from './growth.js';

// Numerical reference tests isolate growth/SDI from the competing fatal clock.
const createCivilization=(options:Parameters<typeof createLiveCivilization>[0]={})=>createLiveCivilization({...options,instability:false});
const view=(state:SimulationState)=>projectSeat(state)['self.telemetry'];
function submit(state:SimulationState,id:number,action:SeatCommandEnvelope['action']) {
  return acceptCommand(state,{...fixtureCommand(),command_id:`019a8700-0000-7000-8000-${id.toString().padStart(12,'0')}`,base_view_version:state.view_version,action});
}

describe('causal, sampled civilization stability',()=>{
  it('starts with 16% population pressure and applies the same damping to K and points',()=>{
    const dynamic=createCivilization({evolution:{growth:{seed:'neutral',stochastic:false}}});
    const fixed=createCivilization({evolution:{growth:{seed:'neutral',stochastic:false},inputs:{sdi_fraction:0}}});
    expect(view(dynamic)).toMatchObject({sdi_mode:'dynamic',sdi_total:16,sdi_raw:16,sdi_breakdown:{involution:16,concentration:0,lag:0},r_sync_ly:1.4});
    expect(view(dynamic).pi_productivity.total).toBe(0.84);
    expect(view(dynamic).v_e_rate_per_sim_yr/view(fixed).v_e_rate_per_sim_yr).toBeCloseTo(0.84,14);
    advanceToRealSeconds(dynamic,60);advanceToRealSeconds(fixed,60);
    expect((view(dynamic).k_value-0.56)/(view(fixed).k_value-0.56)).toBeCloseTo(0.84,10);
    expect(view(dynamic).evo_points_avail).toBeLessThan(view(fixed).evo_points_avail);
  });
  it('relieves single-planet concentration only when the free second world finishes',()=>{
    const state=createCivilization({evolution:{inputs:{k_value:0.80},growth:{seed:'world',stochastic:false}}});
    expect(view(state).sdi_breakdown.concentration).toBeGreaterThan(40);
    submit(state,1,{type:'allocate_evolution_point',dimension:'world_up'});
    advanceToRealSeconds(state,1799.999);
    expect(view(state).sdi_breakdown.concentration).toBeGreaterThan(40);
    const points=view(state).evo_points_earned_total;
    advanceToRealSeconds(state,1800);
    expect(view(state)).toMatchObject({n_worlds:2,cradle_span_ly:0.05,sdi_breakdown:{concentration:5}});
    expect(view(state).sdi_total).toBeLessThan(25);
    expect(view(state).evo_points_earned_total).toBeGreaterThanOrEqual(points);
  });
  it('matches the neutral engineering-load reference and trait-scaled percentage units',()=>{
    const state=createCivilization({evolution:{n_worlds:2,k_tier:2,inputs:{k_value:0.73},growth:{seed:'load',d_self:1.1},s_org:1.05,tech_levels_5:{obs:2,strike:1,persist:1}}});
    // Independent evaluation of the GDD equations: engineering ratio 3.0,
    // information ratio below 1.4, D_self=1.1; U starts at zero.
    const result=view(state);
    expect(result.sdi_breakdown.involution).toBeCloseTo(8.44983107364417,12);
    expect(result.sdi_breakdown.concentration).toBeCloseTo(5.5,12);
    expect(result.sdi_breakdown.colony).toBeCloseTo(3.8123094930796992,12);
    expect(result.sdi_breakdown.tier_tech).toBeCloseTo(39.776,12);
    expect(result.sdi_raw).toBeCloseTo(57.53814056672387,12);
    expect(result.r_sync_ly).toBeCloseTo(2.205,12);
  });
  it('retains raw overload above 100%, halts production and still allows physical world construction',()=>{
    const state=createCivilization({evolution:{k_tier:3,tech_levels_5:{obs:4,strike:4}}});
    expect(view(state).sdi_raw).toBeGreaterThan(100);
    expect(view(state).sdi_total).toBe(100);
    submit(state,1,{type:'allocate_evolution_point',dimension:'world_up'});
    advanceToRealSeconds(state,1800);
    expect(view(state)).toMatchObject({n_worlds:2,k_value:0.56,evo_points_avail:0,pi_productivity:{total:0}});
  });
  it('uses analytic lag memory after receipt and decays it after local detachment',()=>{
    const state=createCivilization({evolution:{n_worlds:2,tech_levels_5:{persist:1}}});
    acceptCommand(state,fixtureCommand());
    advanceToRealSeconds(state,2640); // Receipt at 44 sim yr, not physical arrival at 40.
    const initial=view(state).sdi_breakdown.lag_strain_u;
    expect(initial).toBeLessThan(0.001);
    expect(view(state).active_sync_span_ly).toBe(4);
    advanceToRealSeconds(state,3600); // 60 sim yr.
    const before=view(state),target=(4/2.1)**2;
    expect(before.sdi_breakdown.lag_strain_u).toBeCloseTo(target+(initial-target)*Math.exp(-16/15),12);
    submit(state,2,{type:'set_node_coordination',node_id:'B',mode:'detach_outer_node'});
    expect(view(state).active_sync_span_ly).toBe(0.05);
    expect(view(state).sdi_breakdown.lag_strain_u).toBeCloseTo(before.sdi_breakdown.lag_strain_u,12);
    advanceToRealSeconds(state,4500);
    const cradle=(0.05/2.1)**2;
    expect(view(state).sdi_breakdown.lag_strain_u).toBeCloseTo(cradle+(before.sdi_breakdown.lag_strain_u-cradle)/Math.E,12);
  });
  it('grants the persist-3 adjustment once, keeps its negative raw contribution and decays over 40 years',()=>{
    const state=createCivilization({evolution:{n_worlds:2,k_tier:2,tech_levels_5:{persist:2},initial_points:4,growth:{seed:'pulse',d_self:1.1}}});
    submit(state,1,{type:'allocate_evolution_point',dimension:'persist'});
    advanceToRealSeconds(state,5400);
    expect(view(state)).toMatchObject({tech_levels_5:{persist:3},sdi_breakdown:{fixed:-30},sdi_total:0});
    expect(view(state).sdi_raw).toBeLessThan(0);
    const restored=restoreSimulation(serializeSimulation(state));
    advanceToRealSeconds(state,7800);advanceToRealSeconds(restored,7800);
    expect(view(state).sdi_breakdown.fixed).toBeCloseTo(-30/Math.E,12);
    expect(serializeSimulation(restored)).toBe(serializeSimulation(state));
  });
  it('does not resample on reads, hidden events, or commands that leave stability inputs unchanged',()=>{
    const state=createCivilization({evolution:{n_worlds:2,tech_levels_5:{persist:1}}});
    advanceToRealSeconds(state,73);
    const risk=structuredClone(state.evolution.stability),rng=state.evolution.growth!.rng_state;
    submit(state,1,{type:'configure_allocation_plan',enabled:false,items:[]});
    submit(state,2,{type:'dispatch_expedition',target_node_id:'B'});
    advanceToRealSeconds(state,299);
    for(let i=0;i<10;i++)projectSeat(state);
    expect(state.evolution.stability).toEqual(risk);
    expect(state.evolution.growth!.rng_state).toBe(rng);
  });
  it('migrates v5 growth saves without changing their fixed SDI or accrued balances',()=>{
    const state=createCivilization({evolution:{inputs:{sdi_fraction:0.27}}});
    advanceToRealSeconds(state,317);
    const old=JSON.parse(serializeSimulation(state));old.snapshot_version=5;delete old.evolution.stability;
    const restored=restoreSimulation(old);
    expect(view(restored).sdi_mode).toBe('fixed');
    expect(advanceToRealSeconds(restored,60000)).toEqual(advanceToRealSeconds(state,60000));
  });
  it('rejects corrupt sampled clocks, topology targets and damping',()=>{
    const state=createCivilization();advanceToRealSeconds(state,317);
    const raw=JSON.parse(serializeSimulation(state));
    for(const patch of [{sampled_sim_ms:6*YEAR_MS},{sampled_k:0.8},{lag_target:4},{lag_u:8},{source_signature:'wrong'}]) {
      expect(()=>restoreSimulation({...raw,evolution:{...raw.evolution,stability:{...raw.evolution.stability,...patch}}})).toThrow('INVALID_STABILITY_SNAPSHOT');
    }
    expect(()=>restoreSimulation({...raw,evolution:{...raw.evolution,inputs:{...raw.evolution.inputs,sdi_fraction:0}}})).toThrow();
  });
});
