import http from 'node:http';
import { createContainer } from './container.ts';
import { loadConfig } from './infrastructure/config/config.ts';
import { Database } from './infrastructure/db/db.ts';
import { RouterDispatcher } from './interfaces/http/router/RouterDispatcher.ts';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

const bootstrap = async () => {
  const config = loadConfig();
  const db = new Database(config.db);
  const { router } = createContainer({ db, config });
  const dispatcher = new RouterDispatcher(router);

  const server = http.createServer((req, res) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
    void dispatcher.dispatch(req, res);
  });

  await db.connect();
  console.log(`[DATABASE]: Connected to "${config.db.database}" at ${config.db.host}:${config.db.port}`);
  server.listen(config.port, () => console.log(`[SERVER]: Running on port ${config.port}`));

  const shutdown = (signal: string) => {
    console.log(`\n[SERVER]: Received ${signal}. Starting graceful shutdown...`);
    setTimeout(() => {
      console.error('[SERVER ERROR]: Forcefully shutting down due to timeout.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(async () => {
      try {
        await db.disconnect();
        console.log('[SERVER]: Graceful shutdown complete.');
        process.exit(0);
      } catch (error) {
        console.error('[SERVER ERROR]: Error during disconnect:', error);
        process.exit(1);
      }
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
};

bootstrap().catch((error: unknown) => {
  // Full object: e.g. ECONNREFUSED from pg is an AggregateError with an empty message
  console.error('[CRITICAL BOOTSTRAP ERROR]:', error);
  process.exit(1);
});
