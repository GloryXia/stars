export type QualityTier='basic'|'standard'|'enhanced';
export type QualityPreference='auto'|QualityTier;
export interface PresentationCapabilities {graphics:boolean; reducedMotion:boolean; saveData:boolean}
export interface PresentationProfile {
  tier:QualityTier;
  maxPixelRatio:number;
  maxFps:number;
  antialias:boolean;
  sphereSegments:number;
  glowLayers:number;
  trailParticles:number;
  animateEffects:boolean;
}
/** Every supported tier is 3D. Quality changes presentation, never knowledge or rules. */
export function presentationProfile(preference:QualityPreference,capabilities:PresentationCapabilities):PresentationProfile{
  if(!capabilities.graphics)throw new Error('GRAPHICS_UNAVAILABLE');
  const tier=preference==='auto'?(capabilities.saveData?'basic':'standard'):preference;
  const budgets={
    basic:{maxPixelRatio:0.75,maxFps:30,antialias:false,sphereSegments:8,glowLayers:0,trailParticles:0},
    standard:{maxPixelRatio:1,maxFps:30,antialias:false,sphereSegments:12,glowLayers:1,trailParticles:8},
    enhanced:{maxPixelRatio:2,maxFps:60,antialias:true,sphereSegments:24,glowLayers:2,trailParticles:24},
  };
  return {tier,...budgets[tier],animateEffects:!capabilities.reducedMotion};
}
/** Hosts supply measured visible-frame and render-call durations, not platform names.
 * Upgrades need sustained headroom; the host stops upgrading after a downgrade.
 */
export function nextQuality(tier:QualityTier,frameMs:number,renderMs:number,allowUpgrade:boolean):QualityTier{
  if(!Number.isFinite(frameMs)||!Number.isFinite(renderMs)||frameMs<=0||renderMs<0)return tier;
  if(tier==='enhanced'&&(frameMs>28||renderMs>18))return 'standard';
  if(tier==='standard'&&(frameMs>50||renderMs>25))return 'basic';
  if(allowUpgrade&&tier==='standard'&&frameMs<18&&renderMs<8)return 'enhanced';
  return tier;
}
