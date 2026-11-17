import { describe, expect, it } from 'vitest';
import { KAPPA_T, SIM_SECONDS_PER_YEAR, type EvolutionDimension, type SeatCommandEnvelope } from '@stars/contracts';
import {
  acceptCommand, advanceToRealSeconds, createSimulation, fixtureCommand,
  projectSeat, restoreSimulation, serializeSimulation, type SimulationState,
} from './index.js';

const telemetry=(state:SimulationState)=>projectSeat(state)['self.telemetry'];
function allocation(state:SimulationState,dimension:EvolutionDimension,id:number,removeAt?:number):SeatCommandEnvelope {
  return {...fixtureCommand(),command_id:`019a8700-0000-7000-8000-${id.toString().padStart(12,'0')}`,
    base_view_version:state.view_version,
    action:{type:'allocate_evolution_point',dimension,...(removeAt===undefined ? {queue_op:'enqueue' as const} : {queue_op:'remove_at' as const,queue_index:removeAt})}};
}
function submit(state:SimulationState,dimension:EvolutionDimension,id:number,removeAt?:number) {
  return acceptCommand(state,allocation(state,dimension,id,removeAt));
}

describe('evolution ledger and FIFO construction',()=>{
  it('integrates the calibrated baseline and starts only after crossing one point',()=>{
    const state=createSimulation({evolution:{inputs:{k_value:0.56},k_tier:1}});
    const command=allocation(state,'persist',1);
    const result=acceptCommand(state,command);
    expect(telemetry(state)).toMatchObject({evo_points_avail:0,v_e_rate_per_sim_yr:0.0056,active_construction:null});
    expect(telemetry(state).v_e_rate_per_real_h).toBeCloseTo(0.336,12);
    expect(telemetry(state).build_queue[0]?.status).toBe('waiting_points');
    const crossingReal=60/0.0056;
    advanceToRealSeconds(state,crossingReal-0.001);
    expect(state.evolution.active_construction).toBeNull();
    advanceToRealSeconds(state,crossingReal+0.001);
    expect(state.evolution.spent_points).toBe(1);
    expect(telemetry(state).active_construction).toMatchObject({dimension:'persist',target_level:1});
    expect(state.evolution.active_construction!.started_sim_ms).toBeGreaterThanOrEqual(SIM_SECONDS_PER_YEAR*1000/0.0056);
    const before=serializeSimulation(state);
    expect(acceptCommand(state,command)).toEqual(result);
    expect(serializeSimulation(state)).toBe(before);
    const finish=state.evolution.active_construction!.finishes_sim_ms;
    advanceToRealSeconds(state,finish/(KAPPA_T*1000)+0.001);
    expect(telemetry(state).tech_levels_5.persist).toBe(1);
    expect(state.evolution.spent_points).toBe(1);
  });

  it('charges 1/2/4/8 only on start and chains the 15/45/90/180 year durations',()=>{
    const state=createSimulation({evolution:{k_tier:3,initial_points:15,inputs:{sdi_fraction:1}}});
    for (let id=1;id<=4;id++) submit(state,'obs',id);
    expect(telemetry(state)).toMatchObject({evo_points_avail:14,active_construction:{target_level:1,rem_real_s:900}});
    expect(state.evolution.build_queue).toHaveLength(3);
    for (const [real,level,spent] of [[900,1,3],[3600,2,7],[9000,3,15],[19800,4,15]]) {
      advanceToRealSeconds(state,real!);
      expect(state.evolution.tech_levels_5.obs).toBe(level);
      expect(state.evolution.spent_points).toBe(spent);
    }
    expect(telemetry(state)).toMatchObject({evo_points_avail:0,active_construction:null,build_queue:[]});
    expect(()=>submit(state,'obs',5)).toThrow('MAX_LEVEL_REACHED');
  });

  it('enforces five waiting slots, preserves FIFO and rejects mutations atomically',()=>{
    const state=createSimulation({evolution:{inputs:{sdi_fraction:1}}});
    for (const [index,dimension] of (['obs','persist','beacon','strike','world_up'] as const).entries()) submit(state,dimension,index+1);
    expect(state.evolution.build_queue.map(item=>item.status)).toEqual(['waiting_points','queued','queued','queued','queued']);
    const before=serializeSimulation(state);
    expect(()=>submit(state,'stealth',6)).toThrow('BUILD_QUEUE_FULL');
    expect(()=>submit(state,'world_up',7,0)).toThrow('INVALID_QUEUE_ITEM');
    expect(serializeSimulation(state)).toBe(before);
    // A free project cannot jump the blocked head.
    advanceToRealSeconds(state,3600);
    expect(state.evolution.n_worlds).toBe(1);
    expect(state.evolution.active_construction).toBeNull();
  });

  it('removing the blocked head immediately starts the next project without charging it',()=>{
    const state=createSimulation({evolution:{inputs:{sdi_fraction:1}}});
    submit(state,'obs',1);
    submit(state,'world_up',2);
    const remove=allocation(state,'obs',3,0);
    const result=acceptCommand(state,remove);
    expect(telemetry(state).active_construction).toMatchObject({dimension:'world_up',target_level:2,rem_real_s:1800});
    expect(acceptCommand(state,remove)).toEqual(result);
    advanceToRealSeconds(state,1800);
    expect(state.evolution.n_worlds).toBe(2);
    expect(state.evolution.spent_points).toBe(0);
  });

  it('recomputes duplicate targets after removal and caps queued world upgrades',()=>{
    const state=createSimulation({evolution:{inputs:{sdi_fraction:1}}});
    submit(state,'obs',1);
    for (let id=2;id<=4;id++) submit(state,'world_up',id);
    expect(()=>submit(state,'world_up',5)).toThrow('MAX_LEVEL_REACHED');
    submit(state,'world_up',6,1);
    submit(state,'obs',7,0);
    advanceToRealSeconds(state,3600);
    expect(state.evolution.n_worlds).toBe(3);
    expect(state.evolution.active_construction).toBeNull();
  });

  it('waits for the causal receipt, then resumes a tier upgrade and its dependent technology',()=>{
    const states=(['success','no-ack','unavailable'] as const).map(branch=>{
      const state=createSimulation({branch,evolution:{k_tier:1,inputs:{k_value:1.10},initial_points:10,tech_levels_5:{obs:2}}});
      acceptCommand(state,fixtureCommand());
      submit(state,'k_tier_up',2);
      submit(state,'obs',3);
      return state;
    });
    for (const real of [240,2400,2639]) {
      const views=states.map(state=>advanceToRealSeconds(state,real));
      expect(views[0]).toEqual(views[1]);
      expect(views[0]).toEqual(views[2]);
      expect(views[0]!['self.telemetry'].build_queue[0]?.status).toBe('waiting_prerequisite');
    }
    const success=states[0]!;
    advanceToRealSeconds(success,2640);
    expect(telemetry(success).active_construction).toMatchObject({dimension:'k_tier_up',rem_real_s:3600});
    advanceToRealSeconds(success,6240);
    expect(telemetry(success)).toMatchObject({k_tier:2,active_construction:{dimension:'obs',target_level:3}});
    expect(success.evolution.spent_points).toBe(4);
    for (const state of states.slice(1)) {
      advanceToRealSeconds(state,6240);
      expect(state.evolution.active_construction).toBeNull();
      expect(state.evolution.k_tier).toBe(1);
    }
  });

  it('produces identical ledgers, completion times and versions for polling, offline catchup and restore',()=>{
    const initial=createSimulation({evolution:{inputs:{k_value:0.56}}});
    submit(initial,'persist',1);
    submit(initial,'persist',2);
    submit(initial,'world_up',3);
    const offline=restoreSimulation(serializeSimulation(initial));
    let polled=restoreSimulation(serializeSimulation(initial));
    for (let time=37;time<40000;time+=37) {
      advanceToRealSeconds(polled,time);
      if (time===37*400 || time===37*800) polled=restoreSimulation(serializeSimulation(polled));
    }
    expect(advanceToRealSeconds(polled,40000)).toEqual(advanceToRealSeconds(offline,40000));
    expect(serializeSimulation(polled)).toBe(serializeSimulation(offline));
    expect(polled.evolution.tech_levels_5.persist).toBe(2);
    expect(polled.evolution.n_worlds).toBe(2);
  });

  it('scales scientific and physical construction with the specified traits',()=>{
    const science=createSimulation({evolution:{initial_points:1,inputs:{p_pop:1.12,i_sci:1.10}}});
    submit(science,'persist',1);
    expect(telemetry(science).active_construction!.rem_real_s).toBeCloseTo(900/(1.12*1.10),6);
    const physical=createSimulation({evolution:{inputs:{p_pop:1.12,i_sci:1.10}}});
    submit(physical,'world_up',1);
    expect(telemetry(physical).active_construction!.rem_real_s).toBeCloseTo(1800/1.12,6);
  });

  it('migrates version 2 without resetting causal events or backfilling points',()=>{
    const original=createSimulation();
    acceptCommand(original,fixtureCommand());
    advanceToRealSeconds(original,2400);
    const {evolution:_,...old}=JSON.parse(serializeSimulation(original));
    const restored=restoreSimulation({...old,snapshot_version:2});
    expect(restored.events).toEqual(original.events);
    expect(restored.receipts).toEqual(original.receipts);
    expect(telemetry(restored).evo_points_avail).toBe(0);
    advanceToRealSeconds(restored,2640);
    expect(telemetry(restored).controlled_node_count).toBe(2);
    expect(telemetry(restored).evo_points_earned_total).toBeCloseTo(4*telemetry(restored).v_e_rate_per_sim_yr,12);
    expect(()=>restoreSimulation({...old,snapshot_version:1})).toThrow();
  });

  it('rejects corrupt ledgers, future anchors and impossible construction snapshots',()=>{
    const state=createSimulation({evolution:{initial_points:1}});
    submit(state,'obs',1);
    const saved=JSON.parse(serializeSimulation(state));
    for (const evolution of [
      {...saved.evolution,spent_points:2},
      {...saved.evolution,anchor_sim_ms:1},
      {...saved.evolution,active_construction:{...saved.evolution.active_construction,target_level:4}},
      {...saved.evolution,active_construction:{...saved.evolution.active_construction,finishes_sim_ms:0}},
    ]) expect(()=>restoreSimulation({...saved,evolution})).toThrow('INVALID_EVOLUTION_SNAPSHOT');
  });
});
