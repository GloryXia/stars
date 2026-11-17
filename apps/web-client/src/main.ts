import {publicCatalogSchema,timelineSchema,KAPPA_T,SIM_SECONDS_PER_YEAR,type SeatCommandEnvelope,type PublicCatalog,type SeatTimeline,type SeatViewProjection} from '@stars/contracts';
import {GameSession,progression,coordinationControls,type ProgressStage,type QualityPreference} from '@stars/client-core';
import {readJson,webTransport,uuidv7} from './transport.js';
import {applyTokens} from '@stars/ui-tokens';
import {detectLocale,saveLocale,translate,type TranslationKey} from '@stars/i18n';
import {Presentation,type MapMode} from './presentation.js';
import {ConstructionPanel} from './construction.js';
import './style.css';

applyTokens(document.documentElement);
let locale=detectLocale();
const t=(key:TranslationKey)=>translate(locale,key);
const root=document.querySelector<HTMLDivElement>('#app')!;
root.innerHTML=`
  <header class="masthead"><div class="brand"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M8 4 32 36M32 4 8 36M8 4H32M8 36H32"/><circle cx="33" cy="17" r="2"/></svg><div><h1 data-i18n="title"></h1><p data-i18n="subtitle"></p></div></div><label class="language"><span data-i18n="language"></span><select id="language"><option value="zh-CN">中文</option><option value="en">English</option></select></label></header>
  <main><section class="observatory" aria-label="Observatory"><div id="map"></div><div class="map-top"><span class="eyebrow" data-i18n="foundation"></span><div class="segment"><button id="bubble" data-i18n="bubble" aria-pressed="true"></button><button id="celestial" data-i18n="celestial" aria-pressed="false"></button></div></div><div class="clock"><span data-i18n="time"></span><strong id="sim-time">T+ 0.00 <small>YR</small></strong><p data-i18n="scale"></p></div><div class="map-bottom"><p id="map-hint"></p><div class="zoom"><button id="zoom-out">−</button><button id="zoom-in">+</button></div></div><label class="quality"><span data-i18n="quality"></span><select id="quality"><option value="auto" data-i18n="qualityAuto"></option><option value="basic" data-i18n="qualityBasic"></option><option value="standard" data-i18n="qualityStandard"></option><option value="enhanced" data-i18n="qualityEnhanced"></option></select></label><p id="renderer-status" role="status"></p><button id="retry-graphics" class="retry-graphics" data-i18n="retryGraphics" hidden></button></section>
  <aside class="instrument"><div class="instrument-title"><span data-i18n="details"></span><span class="eyebrow">SEAT / 001</span></div><div class="metrics"><div><span data-i18n="confirmed"></span><strong id="confirmed">—</strong></div><div><span data-i18n="reachable"></span><strong id="reachable">—</strong></div><div><span data-i18n="persist"></span><strong id="persist">—</strong></div></div><dl class="readouts"><div><dt data-i18n="radius"></dt><dd id="cradle">—</dd></div><div><dt data-i18n="target"></dt><dd id="sync">—</dd></div><div><dt data-i18n="flights"></dt><dd id="flights">—</dd></div><div><dt data-i18n="autonomous"></dt><dd id="autonomous">—</dd></div></dl><div class="catalog-head" data-i18n="select"></div><div id="catalog" class="catalog"></div><article id="detail" hidden><div class="detail-heading"><h2 id="node-label"></h2><button id="close-detail" class="text-button">×</button></div><p id="node-state" class="node-state"></p><p id="node-description"></p><dl><div><dt data-i18n="sampled"></dt><dd id="sampled"></dd></div><div><dt data-i18n="arrived"></dt><dd id="arrived"></dd></div><div><dt data-i18n="age"></dt><dd id="report-age"></dd></div></dl><div class="coordination-actions"><button id="detach-node" data-i18n="detachNode" hidden></button><button id="sync-node" data-i18n="syncNode" hidden></button></div></article><button id="dispatch" class="primary" data-i18n="expand" disabled></button><p id="status" role="status" aria-live="polite"></p></aside>
  <section class="journey"><span data-i18n="nextObjective"></span><p id="journey-status" role="status"></p></section>
  <section id="construction-panel" class="construction"></section>
  <div class="command-feedback"><p id="command-feedback" role="status" aria-live="polite"></p><button id="retry-command" data-i18n="retryCommand" hidden></button></div>
  <section class="playback"><div class="playback-heading"><span data-i18n="timeline"></span><span id="source-label" class="eyebrow"></span></div><div class="timeline-scale"><span>0</span><span>40 SIM YR</span><span id="timeline-end">50 SIM YR</span></div><input id="seek" type="range" min="0" max="2760" step="1" value="0" disabled><div class="playback-controls"><button id="play" data-i18n="play" disabled></button><button id="replay" data-i18n="replay" disabled></button><label><span data-i18n="speed"></span><select id="speed"><option value="1">1×</option><option value="60">60×</option><option value="240" selected>240×</option></select></label><label><span data-i18n="scenario"></span><select id="scenario"><option value="success" data-i18n="success"></option><option value="no-ack" data-i18n="noAck"></option></select></label></div><p id="playback-note"></p></section>
  <details class="connection"><summary data-i18n="connection"></summary><form id="connection-form"><label><span data-i18n="token"></span><input id="token" type="password" autocomplete="off" spellcheck="false" required></label><button id="connect" data-i18n="connect"></button><button type="button" id="disconnect" data-i18n="disconnect" hidden></button></form><p data-i18n="connectionHint"></p><p id="connection-status" role="status"></p></details></main>`;
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let timeline:SeatTimeline|undefined,catalog:PublicCatalog=[],view:SeatViewProjection|undefined;
let started=false,playing=false,cursorReal=0,speed=240,selected:string|undefined,mode:MapMode='bubble';
const session=new GameSession(webTransport,uuidv7);
let api=false,commandBusy=false,pendingCommand=false;
let loadVersion=0,loadFailed=false;
let statusKey:TranslationKey='loading',apiError='';
const construction=new ConstructionPanel(el('construction-panel'),t,sendAction);
const scene=new Presentation(el('map'),id=>{selected=id;render();},()=>render());
const stageKeys:Record<ProgressStage,TranslationKey>={
  unavailable:'journeyUnavailable',build_world:'journeyWorld',research_persistence:'journeyPersist',ready:'journeyReady',
  in_flight:'journeyFlight',awaiting_receipt:'journeyReceipt',unconfirmed:'journeyUnconfirmed',develop_network:'journeyNetwork',extinct:'journeyExtinct',
};
session.subscribe(()=>{
  const state=session.state;
  api=state.status==='connected';commandBusy=state.busy;pendingCommand=state.pending;
  apiError=state.error?`${t('requestFailed')}: ${state.error}`:'';
  if(api){
    view=state.view;started=!!view?.['self.network'].pending_frontier_requests.some(request=>request.intent==='join');
    if(catalog!==state.catalog){catalog=state.catalog;scene.setCatalog(catalog);buildCatalog();}
  }
  el<HTMLButtonElement>('connect').disabled=state.status==='connecting'||state.busy||state.pending;
  el<HTMLButtonElement>('disconnect').disabled=state.busy||state.pending;
  el('disconnect').hidden=state.status==='disconnected'&&!state.error;
  render();
});

