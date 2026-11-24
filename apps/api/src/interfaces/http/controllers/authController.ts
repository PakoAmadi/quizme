import type { LoginInput, RegisterInput } from '@app/shared';
import type { AuthUseCases } from '../../../application/auth/authUseCases.ts';
import type { AuthUser } from '../../../application/auth/ports.ts';
import { parseCookies, serializeCookie } from '../cookies.ts';
import { presentUser } from '../presenters/userPresenter.ts';
import { sendJson, sendNoContent } from '../respond.ts';
import { csrfCookie, newCsrfToken } from '../stages/csrf.ts';
import type { Stage } from '../types.ts';

export interface SessionCookieOptions {
  cookieName: string;
  secure: boolean;
}

export const makeAuthController = (auth: AuthUseCases, { cookieName, secure }: SessionCookieOptions) => {
  const sessionCookie = (token: string, maxAgeSeconds: number) =>
    serializeCookie(cookieName, token, { httpOnly: true, secure, sameSite: 'Lax', maxAgeSeconds });

  /** Gives the browser a CSRF cookie. The frontend calls it once on start-up. */
  const csrf: Stage = (_req, res) => {
    sendNoContent(res, { 'Set-Cookie': csrfCookie(newCsrfToken(), secure) });
  };

  const register: Stage<{ body: RegisterInput }> = async (_req, res, _route, { body }) => {
    const user = await auth.registerUser(body);
    sendJson(res, 201, { user: presentUser(user) });
  };

  const login: Stage<{ body: LoginInput }> = async (req, res, _route, { body }) => {
    const { user, session } = await auth.loginUser(body, {
      userAgent: req.headers['user-agent'],
      ip: req.socket.remoteAddress,
    });
    const maxAge = (session.expiresAt.getTime() - Date.now()) / 1000;
    sendJson(
      res,
      200,
      { user: presentUser(user) },
      // New CSRF token together with the new session
      { 'Set-Cookie': [sessionCookie(session.token, maxAge), csrfCookie(newCsrfToken(), secure)] },
    );
  };

  const logout: Stage = async (req, res) => {
    const token = parseCookies(req.headers.cookie)[cookieName];
    if (token) await auth.logout(token);
    sendNoContent(res, { 'Set-Cookie': sessionCookie('', 0) });
  };

  const me: Stage<{ user: AuthUser }> = async (_req, res, _route, { user }) => {
    sendJson(res, 200, { user: presentUser(await auth.getCurrentUser(user.id)) });
  };

  return { csrf, register, login, logout, me };
};

export type AuthController = ReturnType<typeof makeAuthController>;
