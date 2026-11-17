import { z } from 'zod';
import {
  KAPPA_T, SIM_SECONDS_PER_YEAR, SCHEMA_VERSION, DEV_CONTEXT, HUMAN_SCOPES,
  seatContextSchema, seatCommandSchema, seatViewSchema, commandResultSchema,
  nodeReportSchema, linkReportSchema, frontierRequestSchema, expeditionSchema,
  timelineSchema, extinctionReportSchema, type SeatContext, type SeatCommandEnvelope, type CommandResult,
  type SeatViewProjection, type PublicCatalog, type SeatTimeline,
} from '@stars/contracts';
export { KAPPA_T, SIM_SECONDS_PER_YEAR };
import { SimError } from './errors.js';
import { stabilityNetwork,projectStability } from './stability.js';
import { instabilityStateSchema,createInstability,nextInstability,syncInstability,consumeCrisis,instabilityRates,type InstabilityKind } from './instability.js';
import { evolutionStateSchema, createEvolution, allocateEvolution, configureAllocationPlan, nextEvolutionTime, settleEvolution, tickGrowth, projectEvolution, validateEvolution, shockEvolution,haltEvolution,type EvolutionOptions } from './evolution.js';
export { SimError } from './errors.js';
const nonnegative = z.number().finite().nonnegative();
const integer = nonnegative.int().max(Number.MAX_SAFE_INTEGER);
const eventSchema = z.object({
  due_sim_ms: integer, phase_rank: integer, stable_seq: integer,
  kind: z.enum(['authorization', 'expedition_arrival', 'receipt', 'timeout', 'node_detach', 'node_sync']),
  request_id:z.string().optional(),
  report: z.object({request_id:z.string().optional(),event_id:z.string(),t_source_sim_s:nonnegative,status:z.enum(['confirmed','detached_autonomous','destroyed','seceded'])}).strict().optional(),
}).strict();
const stateSchema = z.object({
  snapshot_version: z.literal(7), context: seatContextSchema,
  evolution:evolutionStateSchema,
  instability:instabilityStateSchema.nullable().default(null),
  extinction:extinctionReportSchema.default({extinct:false,posthumous_callbacks:[]}),
  t_real_s: nonnegative, t_sim_ms:integer, view_version:integer,
  next_seq:integer, branch:z.enum(['success','no-ack','unavailable']),
  authorization_delay_real_s:nonnegative, timeout_real_s:nonnegative,
  expedition:expeditionSchema.nullable(), command_started:z.boolean(),
  authorized:z.boolean(), expedition_arrived:z.boolean(), b_joined:z.boolean(),
  events:z.array(eventSchema),
  nodes:z.array(nodeReportSchema), links:z.array(linkReportSchema),
  coordination:z.record(z.object({mode:z.enum(['detached','sync_pending','synced']),t_decided_sim_s:nonnegative,request_id:z.string().optional()}).strict()).default({}),
  requests:z.array(frontierRequestSchema),
  seen_reports:z.array(z.string()),
  receipts:z.record(z.object({fingerprint:z.string(),result:commandResultSchema}).strict()),
  diagnostics:z.array(z.object({kind:z.string(),t_sim_s:nonnegative}).strict()),
}).strict();
export type SimulationState = z.infer<typeof stateSchema>;
export type ScenarioBranch = SimulationState['branch'];
export interface SimulationOptions {
  context?: SeatContext;
  branch?: ScenarioBranch;
  authorization_delay_real_s?: number;
  timeout_real_s?: number;
  evolution?: EvolutionOptions;
  /** Disable only for isolated numerical references; new live civilizations enable it. */
  instability?: boolean;
}
export const PUBLIC_CATALOG: PublicCatalog = [
  {catalog_id:'A',label:'A',local_pos_vec3:[0,0,0],spectral_type:'G'},
  {catalog_id:'B',label:'B',local_pos_vec3:[4,0,0],spectral_type:'K'},
];

