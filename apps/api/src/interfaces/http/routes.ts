import { LoginInput, RegisterInput } from '@app/shared';
import type { AuthUser } from '../../application/auth/ports.ts';
import type { AuthController } from './controllers/authController.ts';
import { pipe } from './pipe.ts';
import { sendJson } from './respond.ts';
import { Router } from './router/Router.ts';
import { csrfStage } from './stages/csrf.ts';
import { rateLimit } from './stages/rateLimit.ts';
import { validateBody } from './stages/validateBody.ts';
import type { Stage } from './types.ts';

interface Deps {
  controllers: { auth: AuthController };
  authStage: Stage<object, { user: AuthUser }>;
}

const MINUTE = 60_000;

/**
 * Builds the HTTP route table. Pure wiring: no business logic, no infrastructure.
 * Every state-changing route starts with csrfStage.
 * Admin-only routes: pipe(csrfStage, authStage, requireRole('admin'), ...).
 */
export const createRoutes = ({ controllers: c, authStage }: Deps): Router => {
  const router = new Router();

  // Built outside pipe(): generic calls inside it confuse TypeScript's inference
  const registerBody = validateBody(RegisterInput);
  const loginBody = validateBody(LoginInput);
  const registerLimit = rateLimit({ windowMs: MINUTE, max: 5 });
  const loginLimit = rateLimit({ windowMs: MINUTE, max: 10 });

  router.get('/api/health', pipe((_req, res) => sendJson(res, 200, { status: 'ok' })));

  // Auth & profile
  router.get('/api/auth/csrf', pipe(c.auth.csrf));
  router.post('/api/auth/register', pipe(csrfStage, registerLimit, registerBody, c.auth.register));
  router.post('/api/auth/login', pipe(csrfStage, loginLimit, loginBody, c.auth.login));
  router.post('/api/auth/logout', pipe(csrfStage, c.auth.logout));
  router.get('/api/auth/me', pipe(authStage, c.auth.me));

  return router;
};
