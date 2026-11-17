import { z } from 'zod';
import { SIM_SECONDS_PER_YEAR } from '@stars/contracts';

export const YEAR_MS=SIM_SECONDS_PER_YEAR*1000;
export const GROWTH_STEP_YEARS=5;
export const GROWTH_STEP_MS=GROWTH_STEP_YEARS*YEAR_MS;
const time=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const finite=z.number().finite();
export const growthStateSchema=z.object({
  seed:z.string().min(1).max(256),rng_state:z.number().int().min(0).max(0xffffffff),
  phases:z.tuple([finite,finite,finite]),ou:finite,jump:finite,stochastic:z.boolean(),
  l0:finite.min(0.88).max(1.12),d_self:finite.min(0.85).max(1.15),
  origin_sim_ms:time,segment_sim_ms:time,next_tick_sim_ms:time,
  earned_at_segment:finite.nonnegative(),k_slope_per_yr:finite.nonnegative(),
  k_max:finite.min(0.56).max(2),confirmed_stars:z.number().int().min(1),worlds:z.number().int().min(1).max(4),
}).strict();
export type GrowthState=z.infer<typeof growthStateSchema>;
export interface GrowthOptions {seed:string;stochastic?:boolean;l0?:number;d_self?:number}
export interface GrowthInputs {k_value:number;xi:number;sdi_fraction:number;p_pop:number;i_sci:number}

/** FNV-1a seed hashing and Mulberry32: no ambient RNG or system clock. */
export function hashSeed(seed:string):number {
  let hash=2166136261;
  for(let i=0;i<seed.length;i++)hash=Math.imul(hash^seed.charCodeAt(i),16777619)>>>0;
  return hash;
}
export function uniform(state:{rng_state:number}):number {
  state.rng_state=(state.rng_state+0x6d2b79f5)>>>0;
  let value=state.rng_state;
  value=Math.imul(value^(value>>>15),value|1);
  value^=value+Math.imul(value^(value>>>7),value|61);
  return (((value^(value>>>14))>>>0)+0.5)/4294967296;
}
export function confirmedKCap(worlds:number,stars:number):number {
  return stars<=1 ? Math.min(1.05,0.86+0.14*Math.log(worlds)) : Math.min(2,1.05+0.38*Math.log(stars));
}
export function createGrowth(now:number,options:GrowthOptions,worlds:number):GrowthState {
  const rng={rng_state:hashSeed(options.seed)};
  const phases=[uniform(rng)*2*Math.PI,uniform(rng)*2*Math.PI,uniform(rng)*2*Math.PI];
  return growthStateSchema.parse({
    ...options,rng_state:rng.rng_state,phases,ou:0,jump:0,stochastic:options.stochastic??true,
    l0:options.l0??1,d_self:options.d_self??1,origin_sim_ms:now,segment_sim_ms:now,
    next_tick_sim_ms:now+GROWTH_STEP_MS,earned_at_segment:0,k_slope_per_yr:0,
    k_max:confirmedKCap(worlds,1),confirmed_stars:1,worlds,
  });
}
export function sampleXi(growth:GrowthState,now:number):number {
  if(!growth.stochastic)return 0;
  const years=(now-growth.origin_sim_ms)/YEAR_MS;
  const periods=[780,290,115],amplitudes=[0.10,0.07,0.04];
  const harmonics=growth.phases.reduce((sum,phase,i)=>sum+amplitudes[i]!*Math.sin(2*Math.PI*years/(periods[i]!*growth.l0)+phase),0);
  return Math.max(-0.65,Math.min(0.65,harmonics+growth.ou+growth.jump));
}
export function advanceNoise(growth:GrowthState):void {
  if(!growth.stochastic)return;
  const normal=Math.sqrt(-2*Math.log(uniform(growth)))*Math.cos(2*Math.PI*uniform(growth));
  growth.ou=growth.ou*Math.exp(-GROWTH_STEP_YEARS/250)+0.10*Math.sqrt(1-Math.exp(-2*GROWTH_STEP_YEARS/250))*normal;
  growth.jump*=Math.exp(-GROWTH_STEP_YEARS/120);
  const jump=uniform(growth)<0.008*GROWTH_STEP_YEARS;
  const negative=uniform(growth)<0.45;
  if(jump)growth.jump+=negative ? -0.18 : 0.22;
}
/** GDD §5.2 derivative in sim years; the caller freezes it for one grid segment. */
export function kDerivative(inputs:GrowthInputs,growth:GrowthState):number {
  const k=inputs.k_value;
  const ramp=0.18+0.82*Math.max(0,Math.min(1,(k-0.56)/(0.73-0.56)));
  return 0.00182*ramp*Math.exp(1.35*(k-0.56)*0.35)*Math.exp(0.30*inputs.xi)
    *(1+0.18*Math.log(growth.worlds)+0.35*Math.log(growth.confirmed_stars))*inputs.i_sci*growth.d_self**0.35
    *Math.max(0,1-(k/growth.k_max)**4)*(1-inputs.sdi_fraction);
}
export function resetSlope(inputs:GrowthInputs,growth:GrowthState):void {
  const remainingYears=(growth.next_tick_sim_ms-growth.segment_sim_ms)/YEAR_MS;
  growth.k_slope_per_yr=Math.min(kDerivative(inputs,growth),Math.max(0,growth.k_max-inputs.k_value)/remainingYears);
}
export function kAt(inputs:GrowthInputs,growth:GrowthState|null,now:number):number {
  return growth ? Math.min(growth.k_max,inputs.k_value+growth.k_slope_per_yr*(now-growth.segment_sim_ms)/YEAR_MS) : inputs.k_value;
}
/** Exact integral of exp(alpha K) along this segment's linear K trajectory. */
export function segmentPoints(rateAtStart:number,slope:number,years:number):number {
  const exponent=1.35*slope;
  return rateAtStart*(exponent===0 ? years : Math.expm1(exponent*years)/exponent);
}
