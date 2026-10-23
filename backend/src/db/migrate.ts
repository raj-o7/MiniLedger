import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';
import { loadConfig, loadEnvFileIfPresent } from '../config';
import { createPool } from './pool';

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

/**
 * Applies every .sql file in the migrations folder that has not been applied yet,
 * in filename order. Each file runs inside a transaction, so a failing file changes nothing.
 * Returns the names of the files that were applied.
 */
export async function runMigrations(
  db: Pool,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR,
): Promise<string[]> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const alreadyApplied = await db.query<{ name: string }>('SELECT name FROM schema_migrations');
  const appliedNames = new Set(alreadyApplied.rows.map((row) => row.name));

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (appliedNames.has(file)) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      newlyApplied.push(file);
    } catch (error) {
      await client.query('ROLLBACK');
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${file} failed: ${reason}`);
    } finally {
      client.release();
    }
  }

  return newlyApplied;
}

async function main(): Promise<void> {
  loadEnvFileIfPresent();
  const config = loadConfig();
  const db = createPool(config.databaseUrl);
  try {
    const applied = await runMigrations(db);
    if (applied.length === 0) {
      console.log('Database is already up to date.');
    } else {
      console.log(`Applied migrations: ${applied.join(', ')}`);
    }
  } finally {
    await db.end();
  }
}

// Only run when executed directly (npm run db:migrate), not when imported by tests.
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
