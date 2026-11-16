import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabasePool, migrate, seedDevelopment, withLockedSeat, withTransaction, type DatabasePool } from '../src/index.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const context = { epoch_id: randomUUID(), seat_id: randomUUID(), civ_gen: 1 };
let pool: DatabasePool;

describe.skipIf(!databaseUrl)('real PostgreSQL transaction integration', () => {
  beforeAll(async () => {
    pool = createDatabasePool(databaseUrl!);
    await migrate(pool);
    await withTransaction(pool, async (client) => {
      const account = randomUUID();
      await client.query('INSERT INTO accounts(account_id) VALUES ($1)', [account]);
      await client.query('INSERT INTO epochs(epoch_id, galaxy_seed) VALUES ($1, $2)', [context.epoch_id, 'locking-test']);
      await client.query('INSERT INTO sectors(epoch_id, sector_id) VALUES ($1, $2)', [context.epoch_id, 'test']);
      await client.query('INSERT INTO seats(epoch_id, seat_id, account_id) VALUES ($1, $2, $3)', [context.epoch_id, context.seat_id, account]);
      await client.query('INSERT INTO civilization_generations(epoch_id, seat_id, civ_gen, sector_id) VALUES ($1, $2, 1, $3)', [context.epoch_id, context.seat_id, 'test']);
    });
  });
  afterAll(async () => { await pool?.end(); });

  it('safely reruns migrations and non-destructive development seed', async () => {
    expect(await migrate(pool)).toEqual([]);
    await seedDevelopment(pool);
    await seedDevelopment(pool);
  });

  it('serializes two seat writers so neither snapshot update is lost', async () => {
    const update = () => withLockedSeat(pool, context, async (client, generation) => {
      const version = Number(generation.view_version) + 1;
      await client.query('UPDATE civilization_generations SET view_version = $4 WHERE epoch_id = $1 AND seat_id = $2 AND civ_gen = $3',
        [context.epoch_id, context.seat_id, context.civ_gen, version]);
      return version;
    });
    expect((await Promise.all([update(), update()])).sort()).toEqual([1, 2]);
  });
});
