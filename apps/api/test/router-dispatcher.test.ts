import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EmailAlreadyTakenError } from '../src/domain/errors.ts';
import type { LookupResult } from '../src/interfaces/http/router/Router.ts';
import { RouterDispatcher } from '../src/interfaces/http/router/RouterDispatcher.ts';
import type { Handler } from '../src/interfaces/http/types.ts';
import { mockReq, mockRes } from './helpers.ts';

const routerReturning = (result: LookupResult) => ({ lookup: () => result });

test('RouterDispatcher', async (t) => {
  await t.test('405 with the Allow header for METHOD_NOT_ALLOWED', async () => {
    const { res, state } = mockRes();
    await new RouterDispatcher(routerReturning({ error: 'METHOD_NOT_ALLOWED', allowed: ['POST'] })).dispatch(
      mockReq({ method: 'GET', url: '/api/auth/login' }),
      res,
    );
    assert.equal(state.statusCode, 405);
    assert.equal(state.body.code, 'METHOD_NOT_ALLOWED');
    assert.equal(state.headers['allow'], 'POST');
  });

  await t.test('404 for NOT_FOUND, JSON content type', async () => {
    const { res, state } = mockRes();
    await new RouterDispatcher(routerReturning({ error: 'NOT_FOUND' })).dispatch(
      mockReq({ method: 'POST', url: '/api/unknown-path?x=1' }),
      res,
    );
    assert.equal(state.statusCode, 404);
    assert.equal(state.body.error, 'Route POST /api/unknown-path not found');
    assert.match(String(state.headers['content-type']), /application\/json/);
  });

  await t.test('passes params and query to the handler', async () => {
    let seen: { params: Record<string, string>; q: string | null } | null = null;
    const handler: Handler = async (_req, res, route) => {
      seen = { params: route.params, q: route.query.get('page') };
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    };
    const { res, state } = mockRes();
    await new RouterDispatcher(routerReturning({ handler, params: { id: '99' } })).dispatch(
      mockReq({ url: '/api/tests/99?page=2' }),
      res,
    );
    assert.deepEqual(seen, { params: { id: '99' }, q: '2' });
    assert.equal(state.statusCode, 200);
  });

  await t.test('maps domain errors', async () => {
    const handler: Handler = async () => {
      throw new EmailAlreadyTakenError();
    };
    const { res, state } = mockRes();
    await new RouterDispatcher(routerReturning({ handler, params: {} })).dispatch(mockReq(), res);
    assert.equal(state.statusCode, 409);
    assert.deepEqual(state.body, { error: 'User with this email already exists', code: 'EMAIL_TAKEN' });
  });

  await t.test('500 without leaking details for unexpected errors', async (t) => {
    t.mock.method(console, 'error', () => {});
    const handler: Handler = async () => {
      throw new Error('Database connection lost');
    };
    const { res, state } = mockRes();
    await new RouterDispatcher(routerReturning({ handler, params: {} })).dispatch(mockReq(), res);
    assert.equal(state.statusCode, 500);
    assert.deepEqual(state.body, { error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
  });

  await t.test('does not try to write headers twice if the response already started', async (t) => {
    t.mock.method(console, 'error', () => {});
    const handler: Handler = async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      throw new Error('stream broke');
    };
    const { res, state } = mockRes();
    await new RouterDispatcher(routerReturning({ handler, params: {} })).dispatch(mockReq(), res);
    assert.equal(state.statusCode, 200);
    assert.equal(state.ended, true);
  });
});
