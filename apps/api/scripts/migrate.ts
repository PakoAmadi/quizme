// Usage: npm run migrate -w @app/api
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/infrastructure/config/config.ts';
import { Database } from '../src/infrastructure/db/db.ts';
import { migrate } from '../src/infrastructure/db/migrate.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../db/migrations/', import.meta.url));

const db = new Database(loadConfig().db);
try {
  await db.connect();
  const applied = await migrate(db, MIGRATIONS_DIR);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
} catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
} finally {
  await db.disconnect();
}