function localize():void {
  document.documentElement.lang=locale;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(node=>{node.textContent=t(node.dataset.i18n as TranslationKey);});
  el<HTMLSelectElement>('language').value=locale;
  el('seek').setAttribute('aria-label',t('seek'));el('zoom-in').setAttribute('aria-label',t('zoomIn'));el('zoom-out').setAttribute('aria-label',t('zoomOut'));el('close-detail').setAttribute('aria-label',t('close'));
  apiError=session.state.error?`${t('requestFailed')}: ${session.state.error}`:'';
  if(api)el('connection-status').textContent=t('connected');
  buildCatalog();render();
}
function buildCatalog():void {
  el('catalog').replaceChildren(...catalog.map(star=>{const button=document.createElement('button');button.textContent=`${star.label} · ${star.spectral_type}`;button.dataset.star=star.catalog_id;button.onclick=()=>{selected=star.catalog_id;render();};return button;}));
}
function snapshotAtCursor():void {
  if(!timeline||api)return;
  view=timeline.initial_snapshot;
  if(started)for(const frame of timeline.frames){if(frame.t_sim_s>cursorReal*KAPPA_T)break;view=frame.snapshot;}
}
function render():void {
  const nowSim=api?(view?.t_sim_s??0):cursorReal*KAPPA_T;
  el('sim-time').textContent=`T+ ${(nowSim/SIM_SECONDS_PER_YEAR).toFixed(2)} YR`;
  el('map-hint').textContent=t(mode==='bubble'?'mapHint':'skyHint');
  el('renderer-status').textContent=t(scene.statusKey);
  el('retry-graphics').hidden=scene.statusKey!=='graphicsUnavailable';
  el('map').parentElement!.dataset.quality=scene.qualityTier;
  el('map').parentElement!.dataset.presentation=scene.graphics?'graphics':'unavailable';
  el('journey-status').textContent=t(stageKeys[progression(view).stage]);
  el('source-label').textContent=t(api?'online':'offline');
  el('playback-note').textContent=t(api?'apiOnly':'disclaimer');
  const extinct=!!view?.['extinction.report'].extinct;
  const unlocked=progression(view).canDispatch;
  el('status').textContent=apiError||t(extinct?'civilizationExtinct':loadFailed&&!api?'missing':view&&!unlocked&&!started?'expeditionLocked':statusKey);
  el<HTMLButtonElement>('dispatch').disabled=extinct||!view||!unlocked||started||commandBusy||!!pendingCommand;
  el('command-feedback').textContent=pendingCommand?t('pendingOrder'):apiError;
  el('retry-command').hidden=!pendingCommand;el<HTMLButtonElement>('retry-command').disabled=commandBusy;
  construction.render(view?.['self.telemetry'],!!api,commandBusy||!!pendingCommand,view?.['extinction.report']);
  el('dispatch').textContent=t(started?'committed':view&&!unlocked?'expeditionLockedAction':'expand');
  el<HTMLButtonElement>('play').disabled=!!api||!timeline||!started;el('play').textContent=t(playing?'pause':'play');
  el<HTMLButtonElement>('replay').disabled=!!api||!timeline;
  el<HTMLInputElement>('seek').disabled=!!api||!timeline||!started;el<HTMLInputElement>('seek').value=String(cursorReal);
  el<HTMLSelectElement>('scenario').disabled=!!api;el<HTMLSelectElement>('speed').disabled=!!api;
  for(const id of ['zoom-in','zoom-out','bubble','celestial'])el<HTMLButtonElement>(id).disabled=!scene.graphics;
  const telemetry=view?.['self.telemetry'];
  el('confirmed').textContent=String(telemetry?.controlled_node_count??'—');el('reachable').textContent=String(telemetry?.known_reachable_node_count??'—');el('persist').textContent=telemetry?.r_persist.toFixed(2)??'—';
  el('cradle').textContent=telemetry?`${telemetry.cradle_span_ly.toFixed(2)} LY`:'—';el('sync').textContent=telemetry?`${telemetry.active_sync_span_ly.toFixed(2)} LY`:'—';
  el('flights').textContent=String(telemetry?.expeditions_in_flight_count??'—');el('autonomous').textContent=String(telemetry?.detached_autonomous_node_count??'—');
  for(const button of el('catalog').querySelectorAll<HTMLButtonElement>('button'))button.setAttribute('aria-pressed',String(button.dataset.star===selected));
  const star=catalog.find(s=>s.catalog_id===selected);el('detail').hidden=!star;
  if(star&&view){
    const report=view['self.network'].nodes.find(n=>n.node_id===star.catalog_id),request=view['self.network'].pending_frontier_requests.find(r=>r.target_node_id===star.catalog_id);
    const status=report?.last_confirmed_status??request?.status??'catalog';
    el('node-label').textContent=star.label;el('node-state').textContent=t(status as TranslationKey);el('node-state').dataset.state=status;
    const hints:Partial<Record<string,TranslationKey>>={confirmed:'confirmedHint',detached_autonomous:'autonomousHint',lost:'lostHint',destroyed:'destroyedHint',seceded:'secededHint',timeout:'timeoutHint',pending:'pendingHint'};
    el('node-description').textContent=t(hints[status]??'catalogHint');
    el('sampled').textContent=report?`${(report.t_source_sim_s/SIM_SECONDS_PER_YEAR).toFixed(2)} SIM YR`:t('unknown');
    el('arrived').textContent=report?`${(report.t_arrive_sim_s/SIM_SECONDS_PER_YEAR).toFixed(2)} SIM YR`:'—';
    el('report-age').textContent=report?`${Math.max(0,(nowSim-report.t_source_sim_s)/SIM_SECONDS_PER_YEAR).toFixed(2)} SIM YR`:'—';
  }
  const coordination=coordinationControls(view,selected);
  el('detach-node').hidden=!coordination.canDetach;el('sync-node').hidden=!coordination.canSync;
  for(const id of ['detach-node','sync-node'])el<HTMLButtonElement>(id).disabled=!api||commandBusy||pendingCommand;
  if(view)scene.update(view,selected,nowSim);
}
async function loadReplay():Promise<void>{
  const version=++loadVersion;statusKey='loading';loadFailed=false;timeline=undefined;view=undefined;started=false;playing=false;cursorReal=0;apiError='';render();
  try{
    const branch=el<HTMLSelectElement>('scenario').value;
    const [rawTimeline,rawCatalog]=await Promise.all([readJson(`/fixtures/${branch}.json`),readJson('/fixtures/catalog.json')]);
    if(version!==loadVersion||api)return;
    const parsed=timelineSchema.parse(rawTimeline);for(let i=1;i<parsed.frames.length;i++)if(parsed.frames[i]!.t_sim_s<parsed.frames[i-1]!.t_sim_s)throw new Error('Unsorted timeline');
    timeline=parsed;catalog=publicCatalogSchema.parse(rawCatalog);scene?.setCatalog(catalog);buildCatalog();snapshotAtCursor();
    el<HTMLInputElement>('seek').max=String(Math.max(2760,(timeline.frames.at(-1)?.t_sim_s??0)/KAPPA_T));el('timeline-end').textContent=`${(Number(el<HTMLInputElement>('seek').max)/60).toFixed(0)} SIM YR`;statusKey='ready';
  }catch{if(version===loadVersion&&!api){loadFailed=true;statusKey='missing';}}
  render();
}
async function sendAction(action?:SeatCommandEnvelope['action']):Promise<boolean>{
  const accepted=await session.send(action);
  if(accepted){statusKey='commandApplied';construction.reportCommandResult(true);render();}
  return accepted;
}
el('retry-command').onclick=()=>{void sendAction();};
el('dispatch').onclick=async()=>{
  if(started||commandBusy||pendingCommand||!view)return;
  if(!api){started=true;playing=true;statusKey='started';snapshotAtCursor();render();return;}
  if(await sendAction({type:'dispatch_expedition',target_node_id:'B',drive_mode:'standard_010c'})){started=true;statusKey='started';render();}
};
el('play').onclick=()=>{if(!api&&started){playing=!playing;render();}};
el('replay').onclick=()=>{if(api)return;playing=false;started=false;cursorReal=0;statusKey='ready';snapshotAtCursor();render();};
el('seek').oninput=()=>{cursorReal=Number(el<HTMLInputElement>('seek').value);playing=false;snapshotAtCursor();render();};
el('speed').onchange=()=>{speed=Number(el<HTMLSelectElement>('speed').value);};
el('scenario').onchange=()=>{void loadReplay();};
el('language').onchange=()=>{locale=el<HTMLSelectElement>('language').value==='en'?'en':'zh-CN';saveLocale(locale);localize();};
for(const nextMode of ['bubble','celestial'] as const)el(nextMode).onclick=()=>{mode=nextMode;scene?.setMode(mode);el('bubble').setAttribute('aria-pressed',String(mode==='bubble'));el('celestial').setAttribute('aria-pressed',String(mode==='celestial'));render();};
el('zoom-in').onclick=()=>scene?.zoom(.8);el('zoom-out').onclick=()=>scene?.zoom(1.25);
el('close-detail').onclick=()=>{selected=undefined;render();};document.addEventListener('keydown',e=>{if(e.key==='Escape'){selected=undefined;render();}});
for(const [id,coordinationMode] of [['detach-node','detach_outer_node'],['sync-node','sync']] as const){
  el(id).onclick=()=>{if(selected)void sendAction({type:'set_node_coordination',node_id:selected,mode:coordinationMode});};
}
let quality:QualityPreference='auto';
try{const saved=localStorage.getItem('stars.quality');if(saved==='basic'||saved==='standard'||saved==='enhanced')quality=saved;}catch{/* Session preference remains usable. */}
el<HTMLSelectElement>('quality').value=quality;
el('retry-graphics').onclick=()=>{void scene.configure(quality);};
el('quality').onchange=()=>{
  quality=el<HTMLSelectElement>('quality').value as QualityPreference;
  try{localStorage.setItem('stars.quality',quality);}catch{/* Storage is optional. */}
  void scene.configure(quality);
};
el('connection-form').onsubmit=async event=>{
  event.preventDefault();
  if(commandBusy||pendingCommand)return;
  const token=el<HTMLInputElement>('token').value;
  loadVersion++;playing=false;timeline=undefined;view=undefined;
  el('connection-status').textContent=t('connecting');
  if(await session.connect(token)){
    statusKey=started?'started':'ready';el<HTMLInputElement>('token').value='';
    el('connection-status').textContent=t('connected');
  }else el('connection-status').textContent=apiError;
  render();
};
el('disconnect').onclick=()=>{
  if(!session.disconnect())return;
  el('connection-status').textContent='';void loadReplay();
};
let last=performance.now();
setInterval(()=>{const now=performance.now(),elapsed=(now-last)/1000;last=now;if(!document.hidden&&playing&&timeline&&!api){cursorReal=Math.min(Number(el<HTMLInputElement>('seek').max),cursorReal+elapsed*speed);if(cursorReal>=Number(el<HTMLInputElement>('seek').max))playing=false;snapshotAtCursor();render();}},100);
document.addEventListener('visibilitychange',()=>{last=performance.now();});setInterval(()=>{if(!document.hidden)void session.refresh();},1000);
localize();void loadReplay();void scene.configure(quality);
