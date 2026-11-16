import type { Pool } from 'pg';
import { withTransaction } from './index.js';

export const DEVELOPMENT_IDS = {
  epoch_id: '00000000-0000-4000-8000-000000000001',
  seat_id: '00000000-0000-4000-8000-000000000002',
  account_id: '00000000-0000-4000-8000-000000000003',
  civ_gen: 1,
  sector_id: 'm1-reference',
} as const;

/** Explicit developer command. Existing worlds and checkpoints are never reset. */
export async function seedDevelopment(pool: Pool): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('Development seed is disabled in production');
  const ids = DEVELOPMENT_IDS;
  await withTransaction(pool, async (client) => {
    await client.query('INSERT INTO accounts (account_id) VALUES ($1) ON CONFLICT DO NOTHING', [ids.account_id]);
    await client.query('INSERT INTO epochs (epoch_id, galaxy_seed) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ids.epoch_id, 'm1-frontier-v1']);
    await client.query('INSERT INTO sectors (epoch_id, sector_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [ids.epoch_id, ids.sector_id]);
    await client.query(
      'INSERT INTO seats (epoch_id, seat_id, account_id, current_civ_gen) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [ids.epoch_id, ids.seat_id, ids.account_id, ids.civ_gen],
    );
    await client.query(
      'INSERT INTO civilization_generations (epoch_id, seat_id, civ_gen, sector_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [ids.epoch_id, ids.seat_id, ids.civ_gen, ids.sector_id],
    );
  });
}
