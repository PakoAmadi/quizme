// Composition Root: the only place where concrete implementations are wired
// to use cases that depend on abstractions (ports).

import { makeAuthUseCases } from './application/auth/authUseCases.ts';
import type { AppConfig } from './infrastructure/config/config.ts';
import type { Database } from './infrastructure/db/db.ts';
import { PgSessionStore } from './infrastructure/db/repositories/PgSessionStore.ts';
import { PgUserRepository } from './infrastructure/db/repositories/PgUserRepository.ts';
import { ScryptPasswordHasher } from './infrastructure/security/ScryptPasswordHasher.ts';
import { makeAuthController } from './interfaces/http/controllers/authController.ts';
import { createRoutes } from './interfaces/http/routes.ts';
import { makeAuthStage, sessionCookieStrategy } from './interfaces/http/stages/authStage.ts';

export const createContainer = ({ db, config }: { db: Database; config: AppConfig }) => {
  // ---- infrastructure ----
  const users = new PgUserRepository(db);
  const sessions = new PgSessionStore(db, { ttlSeconds: config.session.ttlSeconds });
  const passwords = new ScryptPasswordHasher();

  // ---- application ----
  const auth = makeAuthUseCases({ users, passwords, sessions });

  // ---- interfaces ----
  const { cookieName, secureCookies } = config.session;
  const authStage = makeAuthStage([
    sessionCookieStrategy({ sessions, cookieName }),
    // later: bearerTokenStrategy({ tokens: new HmacTokenService(...) })
  ]);
  const controllers = { auth: makeAuthController(auth, { cookieName, secure: secureCookies }) };
  const router = createRoutes({ controllers, authStage });

  return { router, useCases: { auth } };
};
