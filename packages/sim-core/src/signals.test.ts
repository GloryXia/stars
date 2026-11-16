import { expect,it } from 'vitest';
import { SIM_SECONDS_PER_YEAR as YEAR } from '@stars/contracts';
import { receiveSignal,shellBounds,hasTriangulationBaseline,type EmissionSegment } from './signals.js';
const em:EmissionSegment={messenger:'em',start_sim_s:0,end_sim_s:30*YEAR,source_strength:0.001,extinction_per_ly:0.0002,em_stealth_at_emission:1};
const opts={now_sim_s:410*YEAR,distance_ly:400,observation_level:4,gain:1e12,noise:4e-5,dissipation_threshold:4e-7};
it('a dissipated T1 EM shell cannot be recovered by arbitrarily large gain',()=>{expect(receiveSignal(em,opts).snr).toBe(0);});
it('stopping emission leaves a hollow shell, with no early arrival',()=>{
  expect(shellBounds(em,50*YEAR)).toEqual({inner_ly:20,outer_ly:50});
  expect(receiveSignal(em,{...opts,distance_ly:50,now_sim_s:49*YEAR}).arrived).toBe(false);
  expect(receiveSignal(em,{...opts,distance_ly:50,now_sim_s:50*YEAR}).snr).toBeGreaterThan(0);
  expect(receiveSignal(em,{...opts,distance_ly:50,now_sim_s:80*YEAR}).arrived).toBe(false);
});
it('neutrinos ignore EM stealth and extinction but require observation level 3',()=>{
  const segment={...em,messenger:'neutrino' as const,source_strength:0.008,extinction_per_ly:500,em_stealth_at_emission:0.0001};
  const o={...opts,now_sim_s:60*YEAR,distance_ly:50,gain:4,dissipation_threshold:4e-5/6};
  expect(receiveSignal(segment,o)).toEqual(receiveSignal({...segment,extinction_per_ly:0,em_stealth_at_emission:1},o));
  expect(receiveSignal(segment,{...o,observation_level:2}).snr).toBe(0);
  expect(receiveSignal(segment,o).snr).toBeGreaterThan(1);
});
it('GW measures 1/r strain and triangulation rejects collinear or duplicate stations',()=>{
  const segment={...em,messenger:'gw' as const,source_strength:0.08};
  const a=receiveSignal(segment,{...opts,distance_ly:3000,now_sim_s:3001*YEAR,dissipation_threshold:4e-5/3.5,gain:1});
  const b=receiveSignal(segment,{...opts,distance_ly:6000,now_sim_s:6001*YEAR,dissipation_threshold:4e-5/3.5,gain:1});
  expect(a.intensity/b.intensity).toBeCloseTo(2);expect(a.snr).toBeCloseTo(2.8133,3);
  expect(hasTriangulationBaseline([[0,0,0],[4,0,0],[8,0,0]])).toBe(false);
  expect(hasTriangulationBaseline([[0,0,0],[4,0,0],[0,8,0]])).toBe(true);
});
