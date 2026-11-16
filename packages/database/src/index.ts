import pg, { type Pool, type PoolClient } from 'pg';

export type DatabasePool = Pool;

export interface SeatContext {
  epoch_id: string;
  seat_id: string;
  civ_gen: number;
}

export interface StoredGeneration extends SeatContext {
  account_id: string;
  current_civ_gen: number;
  sector_id: string;
  status: 'active' | 'extinct';
  // pg deliberately keeps PostgreSQL bigint as string; callers must check range.
  view_version: string;
  state_snapshot: Record<string, unknown>;
}

export function createDatabasePool(connectionString: string): Pool {
  return new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000 });
}

export async function withTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export class SeatNotFoundError extends Error {
  constructor() { super('SEAT_NOT_FOUND'); }
}

/** Mutations, command receipts, and projections must commit in this same callback. */
export function withLockedSeat<T>(
  pool: Pool,
  context: SeatContext,
  operation: (client: PoolClient, generation: StoredGeneration) => Promise<T>,
): Promise<T> {
  return withTransaction(pool, async (client) => {
    const result = await client.query<StoredGeneration>(
      `SELECT g.*, s.account_id, s.current_civ_gen
       FROM civilization_generations g
       JOIN seats s USING (epoch_id, seat_id)
       WHERE g.epoch_id = $1 AND g.seat_id = $2 AND g.civ_gen = $3
       FOR UPDATE OF s, g`,
      [context.epoch_id, context.seat_id, context.civ_gen],
    );
    const generation = result.rows[0];
    if (!generation) throw new SeatNotFoundError();
    return operation(client, generation);
  });
}

export { migrate } from './migrate.js';
export { seedDevelopment, DEVELOPMENT_IDS } from './seed.js';
