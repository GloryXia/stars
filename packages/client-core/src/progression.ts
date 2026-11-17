import type {SeatViewProjection} from '@stars/contracts';

export type ProgressStage='unavailable'|'build_world'|'research_persistence'|'ready'|'in_flight'|'awaiting_receipt'|'unconfirmed'|'develop_network'|'extinct';
/** Derived only from received seat evidence. No local clock, graphics or hidden simulation state. */
export function progression(view:SeatViewProjection|undefined):{stage:ProgressStage; canDispatch:boolean}{
  if(!view)return {stage:'unavailable',canDispatch:false};
  if(view['extinction.report'].extinct)return {stage:'extinct',canDispatch:false};
  const telemetry=view['self.telemetry'],network=view['self.network'];
  const join=network.pending_frontier_requests.find(request=>request.intent==='join');
  if(join){
    if(join.status==='confirmed')return {stage:'develop_network',canDispatch:false};
    if(join.status==='timeout')return {stage:'unconfirmed',canDispatch:false};
    return {stage:network.active_expeditions.some(exp=>exp.status==='in_flight')?'in_flight':'awaiting_receipt',canDispatch:false};
  }
  // Tier 2 legacy protocol fixtures are already unlocked by the server.
  if(telemetry.k_tier<2){
    if(telemetry.n_worlds<2)return {stage:'build_world',canDispatch:false};
    if(telemetry.tech_levels_5.persist<1)return {stage:'research_persistence',canDispatch:false};
  }
  return {stage:'ready',canDispatch:true};
}

export function coordinationControls(view:SeatViewProjection|undefined,nodeId:string|undefined):{canDetach:boolean;canSync:boolean}{
  if(!view||view['extinction.report'].extinct||!nodeId||nodeId==='A')return {canDetach:false,canSync:false};
  const network=view['self.network'];
  const status=network.nodes.find(node=>node.node_id===nodeId)?.last_confirmed_status;
  const pending=network.pending_frontier_requests.some(request=>request.target_node_id===nodeId&&request.status==='pending');
  return {canDetach:status==='confirmed',canSync:status==='detached_autonomous'&&!pending};
}
