import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getPool } from './client';

async function main() {
  const migrationsDir = join(__dirname, '../../../../supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const pool = getPool();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    console.log(`Applying ${file}...`);
    await pool.query(sql);
  }
  await pool.end();
  console.log('Migrations complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
