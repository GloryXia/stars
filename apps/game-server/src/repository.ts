import type { SeatContext, SeatViewProjection } from '@stars/contracts';
import { withLockedSeat, type DatabasePool } from '@stars/database';
export interface Receipt {payload_hash:string;http_status:number;result:Record<string,unknown>}
export interface StoredState {simulation:unknown; anchor_real_ms:number}
export interface SeatTransaction {
  snapshot: unknown;
  receipt(kind:string,id:string): Promise<Receipt | undefined>;
  save(state:StoredState,view:SeatViewProjection): Promise<void>;
  record(kind:string,id:string,receipt:Receipt): Promise<void>;
}
export interface SeatRepository {
  ready():Promise<void>;
  transaction<T>(context:SeatContext,accountId:string,fn:(tx:SeatTransaction)=>Promise<T>):Promise<T>;
}
export class RepositoryError extends Error {constructor(public code:string,public statusCode:number){super(code);}}
export class PostgresSeatRepository implements SeatRepository {
  constructor(private pool:DatabasePool) {}
  async ready(){await this.pool.query('SELECT 1 FROM schema_migrations LIMIT 1');}
  async transaction<T>(context:SeatContext, accountId:string,fn:(tx:SeatTransaction)=>Promise<T>):Promise<T>{
    return withLockedSeat(this.pool,context,async(client,generation)=>{
      const scope=[context.epoch_id,context.seat_id,context.civ_gen];
      const owner=await client.query('SELECT 1 FROM seats WHERE epoch_id=$1 AND seat_id=$2 AND current_civ_gen=$3 AND account_id=$4',[...scope,accountId]);
      if(!owner.rowCount) throw new RepositoryError('SEAT_NOT_FOUND',404);
      if(generation.status!=='active') throw new RepositoryError('CIVILIZATION_EXTINCT',409);
      return fn({
        snapshot:generation.state_snapshot,
        async receipt(kind,id){const r=await client.query<Receipt>('SELECT payload_hash,http_status,result FROM command_receipts WHERE epoch_id=$1 AND seat_id=$2 AND civ_gen=$3 AND principal_kind=$4 AND command_id=$5',[...scope,kind,id]);return r.rows[0];},
        async save(state,view){
          await client.query('UPDATE civilization_generations SET state_snapshot=$4,view_version=$5,updated_at=now() WHERE epoch_id=$1 AND seat_id=$2 AND civ_gen=$3',[...scope,JSON.stringify(state),view.view_version]);
          await client.query(`INSERT INTO seat_knowledge_snapshots(epoch_id,seat_id,civ_gen,view_version,observed_sim_ms,projection) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(epoch_id,seat_id,civ_gen) DO UPDATE SET view_version=EXCLUDED.view_version,observed_sim_ms=EXCLUDED.observed_sim_ms,projection=EXCLUDED.projection,updated_at=now()`,[...scope,view.view_version,Math.ceil(view.t_sim_s*1000),JSON.stringify(view)]);
        },
        async record(kind,id,r){await client.query('INSERT INTO command_receipts(epoch_id,seat_id,civ_gen,principal_kind,command_id,payload_hash,http_status,result) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[...scope,kind,id,r.payload_hash,r.http_status,JSON.stringify(r.result)]);}
      });
    });
  }
}
