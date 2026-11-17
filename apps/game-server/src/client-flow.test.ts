import {afterEach,describe,expect,it} from 'vitest';
import {GameSession,RequestError,presentationProfile,nextQuality,progression,coordinationControls,type ClientTransport} from '@stars/client-core';
import {createCivilization} from '@stars/sim-core';
import type {SeatViewProjection} from '@stars/contracts';
import {createApp} from './app.js';
import type {Receipt,SeatRepository} from './repository.js';

class MemoryRepository implements SeatRepository {
  snapshot:unknown={simulation:createCivilization({seed:'cold-start-reference-v1'}),anchor_real_ms:0};
  receipts=new Map<string,Receipt>();
  async ready(){}
  async transaction<T>(_context:unknown,_account:string,fn:Parameters<SeatRepository['transaction']>[2]):Promise<T>{
    return await fn({snapshot:structuredClone(this.snapshot),receipt:async(kind,id)=>this.receipts.get(kind+id),
      save:async(state)=>{this.snapshot=structuredClone(state);},record:async(kind,id,result)=>{this.receipts.set(kind+id,result);}}) as T;
  }
}
const apps:ReturnType<typeof createApp>['app'][]=[];
afterEach(async()=>{await Promise.all(apps.splice(0).map(app=>app.close()));});
function setup(){
  const repository=new MemoryRepository();let time=0;
  const app=createApp({repository,devToken:'test-only',now:()=>time}).app;apps.push(app);
  let id=0;
  const sent:string[]=[];
  const transport:ClientTransport={async request(path,request){
    if(request.body)sent.push(request.body);
    const response=await app.inject({url:path,method:request.method,headers:{authorization:`Bearer ${request.token}`,...(request.body?{'content-type':'application/json'}:{})},...(request.body?{payload:request.body}:{})});
    const body=response.json();
    if(response.statusCode>=400)throw new RequestError(body.error.code,response.statusCode);
    return body;
  }};
  const client=(adapter:ClientTransport=transport)=>new GameSession(adapter,()=>`019a8700-0000-7000-8000-${(++id).toString().padStart(12,'0')}`);
  return {repository,transport,client,sent,year:(year:number)=>{time=year*60_000;}};
}
const earlyPlan={type:'configure_allocation_plan',enabled:true,items:[{dimension:'world_up',target_level:2},{dimension:'persist',target_level:2}]} as const;
const sendPlan=(session:GameSession,persist=2)=>session.send({...earlyPlan,items:[{dimension:'world_up',target_level:2},{dimension:'persist',target_level:persist}]});

