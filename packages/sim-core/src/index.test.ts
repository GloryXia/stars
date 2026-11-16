import { describe, expect, it } from 'vitest';
import { timelineSchema } from '@stars/contracts';
import {
  createSimulation, acceptCommand, advanceToRealSeconds, projectSeat,
  serializeSimulation, restoreSimulation, fixtureCommand, scheduleNodeReport,
  buildM1Timeline, realToSimSeconds, lightTravelRealSeconds, KAPPA_T,
} from './index.js';
const telemetry = (state:ReturnType<typeof createSimulation>) => projectSeat(state)['self.telemetry'];
function started(branch:'success'|'no-ack'|'unavailable' = 'success') {
  const state = createSimulation({branch});
  acceptCommand(state,fixtureCommand());
  return state;
}

describe('single-clock causal reference',()=>{
  it('keeps the fixed conversion and rejects unsafe or reverse times',()=>{
    expect(lightTravelRealSeconds(4)).toBe(240);
    expect(realToSimSeconds(45)/31_557_600).toBe(0.75);
    const state = started();
    advanceToRealSeconds(state,240);
    expect(()=>advanceToRealSeconds(state,239)).toThrow('TIME_REVERSAL');
    expect(()=>realToSimSeconds(Number.MAX_SAFE_INTEGER)).toThrow('TIME_OUT_OF_RANGE');
    expect(()=>realToSimSeconds(NaN)).toThrow('TIME_OUT_OF_RANGE');
  });
  it('separates local joining from the 4-year return receipt',()=>{
    const state = started();
    advanceToRealSeconds(state,2400);
    expect(state.b_joined).toBe(true);
    expect(telemetry(state).controlled_node_count).toBe(1);
    advanceToRealSeconds(state,2639);
    expect(telemetry(state).controlled_node_count).toBe(1);
    advanceToRealSeconds(state,2640);
    expect(telemetry(state)).toMatchObject({controlled_node_count:2,known_reachable_node_count:1,r_persist:1.45});
    expect(projectSeat(state)['self.network'].nodes[1]).toEqual({node_id:'B',last_confirmed_status:'confirmed',t_source_sim_s:1_262_304_000,t_arrive_sim_s:1_388_534_400});
  });
  it('makes hidden local failures and dropped receipts indistinguishable before arrival',()=>{
    const states = [started(),started('unavailable'),started('no-ack')];
    for (const time of [0,1,239,240,1000,2400,2500,2639,2639.999999]) {
      const views = states.map(state=>advanceToRealSeconds(state,time));
      expect(views[0]).toEqual(views[1]);
      expect(views[0]).toEqual(views[2]);
    }
    const failed = states[1]!;
    advanceToRealSeconds(failed,2760);
    expect(telemetry(failed).controlled_node_count).toBe(1);
    expect(projectSeat(failed)['self.network'].pending_frontier_requests[0]?.status).toBe('timeout');
  });
  it('does not expose private fields in the exported timeline',()=>{
    const timeline = buildM1Timeline();
    expect(timelineSchema.safeParse(timeline).success).toBe(true);
    const json = JSON.stringify(timeline);
    for (const forbidden of ['b_joined','diagnostics','authorization_delay_real_s','branch','stable_seq','receipts']) expect(json).not.toContain(`"${forbidden}"`);
    expect(timeline.frames.map(frame=>frame.t_sim_s/KAPPA_T)).toEqual([0,240,2400,2639,2640,2760,3000]);
  });
  it('retains causal events and receipts across a JSON snapshot round trip',()=>{
    const original = started();
    advanceToRealSeconds(original,2400);
    const restored = restoreSimulation(serializeSimulation(original));
    for (const t of [2639,2640,2760,3000]) expect(advanceToRealSeconds(restored,t)).toEqual(advanceToRealSeconds(original,t));
    expect(restoreSimulation(serializeSimulation(restored))).toEqual(original);
  });
  it('waits for late authorization even when the frontier is already present',()=>{
    const state = createSimulation({authorization_delay_real_s:2400});
    acceptCommand(state,fixtureCommand());
    advanceToRealSeconds(state,2400);
    expect(state.b_joined).toBe(false);
    advanceToRealSeconds(state,2640);
    expect(state.b_joined).toBe(true);
    expect(telemetry(state).controlled_node_count).toBe(1);
    advanceToRealSeconds(state,2760);
    expect(projectSeat(state)['self.network'].pending_frontier_requests[0]?.status).toBe('timeout');
    advanceToRealSeconds(state,2880);
    expect(telemetry(state).controlled_node_count).toBe(2);
    expect(projectSeat(state)['self.network'].pending_frontier_requests[0]?.status).toBe('confirmed');
  });
  it('processes a receipt before a timeout at the same instant',()=>{
    const state = createSimulation({timeout_real_s:2640});
    acceptCommand(state,fixtureCommand());
    advanceToRealSeconds(state,2640);
    expect(projectSeat(state)['self.network'].pending_frontier_requests[0]?.status).toBe('confirmed');
    expect(state.view_version).toBe(3);
    expect(state.diagnostics.filter(e=>e.t_sim_s === realToSimSeconds(2640)).map(e=>e.kind)).toEqual(['receipt','timeout']);
  });
  it('applies a late receipt once and ignores older source samples',()=>{
    const state = started('no-ack');
    advanceToRealSeconds(state,2760);
    const report = {event_id:'late',t_source_sim_s:realToSimSeconds(2400),t_arrive_sim_s:realToSimSeconds(2800),status:'confirmed' as const};
    scheduleNodeReport(state,report);
    scheduleNodeReport(state,report);
    advanceToRealSeconds(state,2800);
    expect(telemetry(state).controlled_node_count).toBe(2);
    expect(state.view_version).toBe(4);
    expect(projectSeat(state)['self.network'].pending_frontier_requests[0]?.status).toBe('confirmed');
    scheduleNodeReport(state,{event_id:'older',t_source_sim_s:realToSimSeconds(2300),t_arrive_sim_s:realToSimSeconds(2900),status:'destroyed'});
    advanceToRealSeconds(state,2900);
    expect(telemetry(state).controlled_node_count).toBe(2);
    expect(state.view_version).toBe(4);
  });
  it('quantizes arrivals upward to the next simulation millisecond',()=>{
    const state = started('no-ack');
    const arrival = realToSimSeconds(2640) + 0.0004;
    scheduleNodeReport(state,{event_id:'fraction',t_source_sim_s:realToSimSeconds(2400),t_arrive_sim_s:arrival,status:'confirmed'});
    advanceToRealSeconds(state,arrival/KAPPA_T);
    expect(telemetry(state).controlled_node_count).toBe(1);
    advanceToRealSeconds(state,(Math.ceil(arrival*1000)/1000 + 0.000001)/KAPPA_T);
    expect(telemetry(state).controlled_node_count).toBe(2);
  });
  it('starts all schedule times relative to command acceptance',()=>{
    const state = createSimulation();
    advanceToRealSeconds(state,100);
    acceptCommand(state,fixtureCommand());
    advanceToRealSeconds(state,2500);
    expect(state.b_joined).toBe(true);
    advanceToRealSeconds(state,2739);
    expect(telemetry(state).controlled_node_count).toBe(1);
    advanceToRealSeconds(state,2740);
    expect(telemetry(state).controlled_node_count).toBe(2);
  });
});

