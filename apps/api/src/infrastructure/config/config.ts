import type { DbConfig } from '../db/db.ts';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  db: DbConfig;
  session: {
    cookieName: string;
    ttlSeconds: number;
    /** Secure cookies need HTTPS: on in production only. */
    secureCookies: boolean;
  };
}

const DAY = 24 * 60 * 60;

const int = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * Builds an immutable config from environment variables.
 * The only module that reads process.env (.env is loaded by `node --env-file`).
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const nodeEnv = env.NODE_ENV || 'development';
  const production = nodeEnv === 'production';

  if (production && !env.PG_PASSWORD) {
    throw new Error('PG_PASSWORD must be set in production');
  }

  return Object.freeze({
    nodeEnv,
    port: int(env.PORT, 3000),
    db: Object.freeze({
      host: env.PG_HOST || 'localhost',
      port: int(env.PG_PORT, 5432),
      user: env.PG_USER || 'app',
      password: env.PG_PASSWORD || 'app',
      database: env.PG_DB_NAME || 'quizme',
    }),
    session: Object.freeze({
      cookieName: 'sid',
      ttlSeconds: int(env.SESSION_TTL_SECONDS, 30 * DAY),
      secureCookies: production,
    }),
  });
};
