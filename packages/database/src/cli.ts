import { createDatabasePool, migrate, seedDevelopment } from './index.js';

const command = process.argv[2];
if (command !== 'migrate' && command !== 'seed') throw new Error('Usage: tsx src/cli.ts <migrate|seed>');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = createDatabasePool(databaseUrl);
try {
  if (command === 'migrate') {
    const applied = await migrate(pool);
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date');
  } else {
    await seedDevelopment(pool);
    console.log('Development account and M1 seat exist; existing state preserved');
  }
} finally {
  await pool.end();
}