describe('command arbitration',()=>{
  it('replays the original result and rejects same-key mutations without changing state',()=>{
    const state = createSimulation();
    const command = fixtureCommand();
    const result = acceptCommand(state,command);
    advanceToRealSeconds(state,2400);
    const before = serializeSimulation(state);
    expect(acceptCommand(state,command)).toEqual(result);
    expect(serializeSimulation(state)).toBe(before);
    expect(()=>acceptCommand(state,{...command,action:{type:'dispatch_expedition',target_node_id:'unknown'}})).toThrow('IDEMPOTENCY_CONFLICT');
    expect(serializeSimulation(state)).toBe(before);
  });
  it('checks generation, scope and view version, and does not implement false replanning',()=>{
    const state = createSimulation();
    const command = fixtureCommand();
    expect(()=>acceptCommand(state,{...command,civ_gen:2})).toThrow('SEAT_CONTEXT_MISMATCH');
    expect(()=>acceptCommand(state,{...command,base_view_version:5})).toThrow('STALE_VIEW_VERSION');
    expect(()=>acceptCommand(state,{...command,principal:{...command.principal,granted_scopes:['READ_SEAT_VIEW']}})).toThrow('MISSING_SCOPE');
    expect(state.command_started).toBe(false);
    acceptCommand(state,command);
    expect(()=>acceptCommand(state,{...command,command_id:'019a8700-0000-7000-8000-000000000002',base_view_version:1})).toThrow('The M1 fixture accepts one expedition');
  });
});

