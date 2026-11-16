import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {color} from '@stars/ui-tokens';
import type {PublicCatalog,SeatViewProjection} from '@stars/contracts';

export type MapMode='bubble'|'celestial';
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
  constructor(private host:HTMLElement,private onSelect:(id:string)=>void){
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setClearColor(color.void0);
    this.renderer.domElement.setAttribute('aria-hidden','true');
    host.append(this.renderer.domElement);
    this.camera.position.copy(this.bubblePosition);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.target.copy(this.bubbleTarget);
    this.controls.enableDamping=false;
    this.controls.enablePan=false;
    this.controls.minDistance=2;this.controls.maxDistance=40;
    this.scene.add(this.stars,this.route,this.grid);
    this.renderer.domElement.addEventListener('pointerdown',e=>{
      this.activePointers.add(e.pointerId);
      if(this.activePointers.size===1){this.press={x:e.clientX,y:e.clientY};this.dragged=false;}else this.dragged=true;
    });
    this.renderer.domElement.addEventListener('pointermove',e=>{if(this.press&&Math.hypot(e.clientX-this.press.x,e.clientY-this.press.y)>6)this.dragged=true;});
    this.renderer.domElement.addEventListener('pointerup',e=>{
      this.activePointers.delete(e.pointerId);
      if(!this.dragged&&this.press){const rect=host.getBoundingClientRect();this.pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);const hit=this.raycaster.intersectObjects(this.stars.children).find(h=>typeof h.object.userData.catalogId==='string');if(hit)this.onSelect(hit.object.userData.catalogId as string);}
      if(!this.activePointers.size)this.press=undefined;
    });
    const cancel=()=>{this.activePointers.clear();this.press=undefined;this.dragged=true;};
    this.renderer.domElement.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',cancel);
    new ResizeObserver(()=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;this.renderer.setSize(width,height);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();}).observe(host);
    this.renderer.setAnimationLoop(()=>{if(!document.hidden){this.controls.update();this.renderer.render(this.scene,this.camera);}});
  }
  setCatalog(catalog:PublicCatalog):void{this.catalog=catalog;const anchor=catalog[0];this.origin.fromArray(anchor?.local_pos_vec3??[0,0,0]);this.rebuild();}
  setMode(mode:MapMode):void{
    if(mode===this.mode)return;
    if(this.mode==='bubble'){this.bubblePosition.copy(this.camera.position);this.bubbleTarget.copy(this.controls.target);}
    this.mode=mode;
    this.controls.enableZoom=mode==='bubble';
    this.controls.minDistance=mode==='bubble'?2:0.001;
    this.controls.maxDistance=mode==='bubble'?40:0.02;
    if(mode==='bubble'){this.camera.position.copy(this.bubblePosition);this.controls.target.copy(this.bubbleTarget);}else{this.camera.position.set(-0.01,0,0.008);this.controls.target.set(0,0,0);}
    this.controls.update();this.rebuild();
  }
  zoom(multiplier:number):void{if(this.mode==='bubble'){this.camera.position.sub(this.controls.target).multiplyScalar(multiplier).add(this.controls.target);this.controls.update();}}
  update(view:SeatViewProjection,selected:string|undefined,currentSimTime:number):void{
    const changed=this.view?.view_version!==view.view_version||this.view?.seat_id!==view.seat_id||this.selected!==selected||this.view!==view;
    this.view=view;this.selected=selected;if(changed)this.rebuild();
    for(const child of this.route.children){const exp=child.userData.expedition as SeatViewProjection['self.network']['active_expeditions'][number]|undefined;if(!exp)continue;
      const fraction=Math.max(0,Math.min(1,(currentSimTime-exp.t_launch_sim_s)/(exp.eta_sim_s-exp.t_launch_sim_s)));
      const start=new THREE.Vector3(...exp.origin_local_pos_vec3).sub(this.origin),end=new THREE.Vector3(...exp.target_local_pos_vec3).sub(this.origin);
      child.position.copy(start.lerp(end,fraction));
    }
  }
  private clear(group:THREE.Group):void{for(const child of [...group.children]){child.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose());}});group.remove(child);}}
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
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(this.mode==='celestial'?.07:.045,12,8),new THREE.MeshBasicMaterial({color:tint}));
      mesh.position.copy(p);mesh.userData.catalogId=item.catalog_id;this.stars.add(mesh);
      const radius=this.selected===item.catalog_id?.24:.15;
      const points=Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI*2)*radius,Math.sin(i/64*Math.PI*2)*radius,0));
      const ring=this.line(points,confirmed?color.selfDim:color.ink2,!!request&&request.status!=='confirmed');ring.position.copy(p);this.stars.add(ring);
    }
    if(this.mode==='bubble'){
      for(let r=1;r<=6;r++){const points=Array.from({length:97},(_,i)=>new THREE.Vector3(Math.cos(i/96*Math.PI*2)*r,0,Math.sin(i/96*Math.PI*2)*r));this.grid.add(this.line(points,color.rule));}
      for(const link of network?.links??[]){if(!link.available||link.valid_until_sim_s<(this.view?.t_sim_s??0))continue;const a=this.catalog.find(s=>s.catalog_id===link.from_node_id),b=this.catalog.find(s=>s.catalog_id===link.to_node_id);if(a&&b&&network?.nodes.some(n=>n.node_id===b.catalog_id))this.route.add(this.line([this.position(a),this.position(b)],color.selfDim));}
      for(const exp of network?.active_expeditions??[]){
        if(exp.status!=='in_flight')continue;
        const start=new THREE.Vector3(...exp.origin_local_pos_vec3).sub(this.origin),end=new THREE.Vector3(...exp.target_local_pos_vec3).sub(this.origin);
        this.route.add(this.line([start,end],color.ink3,true));
        const craft=new THREE.Mesh(new THREE.OctahedronGeometry(.08),new THREE.MeshBasicMaterial({color:color.front}));craft.userData.expedition=exp;this.route.add(craft);
      }
    }else{
      for(let axis=0;axis<3;axis++){const pts=Array.from({length:97},(_,i)=>{const a=i/96*Math.PI*2;return axis===0?new THREE.Vector3(0,Math.cos(a)*9,Math.sin(a)*9):axis===1?new THREE.Vector3(Math.cos(a)*9,0,Math.sin(a)*9):new THREE.Vector3(Math.cos(a)*9,Math.sin(a)*9,0);});this.grid.add(this.line(pts,color.rule));}
    }
  }
}
