import { createHmac, timingSafeEqual } from 'node:crypto';

// Minimal HS256 JWT. Kept for the planned bearer-token strategy; not wired yet.

const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('base64url');

export const generateToken = (payload: Record<string, unknown>, secret: string, expiresInSeconds = 3600): string => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  return `${header}.${body}.${sign(`${header}.${body}`, secret)}`;
};

export const verifyToken = (token: unknown, secret: string): (Record<string, unknown> & { exp: number }) | null => {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts as [string, string, string];

  try {
    const expected = Buffer.from(sign(`${header}.${body}`, secret));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    const payload: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof payload !== 'object' || payload === null) return null;

    // exp is mandatory: a token without it would never expire
    const exp = (payload as { exp?: unknown }).exp;
    if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) return null;

    return payload as Record<string, unknown> & { exp: number };
  } catch {
    return null;
  }
};
