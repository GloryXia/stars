import { z } from 'zod';
import {
  KAPPA_T, SIM_SECONDS_PER_YEAR, buildQueueItemSchema, evolutionDimensionSchema,
  techLevelsSchema, allocationPlanSchema, type AllocationPlanConfig, type EvolutionDimension, type SeatCommandEnvelope,
} from '@stars/contracts';
import { SimError } from './errors.js';
import { stabilityStateSchema,createStability,sampleStability,projectStability,stabilitySignature,stabilityNetwork } from './stability.js';
import { growthStateSchema,createGrowth,confirmedKCap,kAt,resetSlope,sampleXi,advanceNoise,segmentPoints,GROWTH_STEP_MS,type GrowthOptions } from './growth.js';

const nonnegative = z.number().finite().nonnegative();
const integer = nonnegative.int().max(Number.MAX_SAFE_INTEGER);
const YEAR_MS = SIM_SECONDS_PER_YEAR * 1000;
const TECH_YEARS = [15,45,90,180] as const;

/** Explicit SDI inputs remain available for fixed reference simulations. */
export const evolutionInputsSchema = z.object({
  k_value:z.number().finite().min(0.56).max(2),
  xi:z.number().finite().min(-0.65).max(0.65),
  sdi_fraction:nonnegative.max(1),
  p_pop:z.number().finite().min(0.88).max(1.12),
  i_sci:z.number().finite().min(0.90).max(1.10),
}).strict();
export const evolutionStateSchema = z.object({
  inputs:evolutionInputsSchema,
  growth:growthStateSchema.nullable().default(null),
  stability:stabilityStateSchema.nullable().default(null),
  halted_sim_ms:integer.nullable().default(null),
  k_tier:integer.min(1).max(3),n_worlds:integer.min(1).max(4),tech_levels_5:techLevelsSchema,
  // Anchored integration avoids dependence on HTTP polling or offline step size.
  anchor_sim_ms:integer,initial_points:nonnegative,spent_points:nonnegative,
  allocation_plan:allocationPlanSchema.default({enabled:false,cursor_index:0,items:[]}),
  plan_target_level:integer.min(1).max(4).nullable().default(null),
  build_queue:z.array(buildQueueItemSchema.extend({plan_index:integer.max(19).optional()})).max(5),
  active_construction:z.object({
    dimension:evolutionDimensionSchema,target_level:integer.min(1).max(4),
    started_sim_ms:integer,finishes_sim_ms:integer,plan_index:integer.max(19).optional(),
  }).strict().nullable(),
}).strict();
export type EvolutionState = z.infer<typeof evolutionStateSchema>;
export interface EvolutionOptions {
  inputs?: Partial<z.infer<typeof evolutionInputsSchema>>;
  k_tier?: number;
  n_worlds?: number;
  tech_levels_5?: Partial<z.infer<typeof techLevelsSchema>>;
  initial_points?: number;
  growth?: GrowthOptions;
  dynamic_sdi?: boolean;
  s_org?: number;
}
export function createEvolution(anchorSimMs = 0, options:EvolutionOptions = {}):EvolutionState {
  const state=evolutionStateSchema.parse({
    inputs:{k_value:options.growth ? 0.56 : 1.10,xi:0,sdi_fraction:0,p_pop:1,i_sci:1,...options.inputs},
    growth:options.growth ? createGrowth(anchorSimMs,options.growth,options.n_worlds??1) : null,
    k_tier:options.k_tier ?? (options.growth ? 1 : 2),n_worlds:options.n_worlds ?? 1,
    tech_levels_5:{obs:0,beacon:0,stealth:0,strike:0,persist:0,...options.tech_levels_5},
    anchor_sim_ms:anchorSimMs,initial_points:options.initial_points ?? 0,spent_points:0,
    build_queue:[],active_construction:null,
  });
  if(state.growth){
    state.inputs.k_value=Math.min(state.inputs.k_value,state.growth.k_max);
    state.inputs.xi=sampleXi(state.growth,anchorSimMs);
    if(options.dynamic_sdi){
      state.stability=createStability(anchorSimMs,options.s_org??1);
      sampleStability(state,anchorSimMs,1);
    }
    resetSlope(state.inputs,state.growth);
  }
  return state;
}
export function productivity(state:EvolutionState,now=state.growth?.segment_sim_ms??state.anchor_sim_ms) {
  now=state.halted_sim_ms??now;
  const pi_exp = Math.exp(1.35 * (kAt(state.inputs,state.growth,now) - 0.56));
  const xi_stochastic_factor = Math.exp(state.inputs.xi);
  return {pi_exp,xi_stochastic_factor,total:state.halted_sim_ms===null ? pi_exp * xi_stochastic_factor * (1-state.inputs.sdi_fraction) : 0};
}
export function evolutionRate(state:EvolutionState,now=state.growth?.segment_sim_ms??state.anchor_sim_ms):number {
  return 0.0056 * productivity(state,now).total * state.inputs.p_pop * state.inputs.i_sci;
}
function earned(state:EvolutionState,now:number):number {
  now=state.halted_sim_ms??now;
  if(state.growth)return state.growth.earned_at_segment+segmentPoints(evolutionRate(state),state.growth.k_slope_per_yr,(now-state.growth.segment_sim_ms)/YEAR_MS);
  return evolutionRate(state) * ((now-state.anchor_sim_ms)/YEAR_MS);
}
function commitGrowthSegment(state:EvolutionState,now:number):void {
  const growth=state.growth!;
  growth.earned_at_segment=earned(state,now);
  state.inputs.k_value=kAt(state.inputs,growth,now);
  growth.segment_sim_ms=now;
}
export function tickGrowth(state:EvolutionState,now:number):boolean {
  if(state.halted_sim_ms!==null)return false;
  const growth=state.growth;
  if(!growth || now!==growth.next_tick_sim_ms)return false;
  commitGrowthSegment(state,now);
  advanceNoise(growth);
  growth.next_tick_sim_ms+=GROWTH_STEP_MS;
  state.inputs.xi=sampleXi(growth,now);
  sampleStability(state,now,growth.confirmed_stars);
  resetSlope(state.inputs,growth);
  return true;
}
function syncGrowthCapacity(state:EvolutionState,now:number,confirmedStars:number,fixedDelta=0):boolean {
  const growth=state.growth;
  const riskChanged=state.stability && state.stability.source_signature!==stabilitySignature(state,confirmedStars);
  if(!growth || growth.worlds===state.n_worlds&&growth.confirmed_stars===confirmedStars&&!riskChanged)return false;
  // Commit with the OLD slope before a local completion or received report changes capacity.
  commitGrowthSegment(state,now);
  growth.worlds=state.n_worlds;growth.confirmed_stars=confirmedStars;
  growth.k_max=confirmedKCap(state.n_worlds,confirmedStars);
  state.inputs.k_value=Math.min(state.inputs.k_value,growth.k_max);
  sampleStability(state,now,confirmedStars,fixedDelta);
  resetSlope(state.inputs,growth);
  return true;
}
export function availablePoints(state:EvolutionState,now:number):number {
  return state.initial_points + earned(state,now) - state.spent_points;
}
function currentLevel(state:EvolutionState,dimension:EvolutionDimension):number {
  return dimension==='world_up' ? state.n_worlds : dimension==='k_tier_up' ? state.k_tier : state.tech_levels_5[dimension];
}
function maxLevel(dimension:EvolutionDimension):number { return dimension==='k_tier_up' ? 3 : 4; }
function cost(dimension:EvolutionDimension,level:number):number {
  return dimension==='world_up' || dimension==='k_tier_up' ? 0 : 2 ** (level-1);
}
function prerequisite(state:EvolutionState,dimension:EvolutionDimension,level:number,confirmedStars:number,now:number):boolean {
  if (dimension==='world_up') return true;
  if (dimension==='k_tier_up') return level===2
    ? confirmedStars>=2 && kAt(state.inputs,state.growth,now)>=1.10
    : confirmedStars>=4 && kAt(state.inputs,state.growth,now)>=1.50;
  return state.k_tier >= (level<=2 ? 1 : level===3 ? 2 : 3);
}
function durationMs(state:EvolutionState,dimension:EvolutionDimension,level:number):number {
  const years = dimension==='world_up' ? 30 : dimension==='k_tier_up' ? (level===2 ? 60 : 150) : TECH_YEARS[level-1]!;
  const speed = state.inputs.p_pop * (dimension==='world_up' || dimension==='k_tier_up' ? 1 : state.inputs.i_sci);
  return Math.ceil(years * YEAR_MS / speed);
}

