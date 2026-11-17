import { mkdir,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { SCHEMA_VERSION,KAPPA_T,timelineSchema,type SeatCommandEnvelope } from '@stars/contracts';
import { createCivilization,projectSeat,acceptCommand,advanceToRealSeconds,fixtureCommand } from '@stars/sim-core';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const output=resolve(root,'artifacts/growth');await mkdir(output,{recursive:true});
for(const route of [{file:'cold-start',launchYear:800,persist:2},{file:'cold-start-risky',launchYear:400,persist:1}]) {
  const state=createCivilization({seed:'cold-start-reference-v1'});
  const initial_snapshot=projectSeat(state);
  function submit(id:number,action:SeatCommandEnvelope['action']) {
    acceptCommand(state,{...fixtureCommand(),command_id:`019a8700-0000-7000-8000-${id.toString().padStart(12,'0')}`,base_view_version:state.view_version,action});
  }
  submit(1,{type:'configure_allocation_plan',enabled:true,items:[{dimension:'world_up',target_level:2},{dimension:'persist',target_level:route.persist}]});
  const years=[0,30,200,route.launchYear-1,route.launchYear,route.launchYear+40,route.launchYear+43.999,route.launchYear+44,route.launchYear+200,1500,2000];
  const frames=years.map(year=>{
    advanceToRealSeconds(state,year*60);
    if(year===route.launchYear && !state.extinction.extinct){
      submit(2,{type:'dispatch_expedition',target_node_id:'B'});
      submit(3,{type:'configure_allocation_plan',enabled:true,items:[{dimension:'persist',target_level:2},{dimension:'k_tier_up',target_level:2},{dimension:'persist',target_level:3},{dimension:'obs',target_level:3}]});
    }
    const snapshot=projectSeat(state);
    return {t_sim_s:snapshot.t_sim_s,view_version:snapshot.view_version,snapshot};
  });
  const timeline=timelineSchema.parse({schema_version:SCHEMA_VERSION,...state.context,kappa_t:KAPPA_T,initial_snapshot,frames});
  await writeFile(resolve(output,route.file+'.json'),JSON.stringify(timeline,null,2)+'\n');
  console.log(route.file);
  console.table(frames.map(frame=>{
    const t=frame.snapshot['self.telemetry'],death=frame.snapshot['extinction.report'];
    return {sim_year:frame.t_sim_s/31_557_600,K:t.k_value.toFixed(4),tier:t.k_tier,worlds:t.n_worlds,stars:t.controlled_node_count,SDI:t.sdi_total.toFixed(1)+'%',points:t.evo_points_avail.toFixed(3),crises:t.instability.crisis_count,status:death.extinct?death.cause:'alive'};
  }));
  console.log(`Exported seat-only timeline to ${output}/${route.file}.json`);
}
