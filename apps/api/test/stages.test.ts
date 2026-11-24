import { LoginInput } from '@app/shared';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AuthUser } from '../src/application/auth/ports.ts';
import { parseCookies, serializeCookie } from '../src/interfaces/http/cookies.ts';
import { CsrfError, ForbiddenError, PayloadTooLargeError, TooManyRequestsError, UnauthorizedError, ValidationError } from '../src/interfaces/http/errors.ts';
import { bearerTokenStrategy, makeAuthStage, sessionCookieStrategy } from '../src/interfaces/http/stages/authStage.ts';
import { csrfStage } from '../src/interfaces/http/stages/csrf.ts';
import { rateLimit } from '../src/interfaces/http/stages/rateLimit.ts';
import { requireRole } from '../src/interfaces/http/stages/requireRole.ts';
import { validateBody } from '../src/interfaces/http/stages/validateBody.ts';
import { readJsonBody } from '../src/interfaces/http/readJsonBody.ts';
import { mockReq, mockRes, route } from './helpers.ts';

// async: a stage that throws synchronously becomes a rejected promise
const run = async <C extends object>(stage: (...a: any[]) => unknown, req = mockReq(), ctx: C = {} as C) =>
  stage(req, mockRes().res, route(), ctx);

test('cookies', async (t) => {
  await t.test('parses, decodes, first one wins', () => {
    assert.deepEqual(parseCookies('a=1; b=hello%20world; a=2; c="q"; broken'), { a: '1', b: 'hello world', c: 'q' });
    assert.deepEqual(parseCookies(undefined), {});
  });

  await t.test('does not pollute the prototype', () => {
    const cookies = parseCookies('__proto__=x; constructor=y');
    assert.equal(Object.getPrototypeOf(cookies), Object.prototype);
    assert.equal(cookies['constructor'], 'y');
  });

  await t.test('serializes flags', () => {
    assert.equal(
      serializeCookie('sid', 'a b', { httpOnly: true, secure: true, maxAgeSeconds: 10.7 }),
      'sid=a%20b; Path=/; Max-Age=10; HttpOnly; Secure; SameSite=Lax',
    );
  });
});

test('authStage', async (t) => {
  const user: AuthUser = { id: 1, role: 'user' };
  const sessions = { findUser: async (token: string) => (token === 'good' ? user : null) };

  await t.test('session cookie strategy', async () => {
    const stage = makeAuthStage([sessionCookieStrategy({ sessions, cookieName: 'sid' })]);
    assert.deepEqual(await run(stage, mockReq({ headers: { cookie: 'sid=good' } })), { user });
    await assert.rejects(run(stage, mockReq({ headers: { cookie: 'sid=bad' } })), UnauthorizedError);
    await assert.rejects(run(stage), UnauthorizedError);
  });

  await t.test('falls through to the next strategy', async () => {
    const tokens = { verify: (t: string) => (t === 'jwt' ? { id: 2, role: 'admin' as const } : null) };
    const stage = makeAuthStage([sessionCookieStrategy({ sessions, cookieName: 'sid' }), bearerTokenStrategy({ tokens })]);
    assert.deepEqual(await run(stage, mockReq({ headers: { authorization: 'Bearer jwt' } })), {
      user: { id: 2, role: 'admin' },
    });
    await assert.rejects(run(stage, mockReq({ headers: { authorization: 'Basic jwt' } })), UnauthorizedError);
  });
});

test('requireRole', async () => {
  await run(requireRole('admin'), mockReq(), { user: { id: 1, role: 'admin' } });
  await assert.rejects(run(requireRole('admin'), mockReq(), { user: { id: 1, role: 'user' } }), ForbiddenError);
});

test('csrfStage', async () => {
  await run(csrfStage, mockReq({ headers: { cookie: 'XSRF-TOKEN=abc', 'x-xsrf-token': 'abc' } }));
  await assert.rejects(run(csrfStage, mockReq({ headers: { cookie: 'XSRF-TOKEN=abc', 'x-xsrf-token': 'abd' } })), CsrfError);
  await assert.rejects(run(csrfStage, mockReq({ headers: { cookie: 'XSRF-TOKEN=abc' } })), CsrfError);
  await assert.rejects(run(csrfStage, mockReq({ headers: { 'x-xsrf-token': 'abc' } })), CsrfError);
});

test('rateLimit', async () => {
  let now = 0;
  const stage = rateLimit({ windowMs: 1000, max: 2, now: () => now });
  await run(stage);
  await run(stage);
  await assert.rejects(run(stage), TooManyRequestsError);
  now = 1000; // new window
  await run(stage);
});

test('validateBody + readJsonBody', async (t) => {
  const stage = validateBody(LoginInput);

  await t.test('returns parsed and normalised data', async () => {
    const req = mockReq({ method: 'POST', body: JSON.stringify({ email: '  Bob@Example.COM ', password: 'x' }) });
    assert.deepEqual(await run(stage, req), { body: { email: 'bob@example.com', password: 'x' } });
  });

  await t.test('reports errors per field', async () => {
    const req = mockReq({ method: 'POST', body: JSON.stringify({ email: 'nope' }) });
    await assert.rejects(run(stage, req), (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.deepEqual(Object.keys(err.details as object).sort(), ['email', 'password']);
      return true;
    });
  });

  await t.test('rejects invalid JSON and oversized bodies', async () => {
    await assert.rejects(readJsonBody(mockReq({ body: '{oops' })), /Invalid JSON/);
    await assert.rejects(readJsonBody(mockReq({ body: 'x'.repeat(20) }), 10), PayloadTooLargeError);
    assert.deepEqual(await readJsonBody(mockReq()), {});
  });
});