export function realToSimSeconds(realSeconds:number):number {
  if (!Number.isFinite(realSeconds) || realSeconds < 0 || !Number.isSafeInteger(Math.ceil(realSeconds * KAPPA_T * 1000))) throw new SimError('TIME_OUT_OF_RANGE',422);
  return realSeconds * KAPPA_T;
}
export function simToRealSeconds(simSeconds:number):number {
  if (!Number.isFinite(simSeconds) || simSeconds < 0) throw new SimError('TIME_OUT_OF_RANGE',422);
  const result = simSeconds / KAPPA_T;
  realToSimSeconds(result);
  return result;
}
export function lightTravelRealSeconds(distanceLy:number):number {
  if (!Number.isFinite(distanceLy) || distanceLy < 0) throw new SimError('DISTANCE_OUT_OF_RANGE',422);
  return simToRealSeconds(distanceLy * SIM_SECONDS_PER_YEAR);
}
function dueMs(simSeconds:number):number {
  const ms = Math.ceil(simSeconds * 1000);
  if (!Number.isSafeInteger(ms) || ms < 0) throw new SimError('TIME_OUT_OF_RANGE',422);
  return ms;
}
function enqueue(state:SimulationState, event:Omit<z.infer<typeof eventSchema>,'stable_seq'>):void {
  if (event.due_sim_ms < state.t_sim_ms) throw new SimError('EVENT_IN_PAST',422);
  state.events.push({...event,stable_seq:state.next_seq++});
  state.events.sort((a,b)=>a.due_sim_ms-b.due_sim_ms || a.phase_rank-b.phase_rank || a.stable_seq-b.stable_seq);
}
export function createSimulation(options:SimulationOptions = {}):SimulationState {
  const context = seatContextSchema.parse(options.context ?? DEV_CONTEXT);
  const expiry = realToSimSeconds(86400);
  return stateSchema.parse({
    snapshot_version:7,evolution:createEvolution(0,options.evolution),context,t_real_s:0,t_sim_ms:0,view_version:0,next_seq:0,
    branch:options.branch ?? 'success',authorization_delay_real_s:options.authorization_delay_real_s ?? 0,
    timeout_real_s:options.timeout_real_s ?? 2760,expedition:null,command_started:false,
    authorized:false,expedition_arrived:false,b_joined:false,events:[],
    nodes:[{node_id:'A',last_confirmed_status:'confirmed',t_source_sim_s:0,t_arrive_sim_s:0}],
    links:[
      {from_node_id:'A',to_node_id:'B',available:true,t_source_sim_s:0,t_arrive_sim_s:0,valid_until_sim_s:expiry},
      {from_node_id:'B',to_node_id:'A',available:true,t_source_sim_s:0,t_arrive_sim_s:0,valid_until_sim_s:expiry},
    ],coordination:{},requests:[],seen_reports:[],receipts:{},diagnostics:[],
  });
}

/** Real Tier 1 initialization; the isolated M1 reference remains createSimulation(). */
export function createCivilization(options:SimulationOptions & {seed?:string} = {}):SimulationState {
  const context=options.context??DEV_CONTEXT;
  const state=createSimulation({...options,context,evolution:{dynamic_sdi:options.evolution?.inputs?.sdi_fraction===undefined,...options.evolution,growth:{
    seed:options.seed??`${context.epoch_id}:${context.seat_id}:${context.civ_gen}`,
    ...options.evolution?.growth,
  }}});
  if(options.instability!==false && state.evolution.stability){
    state.instability=createInstability(state.evolution.growth!.seed,0,state.evolution.inputs.sdi_fraction);
    settleInstability(state);
  }
  return state;
}

