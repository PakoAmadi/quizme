import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestError } from '../src/interfaces/http/errors.ts';
import { Router } from '../src/interfaces/http/router/Router.ts';

const h = async () => {};
const h2 = async () => {};

test('Router', async (t) => {
  await t.test('finds static routes', () => {
    const r = new Router();
    r.get('/api/tests', h);
    assert.deepEqual(r.lookup('GET', '/api/tests'), { handler: h, params: {} });
  });

  await t.test('extracts and decodes path params', () => {
    const r = new Router();
    r.get('/api/topics/:topicId/words/:word', h);
    const found = r.lookup('GET', '/api/topics/7/words/caf%C3%A9');
    assert.ok('handler' in found);
    assert.deepEqual(found.params, { topicId: '7', word: 'café' });
  });

  await t.test('static route wins over dynamic', () => {
    const r = new Router();
    r.get('/api/tests/:id', h);
    r.get('/api/tests/random', h2);
    assert.ok('handler' in r.lookup('GET', '/api/tests/random'));
    assert.equal((r.lookup('GET', '/api/tests/random') as { handler: unknown }).handler, h2);
  });

  await t.test('supports PATCH', () => {
    const r = new Router();
    r.patch('/api/tests/:id', h);
    assert.ok('handler' in r.lookup('PATCH', '/api/tests/1'));
  });

  await t.test('405 with allowed methods when the path exists for others, 404 otherwise', () => {
    const r = new Router();
    r.get('/api/tests/:id', h);
    r.patch('/api/tests/:id', h);
    assert.deepEqual(r.lookup('DELETE', '/api/tests/1'), { error: 'METHOD_NOT_ALLOWED', allowed: ['GET', 'PATCH'] });
    assert.deepEqual(r.lookup('OPTIONS', '/api/tests/1'), { error: 'METHOD_NOT_ALLOWED', allowed: ['GET', 'PATCH'] });
    assert.deepEqual(r.lookup('GET', '/api/nothing'), { error: 'NOT_FOUND' });
    assert.deepEqual(r.lookup('OPTIONS', '/api/nothing'), { error: 'NOT_FOUND' });
  });

  await t.test('treats regex characters in paths literally', () => {
    const r = new Router();
    r.get('/api/v1.0/items/:id', h);
    assert.ok('handler' in r.lookup('GET', '/api/v1.0/items/1'));
    assert.deepEqual(r.lookup('GET', '/api/v1x0/items/1'), { error: 'NOT_FOUND' });
  });

  await t.test('a param does not match across slashes', () => {
    const r = new Router();
    r.get('/api/tests/:id', h);
    assert.deepEqual(r.lookup('GET', '/api/tests/1/extra'), { error: 'NOT_FOUND' });
  });

  await t.test('malformed percent-encoding is a 400', () => {
    const r = new Router();
    r.get('/api/tests/:id', h);
    assert.throws(() => r.lookup('GET', '/api/tests/%E0%A4%A'), BadRequestError);
  });

  await t.test('rejects non-function handlers', () => {
    const r = new Router();
    assert.throws(() => r.get('/x', undefined as never), TypeError);
  });
});