/** Keep at most one plan-owned project outstanding. The cursor counts completed
 * goals, never enqueued work. Manual FIFO items retain priority and ownership. */
function replenishPlan(state:EvolutionState,now:number):boolean {
  const plan=state.allocation_plan;
  let changed=false;
  while(plan.cursor_index<plan.items.length) {
    const item=plan.items[plan.cursor_index]!;
    const level=currentLevel(state,item.dimension);
    if(state.plan_target_level===null) {
      if(!plan.enabled) return changed;
      const pending=state.build_queue.filter(entry=>entry.dimension===item.dimension).length
        +(state.active_construction?.dimension===item.dimension ? 1 : 0);
      state.plan_target_level=item.target_level ?? Math.min(maxLevel(item.dimension),level+pending+1);
    }
    if(level>=state.plan_target_level) {
      state.build_queue=state.build_queue.filter(entry=>entry.plan_index!==plan.cursor_index);
      plan.cursor_index++;
      state.plan_target_level=null;
      changed=true;
      continue;
    }
    if(!plan.enabled || kAt(state.inputs,state.growth,now)<(item.min_k ?? 0) || state.build_queue.length>=5) return changed;
    if(state.active_construction?.plan_index===plan.cursor_index || state.build_queue.some(entry=>entry.plan_index===plan.cursor_index)) return changed;
    const pending=state.build_queue.filter(entry=>entry.dimension===item.dimension).length
      +(state.active_construction?.dimension===item.dimension ? 1 : 0);
    if(level+pending>=state.plan_target_level) return changed;
    state.build_queue.push({dimension:item.dimension,queued_at_sim_s:now/1000,status:'queued',plan_index:plan.cursor_index});
    return true;
  }
  return changed;
}

