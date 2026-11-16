import { describe, expect, it } from 'vitest';
import { observationSchema, seatCommandSchema, DEV_CONTEXT, HUMAN_SCOPES } from './index.js';
describe('public contract boundary', () => {
  it('rejects hidden coordinates and target identifiers on 2D signals', () => {
    const bearing = {kind:'bearing',event_id:'signal',t_arrive_sim_s:0,band:'radio',messenger_class:'em',dissipation_margin_ratio:2,snr_current:5,coarse_dir_vec3:[1,0,0],dir_sigma_rad:0.1,local_dir_vec3:[1,0,0]};
    expect(observationSchema.safeParse(bearing).success).toBe(true);
    expect(observationSchema.safeParse({...bearing,local_pos_vec3:[4,0,0]}).success).toBe(false);
    expect(observationSchema.safeParse({...bearing,target_node_id:'secret'}).success).toBe(false);
  });
  it('rejects empty targets, unsupported actions and non-v7 idempotency keys', () => {
    const command = {...DEV_CONTEXT,command_id:'019a8700-0000-7000-8000-000000000001',base_view_version:0,principal:{kind:'human',subject_id:'dev',granted_scopes:HUMAN_SCOPES},action:{type:'dispatch_expedition',target_node_id:'B'}};
    expect(seatCommandSchema.safeParse(command).success).toBe(true);
    expect(seatCommandSchema.safeParse({...command,action:{type:'dispatch_expedition',target_node_id:''}}).success).toBe(false);
    expect(seatCommandSchema.safeParse({...command,command_id:DEV_CONTEXT.seat_id}).success).toBe(false);
    expect(seatCommandSchema.safeParse({...command,action:{type:'migrate_seed'}}).success).toBe(false);
  });
});
