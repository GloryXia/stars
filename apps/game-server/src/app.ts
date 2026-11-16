import Fastify from 'fastify';
import { SeatNotFoundError } from '@stars/database';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DEV_CONTEXT, HUMAN_SCOPES, seatCommandSchema, seatViewSchema } from '@stars/contracts';
import { acceptCommand, advanceToRealSeconds, createSimulation, projectSeat, PUBLIC_CATALOG, restoreSimulation, SimError } from '@stars/sim-core';
import { RepositoryError, type SeatRepository, type SeatTransaction, type StoredState } from './repository.js';
export interface AppOptions {repository:SeatRepository; devToken:string; now?:()=>number; logger?:boolean}
export const DEV_ACCOUNT_ID='00000000-0000-4000-8000-000000000003';
export const DEV_PRINCIPAL={kind:'human' as const,subject_id:DEV_ACCOUNT_ID,granted_scopes:[...HUMAN_SCOPES]};
// Stable serialization makes object-key order irrelevant to idempotency.
export function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null && typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value);
}
function authorized(actual:string|undefined,expected:string):boolean {
  const a=createHash('sha256').update(actual??'').digest(); const b=createHash('sha256').update('Bearer '+expected).digest();
  return timingSafeEqual(a,b);
}
export function createApp(options:AppOptions){
  const app=Fastify({logger:options.logger??false,bodyLimit:16_384});
  const now=options.now??Date.now;
  const load=(tx:SeatTransaction)=>{
    const saved=tx.snapshot as Partial<StoredState>;
    if(saved.simulation===undefined){
      if(Object.keys(saved).length)throw new Error('Unsupported persisted snapshot');
      return {state:createSimulation({context:DEV_CONTEXT}),anchor_real_ms:now()};
    }
    if(!Number.isFinite(saved.anchor_real_ms))throw new Error('Invalid snapshot clock');
    const state=restoreSimulation(saved.simulation);
    advanceToRealSeconds(state,Math.max(state.t_real_s,(now()-saved.anchor_real_ms!)/1000));
    return {state,anchor_real_ms:saved.anchor_real_ms!};
  };
  app.setErrorHandler((error,_req,reply)=>{
    if(error instanceof SimError || error instanceof RepositoryError)return reply.code(error.statusCode).send({error:{code:error.code}});
    if(error instanceof SeatNotFoundError)return reply.code(404).send({error:{code:'SEAT_NOT_FOUND'}});
    const status=error instanceof Error && 'statusCode' in error ? Number(error.statusCode):500;
    if(status>=400 && status<500)return reply.code(status).send({error:{code:'INVALID_REQUEST'}});
    app.log.error(error); return reply.code(500).send({error:{code:'INTERNAL_ERROR'}});
  });
  app.get('/health/live',async()=>({status:'ok',mode:'development-fixture'}));
  app.get('/health/ready',async(_req,reply)=>{try{await options.repository.ready();return {status:'ready'};}catch{return reply.code(503).send({status:'unavailable'});}});
  app.addHook('onRequest',async(req,reply)=>{
    if(!req.url.startsWith('/api/'))return;
    if(!authorized(req.headers.authorization,options.devToken))return reply.code(401).send({error:{code:'UNAUTHENTICATED'}});
    reply.header('Cache-Control','no-store');
  });
  const view=()=>options.repository.transaction(DEV_CONTEXT,DEV_ACCOUNT_ID,async tx=>{
    const runtime=load(tx);const projection=seatViewSchema.parse(projectSeat(runtime.state));
    await tx.save({simulation:runtime.state,anchor_real_ms:runtime.anchor_real_ms},projection);return projection;
  });
  app.get('/api/dev/bootstrap',async()=>({context:DEV_CONTEXT,principal:DEV_PRINCIPAL,catalog:PUBLIC_CATALOG,view:await view(),mode:'development-fixture'}));
  app.get<{Params:{seatId:string}}>('/api/seats/:seatId/view',async(req,reply)=>{
    if(req.params.seatId!==DEV_CONTEXT.seat_id)return reply.code(404).send({error:{code:'SEAT_NOT_FOUND'}});
    return view();
  });
  app.post('/api/commands',async(req,reply)=>{
    const parsed=seatCommandSchema.safeParse(req.body);
    if(!parsed.success)return reply.code(400).send({error:{code:'INVALID_COMMAND'}});
    const command=parsed.data;
    if(command.principal.kind==='external_agent')return reply.code(501).send({error:{code:'AGENT_EXTENSION_DISABLED'}});
    if(canonical(command.principal)!==canonical(DEV_PRINCIPAL))return reply.code(403).send({error:{code:'PRINCIPAL_MISMATCH'}});
    if(command.epoch_id!==DEV_CONTEXT.epoch_id || command.seat_id!==DEV_CONTEXT.seat_id || command.civ_gen!==DEV_CONTEXT.civ_gen)return reply.code(404).send({error:{code:'SEAT_NOT_FOUND'}});
    const payload_hash=createHash('sha256').update(canonical(command)).digest('hex');
    const receipt=await options.repository.transaction(command,DEV_ACCOUNT_ID,async tx=>{
      const existing=await tx.receipt(command.principal.kind,command.command_id);
      if(existing){if(existing.payload_hash!==payload_hash)throw new RepositoryError('IDEMPOTENCY_CONFLICT',409);return existing;}
      const runtime=load(tx);
      let result:Record<string,unknown>; let http_status=200;
      try{result={...acceptCommand(runtime.state,command)};}catch(error){
        if(!(error instanceof SimError))throw error;
        http_status=error.statusCode;result={error:{code:error.code}};
      }
      const projection=seatViewSchema.parse(projectSeat(runtime.state));
      await tx.save({simulation:runtime.state,anchor_real_ms:runtime.anchor_real_ms},projection);
      const r={payload_hash,http_status,result}; await tx.record(command.principal.kind,command.command_id,r);return r;
    });
    return reply.code(receipt.http_status).send(receipt.result);
  });
  // Single-fixture worker advances persisted state even without an attached browser.
  return {app,tick:view};
}
