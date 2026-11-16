import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const epoch = '00000000-0000-4000-8000-000000000001';
const seat = '00000000-0000-4000-8000-000000000002';
const account = '00000000-0000-4000-8000-000000000003';
const command = '00000000-0000-7000-8000-000000000004';
let db: PGlite;

describe('PostgreSQL foundation schema', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(await readFile(new URL('../migrations/0001_foundation.sql', import.meta.url), 'utf8'));
    await db.transaction(async (tx) => {
      await tx.query('INSERT INTO accounts(account_id) VALUES ($1)', [account]);
      await tx.query('INSERT INTO epochs(epoch_id, galaxy_seed) VALUES ($1, $2)', [epoch, 'fixture']);
      await tx.query('INSERT INTO sectors(epoch_id, sector_id) VALUES ($1, $2)', [epoch, 'reference']);
      await tx.query('INSERT INTO seats(epoch_id, seat_id, account_id) VALUES ($1, $2, $3)', [epoch, seat, account]);
      await tx.query('INSERT INTO civilization_generations(epoch_id, seat_id, civ_gen, sector_id) VALUES ($1, $2, 1, $3)', [epoch, seat, 'reference']);
    });
  }, 30_000);
  afterAll(async () => { await db?.close(); });

  it('locks the one global clock ratio', async () => {
    await expect(db.query('UPDATE epochs SET kappa_t = 1 WHERE epoch_id = $1', [epoch])).rejects.toThrow();
  });

  it('rejects a projection referring to a different civilization generation', async () => {
    await expect(db.query(
      'INSERT INTO seat_knowledge_snapshots VALUES ($1, $2, 2, 0, 0, $3, now())',
      [epoch, seat, '{}'],
    )).rejects.toThrow();
  });

  it('enforces idempotency for the complete seat/principal context', async () => {
    const sql = `INSERT INTO command_receipts
      (epoch_id, seat_id, civ_gen, principal_kind, command_id, payload_hash, http_status, result)
      VALUES ($1, $2, 1, $3, $4, $5, 200, $6)`;
    const args = [epoch, seat, 'human', command, 'a'.repeat(64), '{"accepted":true}'];
    await db.query(sql, args);
    await expect(db.query(sql, args)).rejects.toThrow();
    await db.query(sql, [epoch, seat, 'l1_reflex', command, 'a'.repeat(64), '{"accepted":true}']);
  });

  it('rolls a snapshot update back if command persistence fails', async () => {
    await expect(db.transaction(async (tx) => {
      await tx.query('UPDATE civilization_generations SET view_version = 4 WHERE epoch_id = $1 AND seat_id = $2 AND civ_gen = 1', [epoch, seat]);
      await tx.query(`INSERT INTO command_receipts
        (epoch_id, seat_id, civ_gen, principal_kind, command_id, payload_hash, http_status, result)
        VALUES ($1, $2, 1, 'human', $3, $4, 200, '{}')`, [epoch, seat, command, 'a'.repeat(64)]);
    })).rejects.toThrow();
    const result = await db.query<{ view_version: number }>('SELECT view_version FROM civilization_generations WHERE epoch_id = $1 AND seat_id = $2', [epoch, seat]);
    expect(Number(result.rows[0]?.view_version)).toBe(0);
  });

  it('preserves historical generations, pending wavefronts, and permanent sparse remnants', async () => {
    await db.query(`INSERT INTO sparse_nodes(epoch_id, catalog_node_id, sector_id, owner_seat_id, owner_civ_gen, state, sampled_sim_ms)
      VALUES ($1, 'star:4', 'reference', $2, 1, '{"kind":"ruin"}', 0)`, [epoch, seat]);
    await db.query(`INSERT INTO pending_events(epoch_id, event_id, sector_id, due_sim_ms, phase_rank, stable_seq, emitted_sim_ms, payload)
      VALUES ($1, $2, 'reference', 100, 0, 1, 0, '{"kind":"wavefront"}')`, [epoch, command]);
    await db.query("UPDATE civilization_generations SET status = 'extinct' WHERE epoch_id = $1 AND seat_id = $2", [epoch, seat]);
    await expect(db.query('DELETE FROM civilization_generations WHERE epoch_id = $1 AND seat_id = $2', [epoch, seat])).rejects.toThrow();
    expect((await db.query('SELECT * FROM sparse_nodes')).rows).toHaveLength(1);
    expect((await db.query('SELECT * FROM pending_events WHERE processed_at IS NULL')).rows).toHaveLength(1);
  });
});