export function acceptCommand(state:SimulationState, raw:SeatCommandEnvelope):CommandResult {
  const parsed = seatCommandSchema.safeParse(raw);
  if (!parsed.success) throw new SimError('INVALID_COMMAND',400);
  const command = parsed.data;
  if (command.epoch_id !== state.context.epoch_id || command.seat_id !== state.context.seat_id || command.civ_gen !== state.context.civ_gen) throw new SimError('SEAT_CONTEXT_MISMATCH',403);
  const scope=command.action.type==='allocate_evolution_point' || command.action.type==='configure_allocation_plan' ? 'ALLOW_AGENT_TECH_ALLOC' : 'CONTROL_SPHERE_STEALTH';
  if (!command.principal.granted_scopes.includes(scope)) throw new SimError('MISSING_SCOPE',403);
  const key = `${command.principal.kind}:${command.command_id}`;
  const fingerprint = JSON.stringify(command);
  const previous = state.receipts[key];
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw new SimError('IDEMPOTENCY_CONFLICT',409);
    return structuredClone(previous.result);
  }
  if(state.extinction.extinct)throw new SimError('CIVILIZATION_EXTINCT',409);
  if (command.base_view_version !== state.view_version) throw new SimError('STALE_VIEW_VERSION',409);
  if (command.action.type === 'allocate_evolution_point' || command.action.type === 'configure_allocation_plan') {
    // Rejected commands must never partially mutate the persisted simulation.
    const evolution=structuredClone(state.evolution);
    if(command.action.type==='allocate_evolution_point') allocateEvolution(evolution,command.action,state.t_sim_ms,confirmedStarCount(state));
    else {
      const {type:_,...config}=command.action;
      configureAllocationPlan(evolution,config,state.t_sim_ms,confirmedStarCount(state));
    }
    state.evolution=evolution;
    settleInstability(state);
    state.view_version++;
    const result:CommandResult={command_id:command.command_id,accepted:true,view_version:state.view_version};
    state.receipts[key]={fingerprint,result:structuredClone(result)};
    return result;
  }
  if (command.action.type === 'set_node_coordination') return coordinateNode(state,command,key,fingerprint);
  if(state.evolution.growth && (state.evolution.n_worlds<2 || state.evolution.tech_levels_5.persist<1))throw new SimError('EXPEDITION_LOCKED',409);
  if (state.command_started) throw new SimError('SCENARIO_ALREADY_STARTED',409,'The M1 fixture accepts one expedition; start a new isolated fixture to replay.');
  if (command.action.target_node_id !== 'B') throw new SimError('INVALID_TARGET',422,'The M1 catalog fixture exposes B as its expedition target.');
  const start = state.t_sim_ms / 1000;
  const arrivalSim = start + 40 * SIM_SECONDS_PER_YEAR;
  const authSim = start + realToSimSeconds(state.authorization_delay_real_s) + 4 * SIM_SECONDS_PER_YEAR;
  const timeoutSim = start + realToSimSeconds(state.timeout_real_s);
  // Validate all event times before changing the state.
  for (const t of [arrivalSim,authSim,timeoutSim]) dueMs(t);
  state.command_started = true;
  state.expedition = {
    exp_id:command.command_id,target_node_id:'B',
    t_launch_sim_s:start,eta_sim_s:arrivalSim,status:'in_flight',
    origin_local_pos_vec3:[0,0,0],target_local_pos_vec3:[4,0,0],speed_c:0.1,
  };
  state.view_version++;
  const sent = start + realToSimSeconds(state.authorization_delay_real_s);
  state.requests.push({request_id:command.command_id,intent:'join',t_created_sim_s:start,t_sent_sim_s:sent,status:'pending',target_node_id:'B'});
  enqueue(state,{kind:'authorization',due_sim_ms:dueMs(authSim),phase_rank:0});
  enqueue(state,{kind:'expedition_arrival',due_sim_ms:dueMs(arrivalSim),phase_rank:1});
  enqueue(state,{kind:'timeout',due_sim_ms:dueMs(timeoutSim),phase_rank:3,request_id:command.command_id});
  const result:CommandResult = {command_id:command.command_id,accepted:true,exp_id:command.command_id,view_version:state.view_version};
  state.receipts[key] = {fingerprint,result:structuredClone(result)};
  return result;
}
function coordinateNode(state:SimulationState,command:SeatCommandEnvelope,key:string,fingerprint:string):CommandResult {
  if (command.action.type !== 'set_node_coordination') throw new SimError('INVALID_COMMAND',400);
  const action = command.action;
  const node = state.nodes.find(candidate=>candidate.node_id === action.node_id);
  // Arbitration uses only confirmed knowledge; do not inspect remote physical truth here.
  if (!node || node.node_id === 'A' || node.last_confirmed_status === 'destroyed' || node.last_confirmed_status === 'seceded') throw new SimError('INVALID_NODE',422);
  const now = state.t_sim_ms/1000;
  const localArrival = now + 4 * SIM_SECONDS_PER_YEAR;
  dueMs(localArrival + 6 * SIM_SECONDS_PER_YEAR);
  const locallyDetached = state.coordination[node.node_id]?.mode === 'detached' || state.coordination[node.node_id]?.mode === 'sync_pending';
  const effectiveStatus = node.last_confirmed_status === 'confirmed' && locallyDetached ? 'detached_autonomous' : node.last_confirmed_status;
  if (command.action.mode === 'detach_outer_node') {
    if (effectiveStatus !== 'confirmed') throw new SimError('NODE_NOT_SYNCHRONIZED',409);
    // Keep this coordinator decision separate from remote source-sample ordering.
    state.coordination[node.node_id] = {mode:'detached',t_decided_sim_s:now};
    enqueue(state,{kind:'node_detach',due_sim_ms:dueMs(localArrival),phase_rank:0,request_id:command.command_id});
  } else {
    if (effectiveStatus !== 'detached_autonomous') throw new SimError('NODE_NOT_DETACHED',409);
    if (state.requests.some(request=>request.target_node_id === node.node_id && request.status === 'pending')) throw new SimError('COORDINATION_PENDING',409);
    state.coordination[node.node_id] = {mode:'sync_pending',t_decided_sim_s:now,request_id:command.command_id};
    state.requests.push({request_id:command.command_id,intent:'join',t_created_sim_s:now,t_sent_sim_s:now,status:'pending',target_node_id:node.node_id});
    enqueue(state,{kind:'node_sync',due_sim_ms:dueMs(localArrival),phase_rank:0,request_id:command.command_id});
    enqueue(state,{kind:'timeout',due_sim_ms:dueMs(now + 10 * SIM_SECONDS_PER_YEAR),phase_rank:3,request_id:command.command_id});
  }
  state.view_version++;
  if (settleEvolution(state.evolution,state.t_sim_ms,confirmedStarCount(state))) state.view_version++;
  settleInstability(state);
  const result:CommandResult = {command_id:command.command_id,accepted:true,view_version:state.view_version};
  state.receipts[key] = {fingerprint,result:structuredClone(result)};
  return result;
}
function tryJoin(state:SimulationState,simSeconds:number):void {
  if (!state.authorized || !state.expedition_arrived || state.b_joined || state.branch === 'unavailable') return;
  state.b_joined = true;
  state.diagnostics.push({kind:'local_join',t_sim_s:simSeconds});
  if (state.branch === 'success') enqueue(state,{
    kind:'receipt',due_sim_ms:dueMs(simSeconds + 4 * SIM_SECONDS_PER_YEAR),phase_rank:2,
    report:{event_id:'B:join:1',request_id:state.expedition!.exp_id,t_source_sim_s:simSeconds,status:'confirmed'},
  });
}
/** Test/worker adapter for an already causal report; never exposed on a client API. */
export function scheduleNodeReport(state:SimulationState,report:{event_id:string,request_id?:string,t_source_sim_s:number,t_arrive_sim_s:number,status:'confirmed'|'detached_autonomous'|'destroyed'|'seceded'}):void {
  if (report.t_arrive_sim_s < report.t_source_sim_s + 4 * SIM_SECONDS_PER_YEAR) throw new SimError('NON_CAUSAL_REPORT',422);
  enqueue(state,{kind:'receipt',due_sim_ms:dueMs(report.t_arrive_sim_s),phase_rank:2,
    report:{event_id:report.event_id,request_id:report.request_id,t_source_sim_s:report.t_source_sim_s,status:report.status}});
}
function receiveReport(state:SimulationState,event:z.infer<typeof eventSchema>):void {
  if(state.extinction.extinct)return;
  const report = event.report;
  if (!report || state.seen_reports.includes(report.event_id)) return;
  state.seen_reports.push(report.event_id);
  const current = state.nodes.find(node=>node.node_id === 'B');
  if (current && (current.last_confirmed_status === 'destroyed' || current.last_confirmed_status === 'seceded' || current.t_source_sim_s >= report.t_source_sim_s)) return;
  const next = {node_id:'B',last_confirmed_status:report.status,t_source_sim_s:report.t_source_sim_s,t_arrive_sim_s:event.due_sim_ms/1000};
  if (current) Object.assign(current,next); else state.nodes.push(next);
  if (report.status === 'confirmed') {
    const local = state.coordination.B;
    const request = state.requests.find(request=>request.request_id === report.request_id && (request.status === 'pending' || request.status === 'timeout'));
    if (local?.mode === 'sync_pending' && local.request_id === report.request_id && request) state.coordination.B = {mode:'synced',t_decided_sim_s:local.t_decided_sim_s,request_id:local.request_id};
    for (const request of state.requests) if (request.request_id === (report.request_id ?? state.expedition?.exp_id)) request.status = 'confirmed';
    if (state.expedition) state.expedition.status = 'confirmed';
  }
  state.view_version++;
}
function confirmedStarCount(state:SimulationState):number {
  return state.nodes.filter(node=>node.last_confirmed_status==='confirmed'
    && state.coordination[node.node_id]?.mode!=='detached'
    && state.coordination[node.node_id]?.mode!=='sync_pending').length;
}
function extinguish(state:SimulationState,cause:'ColdWar_SelfDestruct'|'SDI_System_Collapse'):void {
  if(state.extinction.extinct)return;
  haltEvolution(state.evolution,state.t_sim_ms);
  state.extinction={extinct:true,cause,t_extinct_sim_s:state.t_sim_ms/1000,posthumous_callbacks:[]};
  state.view_version++;
}
/** Thresholds are edge-triggered, as in the calibration model. Secession does
 * not erase lag memory or immediately cascade into a second collapse. */
