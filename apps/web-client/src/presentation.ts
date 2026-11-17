import {nextQuality,presentationProfile,type QualityPreference,type QualityTier} from '@stars/client-core';
import type {PublicCatalog,SeatViewProjection} from '@stars/contracts';
import type {TranslationKey} from '@stars/i18n';
import type {Observatory,MapMode,CameraState} from './scene.js';
export type {MapMode} from './scene.js';

/** Owns the lifetime and budget of one 3D scene; no command or simulation authority. */
export class Presentation {
  private scene:Observatory|undefined;
  private revision=0;
  private catalog:PublicCatalog=[];
  private latest:{view:SeatViewProjection;selected:string|undefined;time:number}|undefined;
  private mode:MapMode='bubble';
  private camera:CameraState|undefined;
  private preference:QualityPreference='auto';
  private tier:QualityTier='standard';
  private upgradeAllowed=true;
  private recoveryAvailable=true;
  statusKey:TranslationKey='graphicsLoading';
  get graphics():boolean{return !!this.scene;}
  get qualityTier():QualityTier{return this.tier;}
  constructor(private host:HTMLElement,private onSelect:(id:string)=>void,private changed:()=>void){}
  private capabilities(){
    return {graphics:true,saveData:!!(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches};
  }
  async configure(preference:QualityPreference):Promise<void>{
    this.preference=preference;this.upgradeAllowed=true;this.recoveryAvailable=true;
    await this.configureTier(presentationProfile(preference,this.capabilities()).tier);
  }
  private async configureTier(tier:QualityTier):Promise<void>{
    const revision=++this.revision;
    this.clear();this.tier=tier;
    const profile=presentationProfile(tier,this.capabilities());
    this.statusKey='graphicsLoading';this.changed();
    try{
      // The 3D module is required for every tier, including the minimum budget.
      const {Observatory}=await import('./scene.js');
      if(revision!==this.revision)return;
      this.scene=new Observatory(this.host,this.onSelect,profile,()=>{
        // Leave the WebGL event/frame callback before disposing its renderer.
        queueMicrotask(()=>{
          if(revision!==this.revision)return;
          if(this.recoveryAvailable){this.recoveryAvailable=false;this.upgradeAllowed=false;void this.configureTier('basic');}
          else this.unavailable();
        });
      },(frameMs,renderMs)=>{
        const allowUpgrade=this.preference==='auto'&&this.upgradeAllowed&&!this.capabilities().saveData;
        const next=nextQuality(this.tier,frameMs,renderMs,allowUpgrade);
        if(next===this.tier)return;
        this.upgradeAllowed=false;
        queueMicrotask(()=>{if(revision===this.revision)void this.configureTier(next);});
      });
      this.scene.setMode(this.mode);this.scene.setCatalog(this.catalog);
      if(this.camera)this.scene.restoreCamera(this.camera);
      if(this.latest)this.scene.update(this.latest.view,this.latest.selected,this.latest.time);
      this.statusKey=tier==='basic'?'graphicsBasic':tier==='enhanced'?'graphicsEnhanced':'graphicsStandard';this.changed();
    }catch{
      if(revision!==this.revision)return;
      if(tier!=='basic'){this.upgradeAllowed=false;await this.configureTier('basic');}
      else this.unavailable();
    }
  }
  private clear():void{
    if(this.scene)this.camera=this.scene.captureCamera();
    this.scene?.dispose();this.scene=undefined;this.host.replaceChildren();
  }
  private unavailable():void{++this.revision;this.clear();this.statusKey='graphicsUnavailable';this.changed();}
  setCatalog(catalog:PublicCatalog):void{this.catalog=catalog;this.scene?.setCatalog(catalog);}
  setMode(mode:MapMode):void{this.mode=mode;this.scene?.setMode(mode);}
  zoom(multiplier:number):void{this.scene?.zoom(multiplier);}
  update(view:SeatViewProjection,selected:string|undefined,time:number):void{
    this.latest={view,selected,time};this.scene?.update(view,selected,time);
  }
}
