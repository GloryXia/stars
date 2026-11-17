import { z } from 'zod';
import { YEAR_MS } from './growth.js';
import type { EvolutionState } from './evolution.js';

const finite=z.number().finite();
export const stabilityStateSchema=z.object({
  sampled_sim_ms:finite.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  sampled_k:finite.min(0.56).max(2),
  lag_u:finite.nonnegative(),lag_target:finite.nonnegative(),fixed:finite,
  s_org:finite.min(0.88).max(1.12),source_signature:z.string(),
}).strict();
export type StabilityState=z.infer<typeof stabilityStateSchema>;
const SYNC=[1,1.5,3.5,6,10];
const REDUNDANCY=[1,2.2,3.5,6,15];
const PERSIST=[0,0.15,0.28,0.45,0.65];
const STRIKE=[0,0.08,0.23,0.51,0.91];
const ENGINEERING=[0.5,1.3,3,5.8,15];
const INFORMATION=[0.5,1.2,2.8,5.2,13.8];

/** This frontier contains only the cradle A and the disclosed, 4 ly distant B.
 * Count includes only coordinator-confirmed, actively synchronized nodes. */
export function stabilityNetwork(state:EvolutionState,stars:number) {
  const cradle=[0.01,0.05,0.10,0.15][state.n_worlds-1]!;
  return {
    cradle_span_ly:cradle,active_sync_span_ly:stars>1?4:cradle,
    r_sync_ly:1.4*(state.stability?.s_org??1)*SYNC[state.tech_levels_5.persist]!,
    r_persist:REDUNDANCY[state.tech_levels_5.persist]!*(1+0.35*Math.log(state.n_worlds))*(1+0.65*Math.log(stars)),
  };
}
export function stabilitySignature(state:EvolutionState,stars:number):string {
  return JSON.stringify([state.n_worlds,state.k_tier,state.tech_levels_5,stars]);
}
export function createStability(now:number,sOrg:number):StabilityState {
  return stabilityStateSchema.parse({sampled_sim_ms:now,sampled_k:0.56,lag_u:0,lag_target:0,fixed:0,s_org:sOrg,source_signature:''});
}

/** All exposed contributions are percentage points, except dimensionless U.
 * Raw SDI stays signed/unclamped; only the production damping is clamped. */
export function projectStability(state:EvolutionState,stars:number) {
  const risk=state.stability;
  const breakdown={involution:0,concentration:0,colony:0,lag:0,lag_strain_u:0,tier_tech:0,pulse:0,fixed:0,heat_overload:0,overlap_arrived:0};
  if(!risk) {
    breakdown.fixed=state.inputs.sdi_fraction*100;
    return {sdi_mode:'fixed' as const,sdi_sampled_sim_s:null,sdi_total:breakdown.fixed,sdi_raw:breakdown.fixed,sdi_breakdown:breakdown};
  }
  const k=risk.sampled_k,w=state.n_worlds,tech=state.tech_levels_5;
  const multiplier=100*state.growth!.d_self;
  breakdown.involution=multiplier*0.16*state.inputs.p_pop*(1+1.1*Math.max(0,k-0.56))/(w**1.05*(1+0.28*Math.log(w))*(1+0.20*Math.log(stars)));
  breakdown.concentration=multiplier*(k<0.65||stars>=2?0:w>=2?0.05:0.12+0.50*Math.max(0,Math.min(1,(k-0.65)/0.21))**1.3);
  breakdown.colony=multiplier*0.05*Math.log(w);
  breakdown.lag_strain_u=risk.lag_u;
  breakdown.lag=multiplier*0.25*risk.lag_u;
  const rE=ENGINEERING[tech.obs]!/Math.exp(2.85*(k-0.73));
  const rS=INFORMATION[tech.obs]!/(REDUNDANCY[tech.persist]!*(1+0.25*Math.log(w))*(1+0.65*Math.log(stars)));
  const observation=0.11*Math.max(0,rE-1.4)**2+0.13*Math.max(0,rS-1.4)**2;
  breakdown.tier_tech=multiplier*([0,0.15,0.35][state.k_tier-1]!+STRIKE[tech.strike]!+observation+0.08*Math.log(stars)-PERSIST[tech.persist]!);
  breakdown.fixed=100*risk.fixed;
  const raw=breakdown.involution+breakdown.concentration+breakdown.colony+breakdown.lag+breakdown.tier_tech+breakdown.fixed;
  return {sdi_mode:'dynamic' as const,sdi_sampled_sim_s:risk.sampled_sim_ms/1000,sdi_total:Math.max(0,Math.min(100,raw)),sdi_raw:raw,sdi_breakdown:breakdown};
}

/** Called only on the fixed growth grid or a change in confirmed local inputs.
 * Advance memory with the OLD target before switching network/tech capacity. */
export function sampleStability(state:EvolutionState,now:number,stars:number,fixedDelta=0):void {
  const risk=state.stability;
  if(!risk)return;
  const years=(now-risk.sampled_sim_ms)/YEAR_MS;
  risk.lag_u=risk.lag_target+(risk.lag_u-risk.lag_target)*Math.exp(-years/15);
  risk.fixed=risk.fixed*Math.exp(-years/40)+fixedDelta;
  const network=stabilityNetwork(state,stars);
  risk.lag_target=(network.active_sync_span_ly/network.r_sync_ly)**2;
  risk.sampled_sim_ms=now;risk.sampled_k=state.inputs.k_value;
  risk.source_signature=stabilitySignature(state,stars);
  state.inputs.sdi_fraction=projectStability(state,stars).sdi_total/100;
}
