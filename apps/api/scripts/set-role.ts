// Usage: npm run set-role -w @app/api -- <email> <admin|user>
// The first admin: register through the API, then promote with this script.
import { ROLES, type Role } from '@app/shared';
import { loadConfig } from '../src/infrastructure/config/config.ts';
import { Database } from '../src/infrastructure/db/db.ts';

const [email, role] = process.argv.slice(2);
if (!email || !ROLES.includes(role as Role)) {
  console.error(`Usage: set-role <email> <${ROLES.join('|')}>`);
  process.exit(1);
}

const db = new Database(loadConfig().db);
try {
  await db.connect();
  const { rowCount } = await db.query('UPDATE users SET role = $2 WHERE lower(email) = lower($1)', [email, role]);
  if (rowCount) console.log(`${email} is now ${role}.`);
  else {
    console.error(`User ${email} not found.`);
    process.exitCode = 1;
  }
} finally {
  await db.disconnect();
}
