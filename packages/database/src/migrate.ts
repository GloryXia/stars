import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const migrationsDirectory = new URL('../migrations/', import.meta.url);
const migrationLockId = 768_241_019;

/** Serializes deployers and checks applied files for accidental history edits. */
export async function migrate(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock($1)', [migrationLockId]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(fileURLToPath(migrationsDirectory))).filter((name) => /^\d+_.+\.sql$/.test(name)).sort();
    for (const name of files) {
      const sql = await readFile(new URL(name, migrationsDirectory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = await client.query<{ checksum: string }>('SELECT checksum FROM schema_migrations WHERE name = $1', [name]);
      if (previous.rows[0]) {
        if (previous.rows[0].checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [name, checksum]);
        await client.query('COMMIT');
        applied.push(name);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return applied;
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1)', [migrationLockId]); }
    finally { client.release(); }
  }
}
