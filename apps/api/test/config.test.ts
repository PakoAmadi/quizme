import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/infrastructure/config/config.ts';

test('loadConfig', async (t) => {
  await t.test('development defaults', () => {
    const c = loadConfig({});
    assert.equal(c.port, 3000);
    assert.equal(c.db.database, 'quizme');
    assert.equal(c.session.secureCookies, false);
    assert.equal(c.session.ttlSeconds, 30 * 24 * 3600);
    assert.ok(Object.isFrozen(c) && Object.isFrozen(c.db));
  });

  await t.test('reads env and ignores invalid numbers', () => {
    const c = loadConfig({ PORT: '8080', PG_PORT: 'abc', SESSION_TTL_SECONDS: '60' });
    assert.equal(c.port, 8080);
    assert.equal(c.db.port, 5432);
    assert.equal(c.session.ttlSeconds, 60);
  });

  await t.test('production: secure cookies, password required', () => {
    assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /PG_PASSWORD/);
    assert.equal(loadConfig({ NODE_ENV: 'production', PG_PASSWORD: 'x' }).session.secureCookies, true);
  });
});
