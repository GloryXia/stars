import { z } from 'zod';
export const SCHEMA_VERSION = '0.7.0' as const;
export const KAPPA_T = 525_960;
export const SIM_SECONDS_PER_YEAR = 31_557_600;
const finite = z.number().finite();
const nonnegative = finite.nonnegative();
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const seatContextSchema = z.object({ epoch_id: z.string().uuid(), seat_id: z.string().uuid(), civ_gen: z.number().int().positive() }).strict();
export type SeatContext = z.infer<typeof seatContextSchema>;
export const capabilityScopeSchema = z.enum(['READ_SEAT_VIEW','CONTROL_SPHERE_STEALTH','CONFIGURE_REFLEX','ALLOW_AGENT_TECH_ALLOC','ALLOW_AGENT_STRIKE']);
export const HUMAN_SCOPES = capabilityScopeSchema.options;
export const actorPrincipalSchema = z.object({kind:z.enum(['human','l1_reflex','internal_ai','external_agent']),subject_id:z.string().min(1).max(200),granted_scopes:z.array(capabilityScopeSchema).max(5)}).strict();
export type ActorPrincipal = z.infer<typeof actorPrincipalSchema>;
export const evolutionDimensionSchema = z.enum(['obs','beacon','stealth','strike','persist','world_up','k_tier_up']);
export type EvolutionDimension = z.infer<typeof evolutionDimensionSchema>;
const techLevel = version.max(4);
export const techLevelsSchema = z.object({obs:techLevel,beacon:techLevel,stealth:techLevel,strike:techLevel,persist:techLevel}).strict();
export const buildQueueItemSchema = z.object({dimension:evolutionDimensionSchema,queued_at_sim_s:nonnegative,status:z.enum(['queued','waiting_points','waiting_prerequisite'])}).strict();
export const activeConstructionSchema = z.object({dimension:evolutionDimensionSchema,target_level:version.min(1).max(4),rem_sim_s:nonnegative,rem_real_s:nonnegative}).strict();
export const allocationPlanItemSchema = z.object({dimension:evolutionDimensionSchema,target_level:version.min(1).max(4).optional(),min_k:finite.min(0.56).max(2).optional()}).strict().superRefine((item,ctx)=>{
  if(item.target_level!==undefined && ((item.dimension==='world_up' && item.target_level<2) || (item.dimension==='k_tier_up' && (item.target_level<2 || item.target_level>3))))ctx.addIssue({code:'custom',message:'Invalid construction target level'});
});
export const allocationPlanConfigSchema = z.object({enabled:z.boolean(),template_id:z.string().min(1).max(100).optional(),items:z.array(allocationPlanItemSchema).max(20)}).strict();
export const allocationPlanSchema = allocationPlanConfigSchema.extend({cursor_index:version.max(20)}).superRefine((plan,ctx)=>{
  if(plan.cursor_index>plan.items.length)ctx.addIssue({code:'custom',message:'Cursor exceeds plan length'});
});
export type AllocationPlanConfig = z.infer<typeof allocationPlanConfigSchema>;
export const instabilityEventSchema=z.object({kind:z.enum(['local_crisis','secession','shield']),t_sim_s:nonnegative,k_lost:nonnegative.optional()}).strict();
export const extinctionReportSchema=z.discriminatedUnion('extinct',[
  z.object({extinct:z.literal(false),posthumous_callbacks:z.array(z.never())}).strict(),
  z.object({extinct:z.literal(true),cause:z.enum(['ColdWar_SelfDestruct','SDI_System_Collapse']),t_extinct_sim_s:nonnegative,posthumous_callbacks:z.array(z.never())}).strict(),
]);
export const evolutionTelemetryShape = {
  instability:z.object({enabled:z.boolean(),crisis_count:version,shield_available:z.boolean(),last_event:instabilityEventSchema.nullable()}).strict(),
  sdi_mode:z.enum(['fixed','dynamic']),sdi_sampled_sim_s:nonnegative.nullable(),
  sdi_total:nonnegative.max(100),sdi_raw:finite,r_sync_ly:nonnegative.nullable(),
  sdi_breakdown:z.object({involution:nonnegative,concentration:nonnegative,colony:nonnegative,lag:nonnegative,lag_strain_u:nonnegative,tier_tech:finite,pulse:finite,fixed:finite,heat_overload:nonnegative,overlap_arrived:nonnegative}).strict(),
  k_value:finite.min(0.56).max(2),k_max_confirmed:finite.min(0.56).max(2),n_eff_stars:finite.min(1),stage:z.enum(['single_planet','multi_planet','multi_star']),
  k_tier:version.min(1).max(3),n_worlds:version.min(1).max(4),tech_levels_5:techLevelsSchema,
  active_construction:activeConstructionSchema.nullable(),build_queue:z.array(buildQueueItemSchema).max(5),
  allocation_plan:allocationPlanSchema,
  evo_points_avail:nonnegative,evo_points_earned_total:nonnegative,
  v_e_rate_per_real_h:nonnegative,v_e_rate_per_sim_yr:nonnegative,
  pi_productivity:z.object({total:nonnegative,pi_exp:nonnegative,xi_stochastic_factor:nonnegative}).strict(),
};
// M1 currently resolves a disclosed catalog target; direction-only navigation is deferred.
export const seatActionSchema = z.discriminatedUnion('type',[
  z.object({type:z.literal('dispatch_expedition'),target_node_id:z.string().min(1).max(128),drive_mode:z.literal('standard_010c').optional()}).strict(),
  z.object({type:z.literal('set_node_coordination'),node_id:z.string().min(1).max(128),mode:z.enum(['detach_outer_node','sync'])}).strict(),
  z.object({type:z.literal('allocate_evolution_point'),dimension:evolutionDimensionSchema,queue_op:z.enum(['enqueue','remove_at']).optional(),queue_index:version.max(4).optional()}).strict(),
  allocationPlanConfigSchema.extend({type:z.literal('configure_allocation_plan')})
]);
export const seatCommandSchema = seatContextSchema.extend({command_id:z.string().uuid().refine(v=>v[14]==='7','UUIDv7 required'),base_view_version:version,principal:actorPrincipalSchema,action:seatActionSchema}).strict().superRefine(({action},ctx)=>{
  if(action.type==='allocate_evolution_point' && ((action.queue_op==='remove_at') !== (action.queue_index!==undefined)))ctx.addIssue({code:'custom',path:['action','queue_index'],message:'queue_index is required only for remove_at'});
});
export type SeatCommandEnvelope = z.infer<typeof seatCommandSchema>;
export const commandResultSchema = z.object({command_id:z.string().uuid(),accepted:z.literal(true),exp_id:z.string().optional(),view_version:version}).strict();
export type CommandResult = z.infer<typeof commandResultSchema>;
export const nodeReportSchema = z.object({node_id:z.string(),last_confirmed_status:z.enum(['confirmed','detached_autonomous','lost','destroyed','seceded']),t_source_sim_s:nonnegative,t_arrive_sim_s:nonnegative}).strict();
export const linkReportSchema = z.object({from_node_id:z.string(),to_node_id:z.string(),available:z.boolean(),t_source_sim_s:nonnegative,t_arrive_sim_s:nonnegative,valid_until_sim_s:nonnegative}).strict();
export const frontierRequestSchema = z.object({request_id:z.string(),intent:z.enum(['join','leave']),t_created_sim_s:nonnegative,t_sent_sim_s:nonnegative.optional(),status:z.enum(['pending','confirmed','timeout']),target_node_id:z.string().optional()}).strict();
const vec3 = z.tuple([finite,finite,finite]);
export const expeditionSchema = z.object({exp_id:z.string(),target_node_id:z.string(),t_launch_sim_s:nonnegative,eta_sim_s:nonnegative,origin_local_pos_vec3:vec3,target_local_pos_vec3:vec3,speed_c:z.literal(0.1),status:z.enum(['in_flight','awaiting_receipt','confirmed','timeout'])}).strict();
const observationBase = {event_id:z.string(),t_arrive_sim_s:nonnegative,band:z.enum(['ir','radio','nir_laser','neutrino','gw','xray_shock']),messenger_class:z.enum(['em','neutrino','gw']),snr_current:finite.min(1),dissipation_margin_ratio:finite.min(1),coarse_dir_vec3:vec3,dir_sigma_rad:nonnegative};
// Strict variants keep neutrino and non-triangulated GW in the weak category even at high SNR.
export const observationSchema = z.discriminatedUnion('kind',[
  z.object({...observationBase,kind:z.literal('weak')}).strict(),
  z.object({...observationBase,kind:z.literal('bearing'),messenger_class:z.literal('em'),snr_current:finite.min(5),local_dir_vec3:vec3}).strict(),
  z.object({...observationBase,kind:z.literal('ranged'),messenger_class:z.enum(['em','gw']),snr_current:finite.min(5),local_dir_vec3:vec3,ranging_evidence:z.enum(['catalog_match','parallax','two_way_echo','gw_triangulation']),local_pos_vec3:vec3,target_node_id:z.string(),t_source_sim_s:nonnegative,pos_sigma_ly:nonnegative,local_velocity_vec3:vec3,vel_sigma_mps:nonnegative,progenitor_unstable:z.boolean()}).strict()
]).superRefine((v,ctx)=>{
  const channel = v.band==='neutrino'?'neutrino':v.band==='gw'?'gw':'em';
  if(v.messenger_class!==channel)ctx.addIssue({code:'custom',message:'Band and messenger class must match'});
  if(v.kind==='weak' && v.messenger_class==='em' && v.snr_current>=5)ctx.addIssue({code:'custom',message:'EM at SNR >=5 uses bearing or ranged schema'});
  if(v.kind==='ranged' && ((v.messenger_class==='gw')!==(v.ranging_evidence==='gw_triangulation')))ctx.addIssue({code:'custom',message:'GW requires triangulation evidence'});
});
// A versioned M1 subset, not a claim that the complete M3 telemetry is implemented.
export const seatViewSchema = seatContextSchema.extend({
  schema_version:z.literal(SCHEMA_VERSION),view_version:version,t_sim_s:nonnegative,
  'self.telemetry':z.object({...evolutionTelemetryShape,cradle_span_ly:nonnegative,active_sync_span_ly:nonnegative,expeditions_in_flight_count:version,controlled_node_count:version,detached_autonomous_node_count:version,known_reachable_node_count:version,r_persist:nonnegative}).strict(),
  'self.network':z.object({nodes:z.array(nodeReportSchema),links:z.array(linkReportSchema),active_expeditions:z.array(expeditionSchema),pending_frontier_requests:z.array(frontierRequestSchema)}).strict(),
  'lightcone.wavefronts':z.array(observationSchema),
  'sentinel.reflex_rules':z.object({max_slots:z.literal(3),trigger_mode:z.enum(['offline_only','always_armed']),grace_period_real_s:nonnegative,armed_now:z.boolean(),active_rules:z.array(z.never())}).strict(),
  'extinction.report':extinctionReportSchema
}).strict();
export type SeatViewProjection = z.infer<typeof seatViewSchema>;
export const publicCatalogSchema = z.array(z.object({catalog_id:z.string(),label:z.string(),local_pos_vec3:vec3,spectral_type:z.enum(['O','B','A','F','G','K','M'])}).strict());
export type PublicCatalog = z.infer<typeof publicCatalogSchema>;
export const timelineSchema = z.object({schema_version:z.literal(SCHEMA_VERSION),epoch_id:z.string().uuid(),seat_id:z.string().uuid(),civ_gen:z.number().int().positive(),kappa_t:z.literal(KAPPA_T),initial_snapshot:seatViewSchema,frames:z.array(z.object({t_sim_s:nonnegative,view_version:version,snapshot:seatViewSchema}).strict())}).strict();
export type SeatTimeline = z.infer<typeof timelineSchema>;
export const DEV_CONTEXT: SeatContext = {epoch_id:'00000000-0000-4000-8000-000000000001',seat_id:'00000000-0000-4000-8000-000000000002',civ_gen:1};
