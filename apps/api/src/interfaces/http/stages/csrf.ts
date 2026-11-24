import { randomBytes, timingSafeEqual } from 'node:crypto';
import { parseCookies, serializeCookie } from '../cookies.ts';
import { CsrfError } from '../errors.ts';
import type { Stage } from '../types.ts';

// Names Angular's HttpClient uses out of the box (withXsrfConfiguration defaults)
export const CSRF_COOKIE = 'XSRF-TOKEN';
export const CSRF_HEADER = 'x-xsrf-token';

export const newCsrfToken = () => randomBytes(32).toString('base64url');

/** Readable by JS on purpose: the frontend copies it into the header. */
export const csrfCookie = (token: string, secure: boolean) =>
  serializeCookie(CSRF_COOKIE, token, { secure, sameSite: 'Lax' });

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Double-submit check for state-changing requests: another site can make the
 * browser send our cookies, but cannot read the token to put it in a header.
 */
export const csrfStage: Stage<object> = (req) => {
  const cookie = parseCookies(req.headers.cookie)[CSRF_COOKIE];
  const header = req.headers[CSRF_HEADER];
  if (!cookie || typeof header !== 'string' || !safeEqual(cookie, header)) throw new CsrfError();
};