export function configureAllocationPlan(state:EvolutionState,config:AllocationPlanConfig,now:number,confirmedStars:number):void {
  const prior=state.allocation_plan;
  const same=JSON.stringify(prior.items)===JSON.stringify(config.items) && prior.template_id===config.template_id;
  // Pausing cancels only plan-owned waiting work; paid construction continues.
  if(!same || !config.enabled) state.build_queue=state.build_queue.filter(item=>item.plan_index===undefined);
  if(!same) {
    if(state.active_construction) delete state.active_construction.plan_index;
    state.plan_target_level=null;
  }
  state.allocation_plan={...structuredClone(config),cursor_index:same ? prior.cursor_index : 0};
  settleEvolution(state,now,confirmedStars);
}

/** Complete once, then reconsider the FIFO head using only coordinator knowledge. */
export function settleEvolution(state:EvolutionState,now:number,confirmedStars:number):boolean {
  if(state.halted_sim_ms!==null)return false;
  let changed = false;
  const statuses=state.build_queue.map(item=>item.status);
  const active = state.active_construction;
  if (active && active.finishes_sim_ms<=now) {
    if (active.dimension==='world_up') state.n_worlds=active.target_level;
    else if (active.dimension==='k_tier_up') state.k_tier=active.target_level;
    else state.tech_levels_5[active.dimension]=active.target_level;
    state.active_construction=null;
    changed=true;
  }
  changed=syncGrowthCapacity(state,now,confirmedStars,active?.finishes_sim_ms===now&&active.dimension==='persist'&&active.target_level===3 ? -0.30 : 0)||changed;
  changed=replenishPlan(state,now)||changed;
  // A queued item's target is the next level at execution, so removing an earlier
  // item cannot strand a later duplicate with a skipped level.
  for (const item of state.build_queue) {
    item.status='queued';
  }
  const head=state.build_queue[0];
  if (state.active_construction || !head) return changed || state.build_queue.some((item,i)=>item.status!==statuses[i]);
  const level=currentLevel(state,head.dimension)+1;
  const price=cost(head.dimension,level);
  const minK=head.plan_index===undefined ? 0 : state.allocation_plan.items[head.plan_index]?.min_k??0;
  if (kAt(state.inputs,state.growth,now)<minK || !prerequisite(state,head.dimension,level,confirmedStars,now)) {
    head.status='waiting_prerequisite';
  } else if (availablePoints(state,now)<price) {
    head.status='waiting_points';
  } else {
    const finish=now+durationMs(state,head.dimension,level);
    if (!Number.isSafeInteger(finish)) throw new SimError('TIME_OUT_OF_RANGE',422);
    state.spent_points+=price;
    state.build_queue.shift();
    state.active_construction={dimension:head.dimension,target_level:level,started_sim_ms:now,finishes_sim_ms:finish,...(head.plan_index===undefined ? {} : {plan_index:head.plan_index})};
    replenishPlan(state,now);
    return true;
  }
  return changed || state.build_queue.some((item,i)=>item.status!==statuses[i]);
}

