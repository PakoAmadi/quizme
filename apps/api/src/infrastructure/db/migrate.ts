import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Database } from './db.ts';

// Arbitrary constant: only one migrator at a time, even with several app instances.
const MIGRATION_LOCK_ID = 727_001;

/**
 * Applies every not-yet-applied `*.sql` file from `dir`, in file-name order
 * (001_..., 002_...), inside one transaction. Returns the applied file names.
 */
export async function migrate(db: Database, dir: string): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  return db.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_ID]);
    await tx.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const { rows } = await tx.query<{ name: string }>('SELECT name FROM schema_migrations');
    const done = new Set(rows.map((r) => r.name));

    const applied: string[] = [];
    for (const file of files) {
      if (done.has(file)) continue;
      await tx.query(await readFile(path.join(dir, file), 'utf8'));
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      applied.push(file);
    }
    return applied;
  });
}