describe('node coordination',()=>{
  function coordination(state:ReturnType<typeof createSimulation>,mode:'detach_outer_node'|'sync',suffix:string) {
    return {...fixtureCommand(),command_id:`019a8700-0000-7000-8000-00000000000${suffix}`,base_view_version:state.view_version,action:{type:'set_node_coordination' as const,node_id:'B',mode}};
  }
  it('detaches locally without destroying B and requires a round trip before resynchronizing',()=>{
    const state = started();
    advanceToRealSeconds(state,2640);
    const detach = coordination(state,'detach_outer_node','2');
    const result = acceptCommand(state,detach);
    expect(acceptCommand(state,detach)).toEqual(result);
    expect(state.b_joined).toBe(true);
    expect(telemetry(state)).toMatchObject({controlled_node_count:1,detached_autonomous_node_count:1,active_sync_span_ly:0.01,r_persist:1});
    acceptCommand(state,coordination(state,'sync','3'));
    advanceToRealSeconds(state,3119);
    expect(telemetry(state).controlled_node_count).toBe(1);
    advanceToRealSeconds(state,3120);
    expect(telemetry(state)).toMatchObject({controlled_node_count:2,detached_autonomous_node_count:0,active_sync_span_ly:4,r_persist:1.45});
  });
  it('does not let unrelated delayed confirmations undo a local detach',()=>{
    const state = started();
    advanceToRealSeconds(state,2640);
    acceptCommand(state,coordination(state,'detach_outer_node','2'));
    scheduleNodeReport(state,{event_id:'unrequested-confirmation',t_source_sim_s:realToSimSeconds(2700),t_arrive_sim_s:realToSimSeconds(3000),status:'confirmed'});
    advanceToRealSeconds(state,3000);
    expect(telemetry(state).controlled_node_count).toBe(1);
    expect(telemetry(state).detached_autonomous_node_count).toBe(1);
  });
  it('keeps remote sample ordering independent from a later local detach decision',()=>{
    const state = started();
    advanceToRealSeconds(state,2640);
    const before = structuredClone(state.nodes.find(node=>node.node_id === 'B'));
    acceptCommand(state,coordination(state,'detach_outer_node','2'));
    expect(state.nodes.find(node=>node.node_id === 'B')).toEqual(before);
    expect(projectSeat(state)['self.network'].nodes[1]).toMatchObject({last_confirmed_status:'detached_autonomous',t_source_sim_s:realToSimSeconds(2400),t_arrive_sim_s:realToSimSeconds(2640)});
    scheduleNodeReport(state,{event_id:'damage-before-detach',t_source_sim_s:realToSimSeconds(2500),t_arrive_sim_s:realToSimSeconds(2740),status:'destroyed'});
    const resumed = restoreSimulation(serializeSimulation(state));
    advanceToRealSeconds(resumed,2740);
    expect(projectSeat(resumed)['self.network'].nodes[1]).toMatchObject({last_confirmed_status:'destroyed',t_source_sim_s:realToSimSeconds(2500),t_arrive_sim_s:realToSimSeconds(2740)});
    expect(telemetry(resumed).detached_autonomous_node_count).toBe(0);
  });
  it('accepts a legitimate synchronization receipt after its local timeout',()=>{
    const state = started('no-ack');
    scheduleNodeReport(state,{event_id:'join',t_source_sim_s:realToSimSeconds(2400),t_arrive_sim_s:realToSimSeconds(2640),status:'confirmed'});
    advanceToRealSeconds(state,2640);
    acceptCommand(state,coordination(state,'detach_outer_node','2'));
    const sync = coordination(state,'sync','3');
    acceptCommand(state,sync);
    advanceToRealSeconds(state,3240);
    expect(state.requests.find(request=>request.request_id === sync.command_id)?.status).toBe('timeout');
    expect(telemetry(state).controlled_node_count).toBe(1);
    scheduleNodeReport(state,{event_id:'delayed-sync',request_id:sync.command_id,t_source_sim_s:realToSimSeconds(2880),t_arrive_sim_s:realToSimSeconds(3300),status:'confirmed'});
    const resumed = restoreSimulation(serializeSimulation(state));
    advanceToRealSeconds(resumed,3300);
    expect(resumed.requests.find(request=>request.request_id === sync.command_id)?.status).toBe('confirmed');
    expect(telemetry(resumed)).toMatchObject({controlled_node_count:2,detached_autonomous_node_count:0,active_sync_span_ly:4});
  });
  it('never revives a known destroyed node from an in-flight handshake receipt',()=>{
    const state = started();
    advanceToRealSeconds(state,2640);
    acceptCommand(state,coordination(state,'detach_outer_node','2'));
    acceptCommand(state,coordination(state,'sync','3'));
    scheduleNodeReport(state,{event_id:'destroyed',t_source_sim_s:realToSimSeconds(2700),t_arrive_sim_s:realToSimSeconds(3000),status:'destroyed'});
    advanceToRealSeconds(state,3240);
    expect(telemetry(state).controlled_node_count).toBe(1);
    expect(projectSeat(state)['self.network'].nodes[1]?.last_confirmed_status).toBe('destroyed');
    expect(()=>acceptCommand(state,coordination(state,'sync','4'))).toThrow('INVALID_NODE');
  });
});
