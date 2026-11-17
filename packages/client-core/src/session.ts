import {
  actorPrincipalSchema, commandResultSchema, publicCatalogSchema, seatContextSchema,
  seatViewSchema, seatCommandSchema, type ActorPrincipal, type PublicCatalog,
  type SeatCommandEnvelope, type SeatContext, type SeatViewProjection,
} from '@stars/contracts';

export interface TransportRequest {token:string; method:'GET'|'POST'; body?:string}
export interface ClientTransport {request(path:string, request:TransportRequest):Promise<unknown>}
export class RequestError extends Error {
  constructor(message:string, readonly httpStatus:number){super(message);}
}
export interface SessionState {
  readonly status:'disconnected'|'connecting'|'connected';
  readonly view:SeatViewProjection|undefined;
  readonly catalog:PublicCatalog;
  readonly busy:boolean;
  readonly pending:boolean;
  readonly error:string;
}
interface Connection {token:string; context:SeatContext; principal:ActorPrincipal}
const emptyState=():SessionState=>({status:'disconnected',view:undefined,catalog:[],busy:false,pending:false,error:''});
const sameSeat=(a:SeatContext,b:SeatContext)=>a.epoch_id===b.epoch_id&&a.seat_id===b.seat_id&&a.civ_gen===b.civ_gen;
const message=(error:unknown)=>error instanceof Error?error.message:String(error);

/** Renderer-independent session. Hosts supply networking and UUIDv7 generation.
 * Tokens and unresolved command bodies stay private and in memory.
 */
export class GameSession {
  private current=emptyState();
  private connection:Connection|undefined;
  private revision=0;
  private pendingCommand:{body:string; id:string}|undefined;
  private errorSource:'view'|'command'|undefined;
  private polling:{connection:Connection; task:Promise<void>}|undefined;
  private listeners=new Set<()=>void>();
  constructor(private transport:ClientTransport, private commandId:()=>string){}
  get state():SessionState{return this.current;}
  subscribe(listener:()=>void):()=>void{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  private patch(patch:Partial<SessionState>):void{
    this.current={...this.current,...patch};
    for(const listener of this.listeners)listener();
  }
  async connect(token:string):Promise<boolean>{
    // Changing sessions must not silently discard an order whose outcome is unknown.
    if(this.current.busy||this.pendingCommand)return false;
    const revision=++this.revision;
    this.connection=undefined;this.errorSource=undefined;
    this.patch({...emptyState(),status:'connecting'});
    try{
      const raw=await this.transport.request('/api/dev/bootstrap',{token,method:'GET'}) as Record<string,unknown>;
      const context=seatContextSchema.parse(raw.context),principal=actorPrincipalSchema.parse(raw.principal);
      const view=seatViewSchema.parse(raw.view),catalog=publicCatalogSchema.parse(raw.catalog);
      if(!sameSeat(context,view))throw new Error('SEAT_CONTEXT_MISMATCH');
      if(revision!==this.revision)return false;
      this.connection={token,context,principal};
      this.patch({status:'connected',view,catalog});return true;
    }catch(error){
      if(revision===this.revision)this.patch({...emptyState(),error:message(error)});
      return false;
    }
  }
  disconnect():boolean{
    if(this.current.busy||this.pendingCommand)return false;
    ++this.revision;this.connection=undefined;this.patch(emptyState());return true;
  }
  async refresh():Promise<void>{
    const connection=this.connection;if(!connection)return;
    if(this.polling?.connection===connection)return this.polling.task;
    const task=this.readView(connection);
    this.polling={connection,task};
    try{await task;}finally{if(this.polling?.task===task)this.polling=undefined;}
  }
  private async readView(connection:Connection):Promise<void>{
    try{
      const view=seatViewSchema.parse(await this.transport.request(`/api/seats/${connection.context.seat_id}/view`,{token:connection.token,method:'GET'}));
      if(this.connection!==connection)return;
      if(!sameSeat(view,connection.context))throw new Error('SEAT_CONTEXT_MISMATCH');
      const old=this.current.view;
      if(!old||view.view_version>=old.view_version&&view.t_sim_s>=old.t_sim_s)this.patch({view});
      if(this.errorSource==='view'){this.errorSource=undefined;this.patch({error:''});}
    }catch(error){if(this.connection===connection){this.errorSource='view';this.patch({error:message(error)});}}
  }
  async send(action?:SeatCommandEnvelope['action']):Promise<boolean>{
    const connection=this.connection,view=this.current.view;
    if(!connection||!view||this.current.busy||action&&this.pendingCommand)return false;
    if(action&&view['extinction.report'].extinct)return false;
    if(!this.pendingCommand){
      if(!action)return false;
      const command=seatCommandSchema.parse({...connection.context,principal:connection.principal,command_id:this.commandId(),base_view_version:view.view_version,action});
      this.pendingCommand={id:command.command_id,body:JSON.stringify(command)};
    }
    const pending=this.pendingCommand;
    this.errorSource=undefined;
    this.patch({busy:true,pending:true,error:''});
    try{
      const result=commandResultSchema.parse(await this.transport.request('/api/commands',{token:connection.token,method:'POST',body:pending.body}));
      if(result.command_id!==pending.id)throw new Error('COMMAND_RECEIPT_MISMATCH');
      this.pendingCommand=undefined;this.patch({pending:false});
      // Finish any older poll, then explicitly read the post-command projection.
      if(this.polling?.connection===connection)await this.polling.task;
      await this.refresh();return true;
    }catch(error){
      if(error instanceof RequestError&&error.httpStatus>=400&&error.httpStatus<500){
        this.pendingCommand=undefined;this.patch({pending:false});
        await this.refresh();
      }
      this.errorSource='command';this.patch({error:message(error)});return false;
    }finally{this.patch({busy:false});}
  }
}