/** Next exact point threshold or completion, independently of caller step size. */
export function nextEvolutionTime(state:EvolutionState,now:number,confirmedStars:number):number {
  if(state.halted_sim_ms!==null)return Infinity;
  let next=state.growth?.next_tick_sim_ms??Infinity;
  const plan=state.allocation_plan;
  if(plan.enabled && !state.build_queue.some(item=>item.plan_index!==undefined) && state.active_construction?.plan_index===undefined){
    const item=plan.items[plan.cursor_index];
    if(item?.min_k!==undefined)next=Math.min(next,kThresholdTime(state,now,item.min_k));
  }
  if (state.active_construction) return Math.min(next,state.active_construction.finishes_sim_ms);
  const head=state.build_queue[0];
  if (!head) return next;
  const level=currentLevel(state,head.dimension)+1;
  const minK=head.plan_index===undefined ? 0 : plan.items[head.plan_index]?.min_k??0;
  if(kAt(state.inputs,state.growth,now)<minK)return Math.min(next,kThresholdTime(state,now,minK));
  if (!prerequisite(state,head.dimension,level,confirmedStars,now)) {
    if(head.dimension==='k_tier_up' && confirmedStars>=(level===2?2:4))next=Math.min(next,kThresholdTime(state,now,level===2?1.10:1.50));
    return next;
  }
  const price=cost(head.dimension,level);
  if (availablePoints(state,now)>=price) return now;
  const rate=evolutionRate(state);
  if (rate===0) return next;
  if(state.growth){
    // Binary search integer simulation milliseconds; never spend on a rounded-up balance.
    if(availablePoints(state,state.growth.next_tick_sim_ms)<price)return next;
    let lo=now+1,hi=state.growth.next_tick_sim_ms;
    while(lo<hi){const mid=lo+Math.floor((hi-lo)/2);if(availablePoints(state,mid)>=price)hi=mid;else lo=mid+1;}
    return Math.min(next,lo);
  }
  let due=state.anchor_sim_ms+Math.ceil((state.spent_points+price-state.initial_points)/rate*YEAR_MS);
  // The inverse and forward floating-point expressions can differ by one ULP.
  // Never spend before the forward integral has actually crossed the threshold.
  if (availablePoints(state,due)<price) due++;
  return Number.isSafeInteger(due) ? Math.max(now+1,due) : Infinity;
}
function kThresholdTime(state:EvolutionState,now:number,threshold:number):number {
  const growth=state.growth;
  if(!growth || kAt(state.inputs,growth,now)>=threshold || kAt(state.inputs,growth,growth.next_tick_sim_ms)<threshold)return Infinity;
  let lo=now+1,hi=growth.next_tick_sim_ms;
  while(lo<hi){const mid=lo+Math.floor((hi-lo)/2);if(kAt(state.inputs,growth,mid)>=threshold)hi=mid;else lo=mid+1;}
  return lo;
}

