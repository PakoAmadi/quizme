import type { AuthUser, SessionStore, TokenService } from '../../../application/auth/ports.ts';
import { parseCookies } from '../cookies.ts';
import { UnauthorizedError } from '../errors.ts';
import type { Req, Stage } from '../types.ts';

/** One way to find out who is calling. null = "not mine / not valid", try the next one. */
export type AuthStrategy = (req: Req) => Promise<AuthUser | null>;

/** Puts { user } into ctx using the first strategy that recognises the request; 401 otherwise. */
export const makeAuthStage =
  (strategies: AuthStrategy[]): Stage<object, { user: AuthUser }> =>
  async (req) => {
    for (const strategy of strategies) {
      const user = await strategy(req);
      if (user) return { user };
    }
    throw new UnauthorizedError('Authentication required');
  };

/** Session id in an httpOnly cookie (current). */
export const sessionCookieStrategy =
  ({ sessions, cookieName }: { sessions: Pick<SessionStore, 'findUser'>; cookieName: string }): AuthStrategy =>
  async (req) => {
    const token = parseCookies(req.headers.cookie)[cookieName];
    return token ? sessions.findUser(token) : null;
  };

/** "Authorization: Bearer <token>" (planned, for mobile / external clients). */
export const bearerTokenStrategy =
  ({ tokens }: { tokens: Pick<TokenService, 'verify'> }): AuthStrategy =>
  async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    return token ? tokens.verify(token) : null;
  };
