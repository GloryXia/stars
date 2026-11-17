import * as THREE from 'three';
import type {PresentationProfile} from '@stars/client-core';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {color} from '@stars/ui-tokens';
import type {PublicCatalog,SeatViewProjection} from '@stars/contracts';

export type MapMode='bubble'|'celestial';
export interface CameraState {position:number[];target:number[];skyTheta:number;skyPhi:number;skyFov:number;gridStep:number}

export class Observatory {
  private renderer:THREE.WebGLRenderer;
  private scene=new THREE.Scene();
  private camera=new THREE.PerspectiveCamera(50,1,0.001,1000);
  private controls:OrbitControls;
  private stars=new THREE.Group();
  private route=new THREE.Group();
  private grid=new THREE.Group();
  private catalog:PublicCatalog=[];
  private origin=new THREE.Vector3();
  private mode:MapMode='bubble';
  private view:SeatViewProjection|undefined;
  private selected:string|undefined;
  private raycaster=new THREE.Raycaster();
  private pointer=new THREE.Vector2();
  private press:{x:number,y:number}|undefined;
  private activePointers=new Set<number>();
  private dragged=false;
  private bubblePosition=new THREE.Vector3(7,5,9);
  private bubbleTarget=new THREE.Vector3(2,0,0);
  private skyTheta=-12;
  private skyPhi=20;
  private skyFov=80;
  private skyPointers=new Map<number,{x:number,y:number}>();
  private skyReadout=document.createElement('div');
  private gridStep=15;
  private resize:ResizeObserver;
  private cleanup:()=>void;
  private disposed=false;
  private glowTexture:THREE.DataTexture|undefined;
  private createGlowTexture():THREE.DataTexture{
    const size=32,data=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const radius=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),offset=(y*size+x)*4;
      data[offset]=data[offset+1]=data[offset+2]=255;
      data[offset+3]=Math.round(Math.pow(Math.max(0,1-radius),2)*255);
    }
    const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;return texture;
  }
  constructor(private host:HTMLElement,private onSelect:(id:string)=>void,private profile:PresentationProfile,onUnavailable:()=>void,onBudget:(frameMs:number,renderMs:number)=>void){
    this.renderer=new THREE.WebGLRenderer({antialias:profile.antialias,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,profile.maxPixelRatio));
    this.renderer.setClearColor(color.void0);
    if(profile.glowLayers)this.glowTexture=this.createGlowTexture();
    this.renderer.domElement.dataset.quality=profile.tier;
    this.renderer.domElement.setAttribute('aria-hidden','true');
    host.append(this.renderer.domElement);
    this.camera.up.set(0,0,1);
    this.camera.position.copy(this.bubblePosition);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.target.copy(this.bubbleTarget);
    this.controls.enableDamping=false;
    this.controls.enablePan=false;
    this.controls.minDistance=2;this.controls.maxDistance=40;
    this.scene.add(this.stars,this.route,this.grid);
    this.skyReadout.className='sky-readout';this.skyReadout.hidden=true;host.append(this.skyReadout);
    this.renderer.domElement.addEventListener('wheel',e=>{if(this.mode==='celestial'){e.preventDefault();this.zoom(Math.exp(Math.max(-200,Math.min(200,e.deltaY))*.002));}},{passive:false});
    this.renderer.domElement.addEventListener('pointerdown',e=>{
      this.activePointers.add(e.pointerId);
      if(this.mode==='celestial'){this.skyPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});this.renderer.domElement.setPointerCapture(e.pointerId);}
      if(this.activePointers.size===1){this.press={x:e.clientX,y:e.clientY};this.dragged=false;}else this.dragged=true;
    });
    this.renderer.domElement.addEventListener('pointermove',e=>{
      if(this.press&&Math.hypot(e.clientX-this.press.x,e.clientY-this.press.y)>6)this.dragged=true;
      const previous=this.skyPointers.get(e.pointerId);
      if(this.mode!=='celestial'||!previous)return;
      const other=[...this.skyPointers.entries()].find(([id])=>id!==e.pointerId)?.[1];
      if(other){const before=Math.hypot(previous.x-other.x,previous.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(before>0&&after>0)this.zoom(before/after);}
      else {
        const scale=this.skyFov/Math.max(1,host.clientHeight);
        // With local +Z up, increasing longitude turns the camera left,
        // so the sky follows a rightward drag. Latitude already follows screen Y.
        this.skyTheta+=(e.clientX-previous.x)*scale;
        this.skyPhi+=(e.clientY-previous.y)*scale;
        this.updateSkyCamera();
      }
      this.skyPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    });
    this.renderer.domElement.addEventListener('pointerup',e=>{
      this.activePointers.delete(e.pointerId);this.skyPointers.delete(e.pointerId);
      if(!this.dragged&&this.press){const rect=host.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects(this.stars.children).find(h=>typeof h.object.userData.catalogId==='string');if(hit)this.onSelect(hit.object.userData.catalogId as string);}
      if(!this.activePointers.size)this.press=undefined;
    });
    const cancel=()=>{this.activePointers.clear();this.skyPointers.clear();this.press=undefined;this.dragged=true;};
    this.renderer.domElement.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',cancel);
    this.resize=new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();});this.resize.observe(host);
    const lost=(event:Event)=>{event.preventDefault();if(!this.disposed)onUnavailable();};
    this.renderer.domElement.addEventListener('webglcontextlost',lost);
    this.cleanup=()=>{window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',cancel);this.renderer.domElement.removeEventListener('webglcontextlost',lost);};
    let drawn=0,previous=0,elapsed=0,samples=0,renderTime=0,draws=0,warmup=120;
    this.renderer.setAnimationLoop(time=>{
      if(document.hidden){previous=0;elapsed=0;samples=0;renderTime=0;draws=0;return;}
      if(previous&&warmup===0){elapsed+=time-previous;samples++;}previous=time;
      if(warmup>0)warmup--;
      if(samples>=240){
        onBudget(elapsed/samples,draws?renderTime/draws:0);
        elapsed=0;samples=0;renderTime=0;draws=0;
      }
      if(time-drawn<1000/profile.maxFps)return;drawn=time;
      const begin=performance.now();
      if(this.mode==='bubble')this.controls.update();
      if(profile.tier==='enhanced'&&profile.animateEffects){
        for(const object of this.stars.children)if(object instanceof THREE.Sprite)
          object.material.opacity=object.userData.baseOpacity*(.92+.08*Math.sin(time*.001+object.position.length()));
      }
      this.renderer.render(this.scene,this.camera);
      if(warmup===0){renderTime+=performance.now()-begin;draws++;}
    });
  }
  captureCamera():CameraState{
    return {position:(this.mode==='bubble'?this.camera.position:this.bubblePosition).toArray(),
      target:(this.mode==='bubble'?this.controls.target:this.bubbleTarget).toArray(),
      skyTheta:this.skyTheta,skyPhi:this.skyPhi,skyFov:this.skyFov,gridStep:this.gridStep};
  }
  restoreCamera(state:CameraState):void{
    this.bubblePosition.fromArray(state.position);this.bubbleTarget.fromArray(state.target);
    this.skyTheta=state.skyTheta;this.skyPhi=state.skyPhi;this.skyFov=state.skyFov;this.gridStep=state.gridStep;
    if(this.mode==='bubble'){this.camera.position.copy(this.bubblePosition);this.controls.target.copy(this.bubbleTarget);this.controls.update();}
    else this.updateSkyCamera();
    this.rebuild();
  }

  dispose():void{
    if(this.disposed)return;this.disposed=true;
    this.renderer.setAnimationLoop(null);this.resize.disconnect();this.cleanup();this.controls.dispose();
    this.clear(this.stars);this.clear(this.route);this.clear(this.grid);
    this.glowTexture?.dispose();
    if(!this.renderer.getContext().isContextLost())this.renderer.forceContextLoss();
    this.renderer.dispose();this.renderer.domElement.remove();this.skyReadout.remove();
  }
  setCatalog(catalog:PublicCatalog):void{this.catalog=catalog;const anchor=catalog[0];this.origin.fromArray(anchor?.local_pos_vec3??[0,0,0]);this.rebuild();}
  setMode(mode:MapMode):void{
    if(mode===this.mode)return;
    if(this.mode==='bubble'){this.bubblePosition.copy(this.camera.position);this.bubbleTarget.copy(this.controls.target);}
    this.mode=mode;
    this.controls.enabled=mode==='bubble';
    this.skyReadout.hidden=mode!=='celestial';this.skyPointers.clear();
    if(mode==='bubble'){
      this.camera.fov=50;this.camera.position.copy(this.bubblePosition);this.controls.target.copy(this.bubbleTarget);this.controls.update();
    }else this.updateSkyCamera();
    this.camera.updateProjectionMatrix();this.rebuild();
  }
  private updateSkyCamera():void{
    this.skyTheta=((this.skyTheta%360)+360)%360;this.skyPhi=THREE.MathUtils.clamp(this.skyPhi,-89.5,89.5);
    const theta=THREE.MathUtils.degToRad(this.skyTheta),phi=THREE.MathUtils.degToRad(this.skyPhi);
    this.camera.position.set(0,0,0);this.camera.fov=this.skyFov;
    this.camera.lookAt(Math.cos(phi)*Math.cos(theta),Math.cos(phi)*Math.sin(theta),Math.sin(phi));
    this.camera.updateProjectionMatrix();
    this.skyReadout.textContent=`θ ${this.skyTheta.toFixed(1)}°  φ ${this.skyPhi>=0?'+':''}${this.skyPhi.toFixed(1)}° · FOV ${this.skyFov.toFixed(0)}°`;
  }
  zoom(multiplier:number):void{
    if(this.mode==='bubble'){this.camera.position.sub(this.controls.target).multiplyScalar(multiplier).add(this.controls.target);this.controls.update();}
    else{
      this.skyFov=THREE.MathUtils.clamp(this.skyFov*multiplier,15,110);this.updateSkyCamera();
      const step=this.skyFov>90?30:this.skyFov>35?15:this.skyFov>18?5:1;
      if(step!==this.gridStep){this.gridStep=step;this.rebuild();}
    }
  }
  update(view:SeatViewProjection,selected:string|undefined,currentSimTime:number):void{
    const changed=this.view?.view_version!==view.view_version||this.view?.seat_id!==view.seat_id||this.selected!==selected||this.view!==view;
    this.view=view;this.selected=selected;if(changed)this.rebuild();
    for(const child of this.route.children){const exp=child.userData.expedition as SeatViewProjection['self.network']['active_expeditions'][number]|undefined;if(!exp)continue;
      const fraction=Math.max(0,Math.min(1,(currentSimTime-exp.t_launch_sim_s)/(exp.eta_sim_s-exp.t_launch_sim_s)));
      const start=new THREE.Vector3(...exp.origin_local_pos_vec3).sub(this.origin),end=new THREE.Vector3(...exp.target_local_pos_vec3).sub(this.origin);
      child.position.copy(start.lerp(end,fraction));
      for(const trail of child.children)trail.scale.setScalar(Math.min(1,fraction*20));
    }
  }
  private clear(group:THREE.Group):void{
    for(const child of [...group.children]){
      child.traverse(object=>{
        if(object instanceof THREE.Mesh||object instanceof THREE.Line||object instanceof THREE.Points){
          object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());
        }else if(object instanceof THREE.Sprite)object.material.dispose();
      });group.remove(child);
    }
  }
  private line(points:THREE.Vector3[],tint:string,dashed=false):THREE.Line{
    const material=dashed?new THREE.LineDashedMaterial({color:tint,dashSize:.12,gapSize:.12}):new THREE.LineBasicMaterial({color:tint});
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),material);line.computeLineDistances();return line;
  }
  private position(item:PublicCatalog[number]):THREE.Vector3{
    // Subtract in JS float64 before writing any coordinates into GPU float32 buffers.
    const relative=new THREE.Vector3(...item.local_pos_vec3).sub(this.origin);
    return this.mode==='celestial'?relative.normalize().multiplyScalar(8):relative;
  }
  private rebuild():void{
    this.clear(this.stars);this.clear(this.route);this.clear(this.grid);
    const network=this.view?.['self.network'];
    for(const item of this.catalog){
      const p=this.position(item);if(this.mode==='celestial'&&p.lengthSq()===0)continue;
      const report=network?.nodes.find(n=>n.node_id===item.catalog_id);
      const request=network?.pending_frontier_requests.find(r=>r.target_node_id===item.catalog_id);
      const confirmed=report?.last_confirmed_status==='confirmed';
      const tint=confirmed?color.self:color.star[item.spectral_type];
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(this.mode==='celestial'?.07:.045,this.profile.sphereSegments,Math.max(6,this.profile.sphereSegments/2)),new THREE.MeshBasicMaterial({color:tint}));
      mesh.position.copy(p);mesh.userData.catalogId=item.catalog_id;this.stars.add(mesh);
      // Cosmetic glow is attached only to already-public catalog stars.
      for(let layer=0;layer<this.profile.glowLayers;layer++){
        const opacity=layer===0?.55:.22;
        const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowTexture!,color:tint,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending}));
        glow.position.copy(p);glow.scale.setScalar((this.mode==='celestial'?.5:.32)*(layer+1));
        glow.userData.baseOpacity=opacity;this.stars.add(glow);
      }
      const radius=this.selected===item.catalog_id?.24:.15;
      const points=Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI*2)*radius,Math.sin(i/64*Math.PI*2)*radius,0));
      const ring=this.line(points,confirmed?color.selfDim:color.ink2,!!request&&request.status!=='confirmed');ring.position.copy(p);if(this.mode==='celestial')ring.lookAt(0,0,0);this.stars.add(ring);
    }
    if(this.mode==='bubble'){
      for(let r=1;r<=6;r++){const points=Array.from({length:97},(_,i)=>new THREE.Vector3(Math.cos(i/96*Math.PI*2)*r,Math.sin(i/96*Math.PI*2)*r,0));this.grid.add(this.line(points,color.rule));}
      for(const link of network?.links??[]){if(!link.available||link.valid_until_sim_s<(this.view?.t_sim_s??0))continue;const a=this.catalog.find(s=>s.catalog_id===link.from_node_id),b=this.catalog.find(s=>s.catalog_id===link.to_node_id);if(a&&b&&network?.nodes.some(n=>n.node_id===b.catalog_id))this.route.add(this.line([this.position(a),this.position(b)],color.selfDim));}
      for(const exp of network?.active_expeditions??[]){
        if(exp.status!=='in_flight')continue;
        const start=new THREE.Vector3(...exp.origin_local_pos_vec3).sub(this.origin),end=new THREE.Vector3(...exp.target_local_pos_vec3).sub(this.origin);
        this.route.add(this.line([start,end],color.ink3,true));
        const craft=new THREE.Mesh(new THREE.OctahedronGeometry(.08),new THREE.MeshBasicMaterial({color:color.front}));craft.userData.expedition=exp;
        if(this.profile.trailParticles){
          const direction=end.clone().sub(start).normalize();
          const points=Array.from({length:this.profile.trailParticles},(_,index)=>direction.clone().multiplyScalar(-.03*(index+1)));
          const trail=new THREE.Points(new THREE.BufferGeometry().setFromPoints(points),new THREE.PointsMaterial({color:color.front,size:.045,map:this.glowTexture,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));
          craft.add(trail);
        }
        this.route.add(craft);
      }
    }else{
      const point=(longitude:number,latitude:number)=>{
        const theta=THREE.MathUtils.degToRad(longitude),phi=THREE.MathUtils.degToRad(latitude);
        return new THREE.Vector3(9*Math.cos(phi)*Math.cos(theta),9*Math.cos(phi)*Math.sin(theta),9*Math.sin(phi));
      };
      const addGridLine=(points:THREE.Vector3[],major=false)=>{
        const line=this.line(points,color.ink2);const material=line.material as THREE.LineBasicMaterial;
        material.transparent=true;material.opacity=major?.20:.12;this.grid.add(line);
      };
      // Parallels are small circles; meridians meet at the local +/-Z poles.
      for(let phi=-90+this.gridStep;phi<90;phi+=this.gridStep)
        addGridLine(Array.from({length:721},(_,i)=>point(i/2,phi)),phi===0);
      for(let theta=0;theta<360;theta+=this.gridStep)
        addGridLine(Array.from({length:361},(_,i)=>point(theta,-90+i/2)));
      for(let theta=0;theta<360;theta+=this.gridStep)
        addGridLine([point(theta,-.4),point(theta,.4)],true);

    }
  }
}
