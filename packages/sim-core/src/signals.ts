import { SIM_SECONDS_PER_YEAR } from '@stars/contracts';
export type Messenger = 'em'|'neutrino'|'gw';
export interface EmissionSegment {
  messenger:Messenger;
  start_sim_s:number;
  end_sim_s:number;
  source_strength:number;
  extinction_per_ly:number;
  // Captured at emission: changing a source now never changes photons already in flight.
  em_stealth_at_emission:number;
}
const finiteNonnegative=(...values:number[])=>{
  if(values.some(v=>!Number.isFinite(v)||v<0))throw new RangeError('Expected finite nonnegative physical values');
};
/** A stationary-source segment; moving emitters must emit segments at their own positions. */
export function shellBounds(segment:EmissionSegment,now_sim_s:number){
  finiteNonnegative(segment.start_sim_s,segment.end_sim_s,now_sim_s);
  if(segment.end_sim_s<segment.start_sim_s)throw new RangeError('Emission interval reversed');
  return {outer_ly:Math.max(0,(now_sim_s-segment.start_sim_s)/SIM_SECONDS_PER_YEAR),inner_ly:Math.max(0,(now_sim_s-segment.end_sim_s)/SIM_SECONDS_PER_YEAR)};
}
export function receiveSignal(segment:EmissionSegment,options:{now_sim_s:number;distance_ly:number;observation_level:number;gain:number;noise:number;dissipation_threshold:number}){
  finiteNonnegative(segment.source_strength,segment.extinction_per_ly,segment.em_stealth_at_emission,options.distance_ly,options.gain,options.noise,options.dissipation_threshold);
  if(options.noise===0||options.dissipation_threshold===0)throw new RangeError('Noise and dissipation threshold must be positive');
  if(!Number.isInteger(options.observation_level)||options.observation_level<0||options.observation_level>4)throw new RangeError('Observation level must be 0..4');
  shellBounds(segment,options.now_sim_s);
  const sourceTime=options.now_sim_s-options.distance_ly*SIM_SECONDS_PER_YEAR;
  // Half-open intervals avoid counting a boundary twice when source power changes.
  const arrived=sourceTime>=segment.start_sim_s && sourceTime<segment.end_sim_s;
  const d=Math.max(0.01,options.distance_ly)/4.22;
  const attenuation=segment.messenger==='em'?Math.exp(-segment.extinction_per_ly*options.distance_ly)*segment.em_stealth_at_emission:1;
  const intensity=arrived?segment.source_strength*attenuation/(segment.messenger==='gw'?d:d*d):0;
  const margin=intensity/options.dissipation_threshold;
  const available=segment.messenger==='em'||options.observation_level>=3;
  return {arrived,intensity,dissipation_margin_ratio:margin,snr:available&&margin>=1?intensity*options.gain/options.noise:0};
}
export type Point3 = readonly [number,number,number];
/** Geometry gate only: callers must supply confirmed, synchronized nodes in the same frame. */
export function hasTriangulationBaseline(points:readonly Point3[]):boolean {
  if(points.some(p=>p.some(v=>!Number.isFinite(v))))throw new RangeError('Non-finite baseline');
  const a=points[0];if(!a)return false;
  for(let i=1;i<points.length-1;i++)for(let j=i+1;j<points.length;j++){
    const b=points[i]!,c=points[j]!;
    const u=b.map((v,k)=>v-a[k]!) as unknown as Point3,v=c.map((x,k)=>x-a[k]!) as unknown as Point3;
    const scale=Math.hypot(...u)*Math.hypot(...v);
    const cross=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
    if(scale>0&&cross/scale>1e-10)return true;
  }
  return false;
}