export function allocateEvolution(state:EvolutionState,action:Extract<SeatCommandEnvelope['action'],{type:'allocate_evolution_point'}>,now:number,confirmedStars:number):void {
  if (action.queue_op==='remove_at') {
    const index=action.queue_index!;
    const item=state.build_queue[index];
    if (!item || item.dimension!==action.dimension) throw new SimError('INVALID_QUEUE_ITEM',422);
    if(item.plan_index!==undefined) state.allocation_plan.enabled=false;
    state.build_queue.splice(index,1);
  } else {
    if (state.build_queue.length>=5) throw new SimError('BUILD_QUEUE_FULL',409);
    const pending=state.build_queue.filter(item=>item.dimension===action.dimension).length
      + (state.active_construction?.dimension===action.dimension ? 1 : 0);
    if (currentLevel(state,action.dimension)+pending>=maxLevel(action.dimension)) throw new SimError('MAX_LEVEL_REACHED',422);
    state.build_queue.push({dimension:action.dimension,queued_at_sim_s:now/1000,status:'queued'});
  }
  settleEvolution(state,now,confirmedStars);
}

export function projectEvolution(state:EvolutionState,now:number,confirmedStars=1) {
  now=state.halted_sim_ms??now;
  const active=state.active_construction;
  const remaining=active ? Math.max(0,active.finishes_sim_ms-now)/1000 : 0;
  const rate=evolutionRate(state,now);
  const k=kAt(state.inputs,state.growth,now);
  return {
    ...projectStability(state,confirmedStars),
    k_value:k,k_max_confirmed:state.growth?.k_max??Math.max(k,confirmedKCap(state.n_worlds,confirmedStars)),
    n_eff_stars:confirmedStars,stage:confirmedStars>1?'multi_star' as const:state.n_worlds>1?'multi_planet' as const:'single_planet' as const,
    k_tier:state.k_tier,n_worlds:state.n_worlds,tech_levels_5:state.tech_levels_5,
    active_construction:active ? {dimension:active.dimension,target_level:active.target_level,rem_sim_s:remaining,rem_real_s:remaining/KAPPA_T} : null,
    build_queue:state.build_queue.map(({plan_index:_,...item})=>item),allocation_plan:state.allocation_plan,
    evo_points_avail:availablePoints(state,now),evo_points_earned_total:earned(state,now),
    v_e_rate_per_real_h:rate*3600*KAPPA_T/SIM_SECONDS_PER_YEAR,v_e_rate_per_sim_yr:rate,
    pi_productivity:productivity(state,now),
  };
}