function settleInstability(state:SimulationState,due?:InstabilityKind):void {
  const hazard=state.instability;
  if(!hazard || state.extinction.extinct)return;
  const now=state.t_sim_ms,evolution=state.evolution;
  const raw=projectStability(evolution,confirmedStarCount(state)).sdi_raw/100;
  if(raw<1)hazard.collapse_armed=true;
  else if(hazard.collapse_armed){
    hazard.collapse_armed=false;
    const network=stabilityNetwork(evolution,confirmedStarCount(state));
    const outer=state.nodes.find(node=>node.node_id==='B'&&node.last_confirmed_status==='confirmed'&&state.coordination.B?.mode!=='detached'&&state.coordination.B?.mode!=='sync_pending');
    if(outer && network.active_sync_span_ly>network.r_sync_ly){
      // The only remote node is B at 4 ly, outside max(.01,min(.5R,.8Rsync)).
      outer.last_confirmed_status='seceded';outer.t_source_sim_s=now/1000;outer.t_arrive_sim_s=now/1000;
      delete state.coordination.B;
      for(const request of state.requests)if(request.target_node_id==='B'&&request.status==='pending')request.status='timeout';
      settleEvolution(evolution,now,confirmedStarCount(state));
      hazard.crisis_count++;hazard.last_event={kind:'secession',t_sim_s:now/1000};
      state.view_version++;
    }else if(evolution.tech_levels_5.persist>=3 && !hazard.shield_used){
      hazard.shield_used=true;
      shockEvolution(evolution,now,0,0.5);
      hazard.last_event={kind:'shield',t_sim_s:now/1000};
      state.view_version++;
    }else extinguish(state,'SDI_System_Collapse');
  }
  if(state.extinction.extinct)return;
  // A sampled fatal clock is not cancelled by a construction/receipt at the
  // same instant. The two clocks have already accumulated their OLD exposure.
  if(due==='fatal'){extinguish(state,'ColdWar_SelfDestruct');return;}
  if(due==='crisis'){
    consumeCrisis(hazard,now);
    const k_lost=shockEvolution(evolution,now,0.015);
    hazard.crisis_count++;hazard.last_event={kind:'local_crisis',t_sim_s:now/1000,k_lost};
    state.view_version++;
    // Lower K can immediately overload advanced observation technology.
    settleInstability(state);
    return;
  }
  if(projectStability(evolution,confirmedStarCount(state)).sdi_raw<100)hazard.collapse_armed=true;
  syncInstability(hazard,now,evolution.inputs.sdi_fraction);
}
export function advanceToRealSeconds(state:SimulationState,absoluteRealS:number):SeatViewProjection {
  const target = Math.floor(realToSimSeconds(absoluteRealS)*1000);
  if (target < state.t_sim_ms) throw new SimError('TIME_REVERSAL',422);
  while (true) {
    const instability=nextInstability(state.extinction.extinct?null:state.instability);
    const next=Math.min(state.events[0]?.due_sim_ms ?? Infinity,nextEvolutionTime(state.evolution,state.t_sim_ms,confirmedStarCount(state)),instability.time);
    if (next>target) break;
    state.t_sim_ms=next;
    if(tickGrowth(state.evolution,next))state.view_version++;
    // Apply every causal event at this instant before evaluating prerequisites.
    while (state.events[0] && state.events[0].due_sim_ms===next) {
      const event = state.events.shift()!;
      const simSeconds = event.due_sim_ms/1000;
      state.diagnostics.push({kind:event.kind,t_sim_s:simSeconds});
      switch (event.kind) {
        case 'authorization': state.authorized = true; tryJoin(state,simSeconds); break;
        case 'expedition_arrival':
          state.expedition_arrived = true;
          // Locally predicted trajectory completion, identical even if B is unavailable.
          if (!state.extinction.extinct && state.expedition?.status === 'in_flight') { state.expedition.status = 'awaiting_receipt'; state.view_version++; }
          tryJoin(state,simSeconds); break;
        case 'receipt': receiveReport(state,event); break;
        case 'node_detach': break; // The local installation survives and keeps running autonomously.
        case 'node_sync':
          if (state.b_joined && state.branch !== 'no-ack') enqueue(state,{kind:'receipt',due_sim_ms:dueMs(simSeconds + 4 * SIM_SECONDS_PER_YEAR),phase_rank:2,report:{event_id:`B:sync:${event.request_id}`,request_id:event.request_id,t_source_sim_s:simSeconds,status:'confirmed'}});
          break;
        case 'timeout':
          if(state.extinction.extinct)break;
          for (const request of state.requests) if (request.status === 'pending' && request.request_id === event.request_id) { request.status = 'timeout'; if (state.expedition?.exp_id === event.request_id) state.expedition.status = 'timeout'; state.view_version++; }
          break;
      }
    }
    if (settleEvolution(state.evolution,next,confirmedStarCount(state))) state.view_version++;
    settleInstability(state,next===instability.time?instability.kind:undefined);
  }
  state.t_sim_ms = target;
  state.t_real_s = absoluteRealS;
  return projectSeat(state);
}
/** This is the only world-to-client conversion. Hidden local fields never escape. */
export function projectSeat(state:SimulationState):SeatViewProjection {
  const simSeconds = state.t_sim_ms/1000;
  const nodes = state.nodes.map(node=>{
    const mode = state.coordination[node.node_id]?.mode;
    return node.last_confirmed_status === 'confirmed' && (mode === 'detached' || mode === 'sync_pending')
      ? {...node,last_confirmed_status:'detached_autonomous' as const} : node;
  });
  const controlled = nodes.filter(node=>node.last_confirmed_status === 'confirmed');
  const detached = nodes.filter(node=>node.last_confirmed_status === 'detached_autonomous');
  const knownAt=state.extinction.extinct ? state.extinction.t_extinct_sim_s : simSeconds;
  const reachable = controlled.filter(node=>node.node_id !== 'A' && state.links.some(link=>link.from_node_id === 'A' && link.to_node_id === node.node_id && link.available && link.valid_until_sim_s >= knownAt)).length;
  return seatViewSchema.parse({
    ...state.context,schema_version:SCHEMA_VERSION,view_version:state.view_version,t_sim_s:simSeconds,
    'self.telemetry':{...projectEvolution(state.evolution,state.t_sim_ms,controlled.length),
      instability:{enabled:state.instability!==null,crisis_count:state.instability?.crisis_count??0,shield_available:!!state.instability&&!state.extinction.extinct&&state.evolution.tech_levels_5.persist>=3&&!state.instability.shield_used,last_event:state.instability?.last_event??null},
      ...(state.evolution.stability ? stabilityNetwork(state.evolution,controlled.length) : {cradle_span_ly:0.01,active_sync_span_ly:controlled.length>1?4:0.01,r_sync_ly:null,r_persist:controlled.length>1?1.45:1}),
      expeditions_in_flight_count:state.expedition?.status === 'in_flight' ? 1 : 0,controlled_node_count:controlled.length,detached_autonomous_node_count:detached.length,known_reachable_node_count:reachable},
    'self.network':{nodes,links:state.links,pending_frontier_requests:state.requests,active_expeditions:state.expedition ? [state.expedition] : []},
    'lightcone.wavefronts':[],
    'sentinel.reflex_rules':{max_slots:3,trigger_mode:'offline_only',grace_period_real_s:30,armed_now:false,active_rules:[]},
    'extinction.report':state.extinction,
  });
}
export function serializeSimulation(state:SimulationState):string { return JSON.stringify(stateSchema.parse(state)); }
export function restoreSimulation(snapshot:unknown):SimulationState {
  let raw:unknown=typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
  if (raw && typeof raw==='object' && 'snapshot_version' in raw && raw.snapshot_version===2) {
    const legacy=stateSchema.omit({evolution:true}).extend({snapshot_version:z.literal(2)}).parse(raw);
    // Version 2 had no economy. Start its ledger at the saved clock, without
    // rewriting the world or awarding retroactive, previously nonexistent points.
    raw={...legacy,snapshot_version:7,evolution:createEvolution(legacy.t_sim_ms)};
  } else if(raw && typeof raw==='object' && 'snapshot_version' in raw && (raw.snapshot_version===3 || raw.snapshot_version===4 || raw.snapshot_version===5 || raw.snapshot_version===6)) {
    const legacy=stateSchema.extend({snapshot_version:z.union([z.literal(3),z.literal(4),z.literal(5),z.literal(6)])}).parse(raw);
    raw={...legacy,snapshot_version:7};
  }
  const state = stateSchema.parse(raw);
  if (Math.floor(realToSimSeconds(state.t_real_s)*1000) !== state.t_sim_ms) throw new SimError('INVALID_SNAPSHOT_CLOCK',422);
  validateEvolution(state.evolution,state.t_sim_ms);
  const hazard=state.instability,death=state.extinction;
  if(death.extinct ? !hazard || state.evolution.halted_sim_ms===null || state.evolution.halted_sim_ms/1000!==death.t_extinct_sim_s : state.evolution.halted_sim_ms!==null)throw new SimError('INVALID_EXTINCTION_SNAPSHOT',422);
  if(hazard){
    const rates=instabilityRates(state.evolution.inputs.sdi_fraction);
    if(!state.evolution.stability || hazard.anchor_sim_ms>state.t_sim_ms || (hazard.last_event?.t_sim_s??0)>state.t_sim_ms/1000
      || (!death.extinct&&(hazard.fatal_rate!==rates.fatal || hazard.crisis_rate!==rates.crisis || nextInstability(hazard).time<=state.t_sim_ms)))throw new SimError('INVALID_INSTABILITY_SNAPSHOT',422);
  }
  if(state.evolution.growth?.confirmed_stars!==undefined && state.evolution.growth.confirmed_stars!==confirmedStarCount(state))throw new SimError('INVALID_GROWTH_SNAPSHOT',422);
  if (state.events.some(event=>event.due_sim_ms < state.t_sim_ms || event.stable_seq >= state.next_seq)) throw new SimError('INVALID_SNAPSHOT_QUEUE',422);
  if (new Set(state.events.map(event=>event.stable_seq)).size !== state.events.length) throw new SimError('INVALID_SNAPSHOT_QUEUE',422);
  state.events.sort((a,b)=>a.due_sim_ms-b.due_sim_ms || a.phase_rank-b.phase_rank || a.stable_seq-b.stable_seq);
  return state;
}
export function fixtureCommand(context:SeatContext = DEV_CONTEXT):SeatCommandEnvelope {
  return {...context,command_id:'019a8700-0000-7000-8000-000000000001',base_view_version:0,
    principal:{kind:'human',subject_id:'m1-fixture',granted_scopes:[...HUMAN_SCOPES]},action:{type:'dispatch_expedition',target_node_id:'B',drive_mode:'standard_010c'}};
}
export function buildM1Timeline(branch:ScenarioBranch = 'success'):SeatTimeline {
  const state = createSimulation({branch});
  const initial_snapshot = projectSeat(state);
  acceptCommand(state,fixtureCommand(state.context));
  const frames = [0,240,2400,2639,2640,2760,3000].map(realS=>{
    const snapshot = advanceToRealSeconds(state,realS);
    return {t_sim_s:snapshot.t_sim_s,view_version:snapshot.view_version,snapshot};
  });
  return timelineSchema.parse({schema_version:SCHEMA_VERSION,...state.context,kappa_t:KAPPA_T,initial_snapshot,frames});
}