describe('renderer-independent playable foundation',()=>{
  it('runs cold start → construction → offline catchup → expedition → receipt → Tier 2 across two clients',async()=>{
    const f=setup(),web=f.client(),app=f.client();
    expect(await web.connect('test-only')).toBe(true);
    expect(progression(web.state.view).stage).toBe('build_world');
    expect(await sendPlan(web)).toBe(true);
    f.year(30);await web.refresh();
    expect(progression(web.state.view).stage).toBe('research_persistence');
    expect(web.disconnect()).toBe(true);
    f.year(800);expect(await app.connect('test-only')).toBe(true);
    expect(progression(app.state.view)).toEqual({stage:'ready',canDispatch:true});
    expect(await app.send({type:'dispatch_expedition',target_node_id:'B'})).toBe(true);
    expect(progression(app.state.view).stage).toBe('in_flight');
    expect(await app.send({type:'configure_allocation_plan',enabled:true,items:[{dimension:'persist',target_level:2},{dimension:'k_tier_up',target_level:2},{dimension:'persist',target_level:3},{dimension:'obs',target_level:3}]})).toBe(true);
    f.year(840);await app.refresh();expect(progression(app.state.view).stage).toBe('awaiting_receipt');
    f.year(843.999);await app.refresh();expect(app.state.view?.['self.telemetry'].controlled_node_count).toBe(1);
    f.year(844);await app.refresh();expect(progression(app.state.view).stage).toBe('develop_network');
    f.year(1000);await app.refresh();expect(app.state.view?.['self.telemetry'].k_tier).toBe(2);
    f.year(2000);await app.refresh();await web.connect('test-only');
    expect(web.state.view).toEqual(app.state.view);
    expect(web.state.view?.['extinction.report'].extinct).toBe(false);
    expect(f.sent).toHaveLength(3);
  });
  it('lets the player detach and resynchronize using received evidence',async()=>{
    const f=setup(),session=f.client();await session.connect('test-only');await sendPlan(session);
    f.year(800);await session.refresh();await session.send({type:'dispatch_expedition',target_node_id:'B'});
    expect(coordinationControls(session.state.view,'B').canDetach).toBe(false);
    f.year(844);await session.refresh();expect(coordinationControls(session.state.view,'B').canDetach).toBe(true);
    expect(await session.send({type:'set_node_coordination',node_id:'B',mode:'detach_outer_node'})).toBe(true);
    expect(coordinationControls(session.state.view,'B')).toEqual({canDetach:false,canSync:true});
    expect(await session.send({type:'set_node_coordination',node_id:'B',mode:'sync'})).toBe(true);
    expect(coordinationControls(session.state.view,'B').canSync).toBe(false);
    f.year(852);await session.refresh();expect(coordinationControls(session.state.view,'B').canDetach).toBe(true);
  });
  it('keeps a lost-response order intact, blocks replacement and retries without duplicate work',async()=>{
    const f=setup();let lose=true;
    const session=f.client({async request(path,request){
      const result=await f.transport.request(path,request);
      if(request.method==='POST'&&lose){lose=false;throw new RequestError('RESPONSE_LOST',503);}return result;
    }});
    await session.connect('test-only');
    expect(await sendPlan(session)).toBe(false);
    expect(session.state).toMatchObject({pending:true,busy:false});
    expect(session.disconnect()).toBe(false);expect(await session.connect('different-token')).toBe(false);
    expect(await session.send({type:'allocate_evolution_point',dimension:'world_up'})).toBe(false);
    expect(await session.send()).toBe(true);
    expect(f.sent).toHaveLength(2);expect(f.sent[0]).toBe(f.sent[1]);expect(f.repository.receipts.size).toBe(1);
    expect(session.state.pending).toBe(false);expect(session.state.view?.['self.telemetry'].active_construction?.target_level).toBe(2);
  });
  it('refreshes after a definitive rejection and leaves the client able to issue the next legal order',async()=>{
    const f=setup(),session=f.client();await session.connect('test-only');
    expect(await session.send({type:'dispatch_expedition',target_node_id:'B'})).toBe(false);
    expect(session.state).toMatchObject({pending:false,busy:false,error:'EXPEDITION_LOCKED'});
    expect(await sendPlan(session)).toBe(true);
  });
  it('clears a transient polling error after recovery and keeps explicit rejection feedback',async()=>{
    const f=setup();let fail=false;
    const session=f.client({request:(path,request)=>fail&&path.includes('/view')?Promise.reject(new Error('OFFLINE')):f.transport.request(path,request)});
    await session.connect('test-only');fail=true;await session.refresh();expect(session.state.error).toBe('OFFLINE');
    fail=false;await session.refresh();expect(session.state.error).toBe('');
    await session.send({type:'dispatch_expedition',target_node_id:'B'});await session.refresh();
    expect(session.state.error).toBe('EXPEDITION_LOCKED');
  });
  it('retains uncertain orders when the acknowledgement has a wrong ID',async()=>{
    const f=setup(),session=f.client({async request(path,request){
      const result=await f.transport.request(path,request);
      return request.method==='POST'?{...(result as object),command_id:'019a8700-0000-7000-8000-999999999999'}:result;
    }});
    await session.connect('test-only');expect(await sendPlan(session)).toBe(false);
    expect(session.state).toMatchObject({pending:true,error:'COMMAND_RECEIPT_MISMATCH'});
  });
  it('preserves the extinction report and refuses new orders after reconnect',async()=>{
    const f=setup(),session=f.client();await session.connect('test-only');await sendPlan(session,1);
    f.year(400);await session.refresh();await session.send({type:'dispatch_expedition',target_node_id:'B'});
    f.year(500);await session.refresh();expect(progression(session.state.view).stage).toBe('extinct');
    const report=session.state.view?.['extinction.report'];session.disconnect();f.year(2000);await session.connect('test-only');
    expect(session.state.view?.['extinction.report']).toEqual(report);
    const count=f.sent.length;expect(await sendPlan(session)).toBe(false);expect(f.sent).toHaveLength(count);
  });
  it('rejects wrong-generation views and never rolls back to an older projection',async()=>{
    const f=setup();let substitute:SeatViewProjection|undefined;
    const session=f.client({request:(path,request)=>substitute&&path.includes('/view')?Promise.resolve(substitute):f.transport.request(path,request)});
    await session.connect('test-only');const initial=session.state.view!;
    f.year(30);await session.refresh();const current=session.state.view;
    substitute=initial;await session.refresh();expect(session.state.view).toEqual(current);
    substitute={...initial,civ_gen:2};await session.refresh();expect(session.state.view).toEqual(current);
    expect(session.state.error).toBe('SEAT_CONTEXT_MISMATCH');
  });
  it('ignores an old connection and a late poll after switching seats',async()=>{
    const f=setup();let resolve!:(data:unknown)=>void;
    const session=f.client({request:(path,request)=>request.token==='delayed'?new Promise(r=>{resolve=r;}):f.transport.request(path,request)});
    const first=session.connect('delayed');await session.connect('test-only');
    const valid=session.state.view;
    resolve({});expect(await first).toBe(false);expect(session.state.view).toEqual(valid);
    let release!:(data:unknown)=>void;
    const old=f.client({request:(path,request)=>path.includes('/view')?new Promise(r=>{release=r;}):f.transport.request(path,request)});
    await old.connect('test-only');const poll=old.refresh();old.disconnect();release(valid);await poll;
    expect(old.state.status).toBe('disconnected');expect(old.state.view).toBeUndefined();
  });
  it('finishes a pre-command poll and fetches a fresh projection after acceptance',async()=>{
    const f=setup();let release!:(data:unknown)=>void,hold=true;
    const session=f.client({request:(path,request)=>{
      if(path.includes('/view')&&hold){hold=false;return new Promise(r=>{release=r;});}
      return f.transport.request(path,request);
    }});
    await session.connect('test-only');const before=session.state.view;
    const poll=session.refresh(),send=sendPlan(session);
    release(before);await poll;expect(await send).toBe(true);
    expect(session.state.view?.['self.telemetry'].active_construction?.dimension).toBe('world_up');
  });
  it('labels a missing receipt as unconfirmed without guessing the remote outcome',async()=>{
    const f=setup();f.repository.snapshot={simulation:createCivilization({seed:'cold-start-reference-v1',branch:'no-ack'}),anchor_real_ms:0};
    const session=f.client();await session.connect('test-only');await sendPlan(session);
    f.year(800);await session.refresh();await session.send({type:'dispatch_expedition',target_node_id:'B'});
    f.year(846);await session.refresh();expect(progression(session.state.view).stage).toBe('unconfirmed');
    expect(session.state.view?.['self.telemetry'].controlled_node_count).toBe(1);
  });
});

