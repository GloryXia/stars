import { randomUUID } from 'node:crypto';
import { afterAll,beforeAll,describe,expect,it } from 'vitest';
import { createDatabasePool,migrate,seedDevelopment,type DatabasePool } from '@stars/database';
import { DEV_CONTEXT } from '@stars/contracts';
import { createApp,DEV_PRINCIPAL,canonical } from './app.js';
import { PostgresSeatRepository } from './repository.js';
const databaseUrl=process.env.TEST_DATABASE_URL;
const schema='gateway_test_'+randomUUID().replaceAll('-','');
let admin:DatabasePool;let pool:DatabasePool;
describe.skipIf(!databaseUrl)('PostgreSQL HTTP command integration',()=>{
  beforeAll(async()=>{
    admin=createDatabasePool(databaseUrl!);await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped=new URL(databaseUrl!);scoped.searchParams.set('options',`-c search_path=${schema}`);
    pool=createDatabasePool(scoped.toString());await migrate(pool);await seedDevelopment(pool);
  });
  afterAll(async()=>{await pool?.end();if(admin){await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}});
  it('commits one command under concurrent requests and restores its receipt and causal snapshot after restart',async()=>{
    let time=0;const repository=new PostgresSeatRepository(pool);
    const token='database-test-only-fixture-token-12345';const headers={authorization:'Bearer '+token};
    const command={...DEV_CONTEXT,command_id:'019a8700-0000-7000-8000-000000000001',base_view_version:0,principal:DEV_PRINCIPAL,action:{type:'dispatch_expedition',target_node_id:'B'}};
    const {app}=createApp({newSeatMode:'m1_fixture',repository,devToken:token,now:()=>time});
    const results=await Promise.all(Array.from({length:5},()=>app.inject({method:'POST',url:'/api/commands',headers,payload:command})));
    expect(results.map(r=>r.statusCode)).toEqual([200,200,200,200,200]);expect(new Set(results.map(r=>canonical(r.json()))).size).toBe(1);
    expect((await pool.query('SELECT count(*) FROM command_receipts')).rows[0].count).toBe('1');
    time=2639_000;const before=await app.inject({url:'/api/dev/bootstrap',headers});expect(before.json().view['self.telemetry'].controlled_node_count).toBe(1);
    await app.close();
    const restarted=createApp({newSeatMode:'m1_fixture',repository,devToken:token,now:()=>2640_000});
    const after=await restarted.app.inject({url:'/api/dev/bootstrap',headers});expect(after.json().view['self.telemetry'].controlled_node_count).toBe(2);
    const retry=await restarted.app.inject({method:'POST',url:'/api/commands',headers,payload:command});expect(retry.json()).toEqual(results[0]!.json());
    await restarted.app.close();
  });
});
