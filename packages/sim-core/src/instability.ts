import { z } from 'zod';
import { instabilityEventSchema } from '@stars/contracts';
import { hashSeed,uniform,YEAR_MS } from './growth.js';

const finite=z.number().finite();
export const instabilityStateSchema=z.object({
  rng_state:finite.int().min(0).max(0xffffffff),
  anchor_sim_ms:finite.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  fatal_remaining:finite.nonnegative(),crisis_remaining:finite.nonnegative(),
  fatal_rate:finite.nonnegative(),crisis_rate:finite.nonnegative(),
  collapse_armed:z.boolean(),shield_used:z.boolean(),crisis_count:finite.int().nonnegative(),
  last_event:instabilityEventSchema.nullable(),
}).strict();
export type InstabilityState=z.infer<typeof instabilityStateSchema>;
export type InstabilityKind='fatal'|'crisis';

/** Per-sim-year rates from GDD §6.1; independent competing Poisson clocks. */
export function instabilityRates(sdi:number) {
  const fatal=sdi<=0.38 ? 0.0015*(sdi/0.38)**3 : 0.0015+0.45*((sdi-0.38)/0.62)**2;
  return {fatal,crisis:sdi>0.50 ? 2.5*fatal : 0};
}
export function createInstability(seed:string,now:number,sdi:number):InstabilityState {
  const rng={rng_state:hashSeed(`${seed}:instability:v1`)};
  const fatal_remaining=-Math.log(uniform(rng)),crisis_remaining=-Math.log(uniform(rng));
  const rates=instabilityRates(sdi);
  return {...rng,anchor_sim_ms:now,fatal_remaining,crisis_remaining,fatal_rate:rates.fatal,crisis_rate:rates.crisis,collapse_armed:true,shield_used:false,crisis_count:0,last_event:null};
}
function timeFor(state:InstabilityState,kind:InstabilityKind):number {
  const rate=state[`${kind}_rate`];
  if(rate===0)return Infinity;
  // Quantize the first threshold crossing upward to a simulation millisecond.
  const time=state.anchor_sim_ms+Math.ceil(state[`${kind}_remaining`]/rate*YEAR_MS);
  return Number.isSafeInteger(time) ? time : Infinity;
}
export function nextInstability(state:InstabilityState|null):{time:number;kind:InstabilityKind} {
  if(!state)return {time:Infinity,kind:'fatal'};
  const fatal=timeFor(state,'fatal'),crisis=timeFor(state,'crisis');
  return fatal<=crisis ? {time:fatal,kind:'fatal'} : {time:crisis,kind:'crisis'};
}
function commitExposure(state:InstabilityState,now:number):void {
  const years=(now-state.anchor_sim_ms)/YEAR_MS;
  state.fatal_remaining=Math.max(0,state.fatal_remaining-state.fatal_rate*years);
  state.crisis_remaining=Math.max(0,state.crisis_remaining-state.crisis_rate*years);
  state.anchor_sim_ms=now;
}
/** No mutation on reads or unchanged rates, including hidden frontier events. */
export function syncInstability(state:InstabilityState,now:number,sdi:number):void {
  const rates=instabilityRates(sdi);
  if(rates.fatal===state.fatal_rate&&rates.crisis===state.crisis_rate)return;
  commitExposure(state,now);
  state.fatal_rate=rates.fatal;state.crisis_rate=rates.crisis;
}
export function consumeCrisis(state:InstabilityState,now:number):void {
  commitExposure(state,now);
  state.crisis_remaining=-Math.log(uniform(state));
}