describe('capability-based 3D presentation budget',()=>{
  it('keeps a running 3D budget at every quality level, including data saving',()=>{
    for(const tier of ['basic','standard','enhanced'] as const){
      const profile=presentationProfile(tier,{graphics:true,reducedMotion:false,saveData:false});
      expect(profile.maxFps).toBeGreaterThan(0);expect(profile.sphereSegments).toBeGreaterThanOrEqual(8);
    }
    expect(presentationProfile('auto',{graphics:true,reducedMotion:false,saveData:true})).toMatchObject({tier:'basic',maxFps:30});
  });
  it('treats unavailable graphics as incompatibility, never as a 2D tier',()=>{
    expect(()=>presentationProfile('basic',{graphics:false,reducedMotion:false,saveData:false})).toThrow('GRAPHICS_UNAVAILABLE');
  });
  it('adds cosmetic detail and resolution while reduced motion only disables decorative animation',()=>{
    const capabilities={graphics:true,reducedMotion:false,saveData:false};
    const basic=presentationProfile('basic',capabilities),standard=presentationProfile('standard',capabilities),enhanced=presentationProfile('enhanced',capabilities);
    expect(basic.glowLayers).toBe(0);expect(basic.trailParticles).toBe(0);
    expect(standard.glowLayers).toBeGreaterThan(basic.glowLayers);expect(enhanced.glowLayers).toBeGreaterThan(standard.glowLayers);
    expect(enhanced.trailParticles).toBeGreaterThan(standard.trailParticles);expect(enhanced.maxPixelRatio).toBeGreaterThan(basic.maxPixelRatio);
    expect(presentationProfile('enhanced',{...capabilities,reducedMotion:true})).toEqual({...enhanced,animateEffects:false});
  });
  it('steps down only within 3D and upgrades only with sustained measured headroom',()=>{
    expect(nextQuality('enhanced',35,10,false)).toBe('standard');
    expect(nextQuality('standard',55,20,false)).toBe('basic');
    expect(nextQuality('basic',150,70,false)).toBe('basic');
    expect(nextQuality('standard',16.7,4,true)).toBe('enhanced');
    expect(nextQuality('standard',16.7,4,false)).toBe('standard');
    expect(nextQuality('standard',16.7,12,true)).toBe('standard');
    expect(nextQuality('standard',NaN,4,true)).toBe('standard');
  });
});