export function validateEvolution(state:EvolutionState,now:number):void {
  if(state.halted_sim_ms!==null){
    if(state.halted_sim_ms>now || !state.growth || state.growth.segment_sim_ms!==state.halted_sim_ms || state.active_construction || state.build_queue.length || state.allocation_plan.enabled)throw new SimError('INVALID_HALTED_SNAPSHOT',422);
    now=state.halted_sim_ms;
  }
  const growth=state.growth;
  if(growth && (growth.origin_sim_ms!==state.anchor_sim_ms || growth.segment_sim_ms<growth.origin_sim_ms || growth.segment_sim_ms>now || growth.next_tick_sim_ms<=now
    || (growth.next_tick_sim_ms-growth.origin_sim_ms)%GROWTH_STEP_MS!==0 || growth.next_tick_sim_ms-growth.segment_sim_ms>GROWTH_STEP_MS
    || growth.k_max!==confirmedKCap(growth.worlds,growth.confirmed_stars) || growth.worlds!==state.n_worlds || state.inputs.k_value>growth.k_max
    || state.inputs.xi!==sampleXi(growth,growth.next_tick_sim_ms-GROWTH_STEP_MS)))throw new SimError('INVALID_GROWTH_SNAPSHOT',422);
  if(growth){
    const expected={...growth};resetSlope(state.inputs,expected);
    if(growth.k_slope_per_yr!==expected.k_slope_per_yr || !Number.isFinite(earned(state,now)))throw new SimError('INVALID_GROWTH_SNAPSHOT',422);
  }
  const risk=state.stability;
  if(risk){
    const stars=growth?.confirmed_stars??1,network=stabilityNetwork(state,stars);
    if(!growth || risk.sampled_sim_ms!==growth.segment_sim_ms || risk.sampled_k!==state.inputs.k_value
      || risk.source_signature!==stabilitySignature(state,stars) || risk.lag_target!==(network.active_sync_span_ly/network.r_sync_ly)**2
      || state.inputs.sdi_fraction!==projectStability(state,stars).sdi_total/100)throw new SimError('INVALID_STABILITY_SNAPSHOT',422);
  }
  const active=state.active_construction;
  const plan=state.allocation_plan;
  const owned=[...state.build_queue,...(active ? [active] : [])].filter(item=>item.plan_index!==undefined);
  const planItem=plan.items[plan.cursor_index];
  if(owned.length>1 || owned.some(item=>item.plan_index!==plan.cursor_index || item.dimension!==planItem?.dimension)
    || (owned.length>0 && state.plan_target_level===null)
    || (state.plan_target_level!==null && (!planItem || state.plan_target_level>maxLevel(planItem.dimension)))) throw new SimError('INVALID_ALLOCATION_PLAN_SNAPSHOT',422);
  if (state.anchor_sim_ms>now || availablePoints(state,now)<0 || state.build_queue.some(item=>item.queued_at_sim_s*1000>now)) throw new SimError('INVALID_EVOLUTION_SNAPSHOT',422);
  if (active && (active.started_sim_ms<state.anchor_sim_ms || active.started_sim_ms>now || active.finishes_sim_ms<=now
    || active.target_level!==currentLevel(state,active.dimension)+1
    || active.finishes_sim_ms!==active.started_sim_ms+durationMs(state,active.dimension,active.target_level))) throw new SimError('INVALID_EVOLUTION_SNAPSHOT',422);
  for (const dimension of evolutionDimensionSchema.options) {
    const pending=state.build_queue.filter(item=>item.dimension===dimension).length+(active?.dimension===dimension ? 1 : 0);
    if (currentLevel(state,dimension)+pending>maxLevel(dimension)) throw new SimError('INVALID_EVOLUTION_SNAPSHOT',422);
  }
}

/** Apply a local crisis or a shield only after committing already earned points. */
export function shockEvolution(state:EvolutionState,now:number,kLoss=0,sdiTarget?:number):number {
  if(!state.growth || !state.stability || state.halted_sim_ms!==null)return 0;
  commitGrowthSegment(state,now);
  const prior=state.inputs.k_value;
  state.inputs.k_value=Math.max(0.56,prior-kLoss);
  sampleStability(state,now,state.growth.confirmed_stars);
  if(sdiTarget!==undefined){
    const raw=projectStability(state,state.growth.confirmed_stars).sdi_raw/100;
    sampleStability(state,now,state.growth.confirmed_stars,sdiTarget-raw);
  }
  resetSlope(state.inputs,state.growth);
  return prior-state.inputs.k_value;
}
export function haltEvolution(state:EvolutionState,now:number):void {
  shockEvolution(state,now);
  state.halted_sim_ms=now;
  state.active_construction=null;state.build_queue=[];
  state.allocation_plan.enabled=false;state.plan_target_level=null;
}
