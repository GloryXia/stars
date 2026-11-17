import { SIM_SECONDS_PER_YEAR,allocationPlanConfigSchema, evolutionDimensionSchema, type AllocationPlanConfig, type EvolutionDimension, type SeatCommandEnvelope, type SeatViewProjection } from '@stars/contracts';
import type { TranslationKey } from '@stars/i18n';

type Action=SeatCommandEnvelope['action'];
type Telemetry=SeatViewProjection['self.telemetry'];
const dimensionKey=(dimension:EvolutionDimension):TranslationKey=>dimension==='persist' ? 'persistTech' : dimension;

/** This panel only consumes seat projections; no authoritative simulation is bundled. */
export class ConstructionPanel {
  private telemetry?:Telemetry;
  private writable=false;
  private draft:AllocationPlanConfig['items']=[];
  private dirty=false;
  private queueSignature='';
  private localeSignature='';
  private planSignature='';
  private messageKey?:TranslationKey;
  private controls:HTMLFieldSetElement;
  private editor:HTMLElement;
  constructor(private root:HTMLElement,private t:(key:TranslationKey)=>string,private send:(action:Action)=>Promise<boolean>) {
    root.innerHTML=`
      <div class="construction-heading"><h2 data-i18n="construction"></h2><span id="build-tier" class="eyebrow"></span></div>
      <p id="construction-note"></p>
      <section id="extinction-report" class="extinction-report" role="status" hidden><h3 data-i18n="civilizationExtinct"></h3><p id="extinction-cause"></p><p data-i18n="extinctionConsequences"></p></section>
      <div class="construction-columns">
        <div class="construction-work">
          <div class="build-metrics"><div><span data-i18n="points"></span><strong id="evo-points">—</strong></div><div><span data-i18n="pointRate"></span><strong id="evo-rate">—</strong></div><div><span data-i18n="worlds"></span><strong id="world-count">—</strong></div></div>
          <p id="growth-readout"></p>
          <details class="stability-panel"><summary id="sdi-readout"></summary><p id="sdi-effect"></p><dl id="sdi-breakdown"></dl><p id="sdi-network"></p><p id="sdi-note"></p><p id="instability-note"></p><p id="instability-event"></p></details>
          <p id="tech-levels"></p><div class="active-work"><span data-i18n="activeWork"></span><strong id="active-work">—</strong></div>
          <form id="build-form"><label><span data-i18n="buildProject"></span><select id="build-dimension"></select></label><button id="build-enqueue" data-i18n="enqueue"></button></form>
          <div class="build-list-heading"><h3 data-i18n="buildQueue"></h3><span id="queue-count" class="eyebrow">0 / 5</span></div>
          <ol id="build-queue"></ol><p data-i18n="queueHelp"></p>
        </div>
        <div class="construction-plan"><div class="build-list-heading"><h3 data-i18n="allocationPlan"></h3><span id="plan-state"></span></div>
          <p id="plan-progress"></p><ol id="current-plan"></ol><button id="plan-toggle"></button>
          <details id="plan-editor"><summary data-i18n="planDraft"></summary>
            <fieldset id="plan-fields"><legend class="sr-only" data-i18n="planDraft"></legend><ol id="plan-steps"></ol>
              <div class="plan-actions"><button id="plan-add" type="button" data-i18n="addStep"></button><button id="plan-load" type="button" data-i18n="loadPlan"></button><button id="plan-apply" type="button" data-i18n="applyPlan"></button></div>
            </fieldset><p id="plan-draft-status" role="status"></p>
          </details><p data-i18n="planHelp"></p>
        </div>
      </div><p id="build-message" role="status" aria-live="polite"></p>`;
    this.controls=this.find<HTMLFieldSetElement>('plan-fields');
    this.editor=this.find('plan-steps');
    this.options(this.find('build-dimension'));
    this.find<HTMLFormElement>('build-form').onsubmit=event=>{
      event.preventDefault();
      if(this.writable) void this.submit({type:'allocate_evolution_point',dimension:this.find<HTMLSelectElement>('build-dimension').value as EvolutionDimension,queue_op:'enqueue'});
    };
    this.find('plan-add').onclick=()=>{
      if(this.draft.length>=20) return;
      this.draft.push({dimension:'persist'});this.dirty=true;this.renderDraft();
    };
    this.find('plan-load').onclick=()=>{this.draft=structuredClone(this.telemetry?.allocation_plan.items??[]);this.dirty=false;this.renderDraft();};
    this.find('plan-toggle').onclick=()=>{
      const plan=this.telemetry?.allocation_plan;
      if(this.writable&&plan) void this.submit({type:'configure_allocation_plan',enabled:!plan.enabled,items:plan.items,...(plan.template_id ? {template_id:plan.template_id} : {})});
    };
    this.find('plan-apply').onclick=async()=>{
      if(!this.writable) return;
      const config=allocationPlanConfigSchema.safeParse({enabled:true,items:this.draft});
      if(!config.success){this.messageKey='invalidPlan';this.find('build-message').textContent=this.t(this.messageKey);return;}
      if(await this.submit({type:'configure_allocation_plan',...config.data})) this.dirty=false;
      this.draftStatus();
    };
    this.renderDraft();
  }
  private find<T extends HTMLElement=HTMLElement>(id:string):T {return this.root.querySelector<T>(`#${id}`)!;}
  private options(select:HTMLSelectElement):void {
    const value=select.value;
    select.replaceChildren(...evolutionDimensionSchema.options.map(dimension=>new Option(this.t(dimensionKey(dimension)),dimension)));
    if(value) select.value=value;
  }
  private async submit(action:Action):Promise<boolean> {
    this.messageKey=undefined;
    this.find('build-message').textContent='';
    const accepted=await this.send(action);
    this.reportCommandResult(accepted);
    return accepted;
  }
  reportCommandResult(accepted:boolean):void {
    this.messageKey=accepted?'commandApplied':'requestFailed';
    this.find('build-message').textContent=this.t(this.messageKey);
  }
  private draftStatus():void {
    this.find('plan-draft-status').textContent=`${this.t(this.dirty?'draftUnsaved':'draftReady')} · ${this.draft.length} / 20`;
    this.find<HTMLButtonElement>('plan-add').disabled=this.draft.length>=20;
  }
  private renderDraft():void {
    this.editor.replaceChildren(...this.draft.map((item,index)=>{
      const row=document.createElement('li');
      const select=document.createElement('select');this.options(select);select.value=item.dimension;
      select.setAttribute('aria-label',`${index+1}. ${this.t('buildProject')}`);
      select.onchange=()=>{item.dimension=select.value as EvolutionDimension;this.dirty=true;this.draftStatus();};
      row.append(select);
      for(const [key,label] of [['target_level','targetLevel'],['min_k','minimumK']] as const) {
        const wrapper=document.createElement('label'),text=document.createElement('span'),input=document.createElement('input');
        text.textContent=this.t(label);input.type='number';input.min=key==='target_level'?'1':'0.56';input.max=key==='target_level'?'4':'2';input.step=key==='target_level'?'1':'0.01';
        input.value=item[key]===undefined?'':String(item[key]);input.setAttribute('aria-label',`${index+1}. ${this.t(label)}`);
        input.oninput=()=>{if(input.value==='')delete item[key];else item[key]=input.valueAsNumber;this.dirty=true;this.draftStatus();};
        wrapper.append(text,input);row.append(wrapper);
      }
      const remove=document.createElement('button');remove.type='button';remove.textContent=this.t('removeItem');remove.setAttribute('aria-label',`${this.t('removeItem')} ${index+1}`);
      remove.onclick=()=>{this.draft.splice(index,1);this.dirty=true;this.renderDraft();};row.append(remove);
      return row;
    }));
    this.draftStatus();
  }
  render(telemetry:Telemetry|undefined,online:boolean,blocked:boolean,death?:SeatViewProjection['extinction.report']):void {
    this.telemetry=telemetry;this.writable=online&&!blocked&&!!telemetry&&!death?.extinct;
    this.find('extinction-report').hidden=!death?.extinct;
    this.find('extinction-cause').textContent=death?.extinct?`${this.t(death.cause==='ColdWar_SelfDestruct'?'extinctionColdWar':'extinctionCollapse')} · ${(death.t_extinct_sim_s/SIM_SECONDS_PER_YEAR).toFixed(2)} ${this.t('simulationYears')}`:'';
    this.find('build-message').textContent=this.messageKey?this.t(this.messageKey):'';
    this.controls.disabled=!this.writable;
    this.find<HTMLButtonElement>('build-enqueue').disabled=!this.writable||(telemetry?.build_queue.length??0)>=5;
    this.find<HTMLSelectElement>('build-dimension').disabled=!this.writable;
    this.find('construction-note').textContent=this.t(death?.extinct?'extinctionRecord':online?'constructionOnline':'constructionOffline');
    this.find('evo-points').textContent=telemetry?.evo_points_avail.toFixed(3)??'—';
    this.find('evo-rate').textContent=telemetry?.v_e_rate_per_real_h.toFixed(3)??'—';
    this.find('world-count').textContent=telemetry?`${telemetry.n_worlds} / 4`:'—';
    this.find('build-tier').textContent=telemetry?`TIER ${telemetry.k_tier}`:'—';
    this.find('growth-readout').textContent=telemetry?`${this.t('kValue')} ${telemetry.k_value.toFixed(4)} / ${this.t('kLimit')} ${telemetry.k_max_confirmed.toFixed(4)} · ${this.t(telemetry.stage)}`:'—';
    this.find('sdi-readout').textContent=`${this.t('stabilityIndex')} · ${telemetry?`${telemetry.sdi_total.toFixed(1)}%`:'—'}`;
    this.find('sdi-effect').textContent=telemetry?`${this.t('stabilityDamping')} ×${(death?.extinct?0:1-telemetry.sdi_total/100).toFixed(3)} · ${this.t('stabilityRaw')} ${telemetry.sdi_raw.toFixed(1)}%`:'—';
    this.find('sdi-note').textContent=this.t(telemetry?.sdi_mode==='dynamic'?'stabilityDynamic':'stabilityFixed');
    this.find('instability-note').textContent=this.t(telemetry?.instability.enabled?'instabilityEnabled':'instabilityDisabled');
    const instability=telemetry?.instability,event=instability?.last_event;
    this.find('instability-event').textContent=[event?`${this.t(event.kind==='local_crisis'?'instabilityCrisis':event.kind==='secession'?'instabilitySecession':'instabilityShield')} · ${(event.t_sim_s/SIM_SECONDS_PER_YEAR).toFixed(2)} ${this.t('simulationYears')}${event.k_lost===undefined?'':` · K −${event.k_lost.toFixed(3)}`}`:'',instability?.shield_available?this.t('shieldAvailable'):''].filter(Boolean).join(' · ');
    this.find('sdi-network').textContent=telemetry?.r_sync_ly!==null&&telemetry?.r_sync_ly!==undefined?`${this.t('stabilitySpan')} ${telemetry.active_sync_span_ly.toFixed(2)} / ${telemetry.r_sync_ly.toFixed(2)} ly · U ${telemetry.sdi_breakdown.lag_strain_u.toFixed(3)}`:'—';
    this.find('sdi-breakdown').replaceChildren(...(telemetry ? ([['involution','sdiDensity'],['concentration','sdiConcentration'],['colony','sdiColony'],['lag','sdiLag'],['tier_tech','sdiTech'],['fixed','sdiFixed']] as const).flatMap(([field,key])=>{
      const term=document.createElement('dt'),value=document.createElement('dd');
      term.textContent=this.t(key);const n=telemetry.sdi_breakdown[field];value.textContent=`${n>0?'+':''}${n.toFixed(1)} ${this.t('percentagePoints')}`;
      return [term,value];
    }):[]));
    this.find('tech-levels').textContent=telemetry ? (['obs','beacon','stealth','strike','persist'] as const).map(key=>`${this.t(dimensionKey(key))} ${telemetry.tech_levels_5[key]}`).join(' · ') : '—';
    const active=telemetry?.active_construction;
    this.find('active-work').textContent=active?`${this.t(dimensionKey(active.dimension))} · ${this.t('level')} ${active.target_level} · ${(active.rem_real_s/60).toFixed(1)} ${this.t('realMinutes')}`:this.t('idleWork');
    const language=this.t('construction');
    if(this.localeSignature!==language){this.localeSignature=language;this.options(this.find('build-dimension'));this.renderDraft();}
    const queue=telemetry?.build_queue??[];
    const signature=JSON.stringify([queue,language,this.writable]);
    if(signature!==this.queueSignature){
      this.queueSignature=signature;
      this.find('build-queue').replaceChildren(...queue.map((item,index)=>{
        const row=document.createElement('li'),label=document.createElement('span'),state=document.createElement('small'),button=document.createElement('button');
        label.textContent=this.t(dimensionKey(item.dimension));state.textContent=this.t(item.status);label.append(state);
        button.textContent=this.t('removeItem');button.disabled=!this.writable;button.setAttribute('aria-label',`${this.t('removeItem')} ${index+1} · ${this.t(dimensionKey(item.dimension))}`);
        button.onclick=()=>{if(this.writable)void this.submit({type:'allocate_evolution_point',dimension:item.dimension,queue_op:'remove_at',queue_index:index});};
        row.append(label,button);return row;
      }));
      if(!queue.length)this.find('build-queue').textContent=this.t('emptyQueue');
    }
    this.find('queue-count').textContent=`${queue.length} / 5`;
    const plan=telemetry?.allocation_plan;
    this.find('plan-state').textContent=this.t(!plan?.items.length?'planEmpty':plan.cursor_index===plan.items.length?'planCompleted':plan.enabled?'planEnabled':'planPaused');
    this.find('plan-progress').textContent=`${this.t('planProgress')} · ${plan?.cursor_index??0} / ${plan?.items.length??0}`;
    this.find('plan-toggle').textContent=this.t(plan?.enabled?'pausePlan':'resumePlan');
    this.find<HTMLButtonElement>('plan-toggle').disabled=!this.writable||!plan?.items.length||plan.cursor_index===plan.items.length;
    const planSignature=JSON.stringify([plan,language]);
    if(planSignature!==this.planSignature){
      this.planSignature=planSignature;
      this.find('current-plan').replaceChildren(...(plan?.items??[]).map((item,index)=>{
        const row=document.createElement('li');row.textContent=`${this.t(dimensionKey(item.dimension))}${item.target_level===undefined?'':` → ${item.target_level}`}${item.min_k===undefined?'':` · K ≥ ${item.min_k}`}`;
        if(index<(plan?.cursor_index??0))row.className='plan-done';else if(index===plan?.cursor_index)row.setAttribute('aria-current','step');return row;
      }));
      if(!this.dirty){this.draft=structuredClone(plan?.items??[]);this.renderDraft();}
    }
  }
}
