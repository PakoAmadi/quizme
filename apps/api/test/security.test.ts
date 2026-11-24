import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { HmacTokenService } from '../src/infrastructure/security/HmacTokenService.ts';
import { hash, verifyPassword } from '../src/infrastructure/security/hash.ts';
import { generateToken, verifyToken } from '../src/infrastructure/security/jwt.ts';
import { ScryptPasswordHasher } from '../src/infrastructure/security/ScryptPasswordHasher.ts';

test('password hashing', async (t) => {
  await t.test('salt:key format, both base64', async () => {
    const parts = (await hash('mySecurePassword123')).split(':');
    assert.equal(parts.length, 2);
    for (const p of parts) assert.match(p!, /^[A-Za-z0-9+/=]+$/);
  });

  await t.test('random salt gives different hashes', async () => {
    assert.notEqual(await hash('same'), await hash('same'));
  });

  await t.test('verifies right and rejects wrong passwords', async () => {
    const stored = await hash('correct horse');
    assert.equal(await verifyPassword('correct horse', stored), true);
    assert.equal(await verifyPassword('wrong horse', stored), false);
    assert.equal(await verifyPassword('x', 'garbage'), false);
  });

  await t.test('ScryptPasswordHasher returns false for a missing user', async () => {
    assert.equal(await new ScryptPasswordHasher().verify('anything', null), false);
  });
});

test('JWT (kept for the bearer strategy)', async (t) => {
  const secret = 'test_secret';

  await t.test('round-trips a payload', () => {
    const decoded = verifyToken(generateToken({ id: 1, role: 'user' }, secret), secret);
    assert.equal(decoded?.id, 1);
    assert.equal(decoded?.role, 'user');
  });

  await t.test('rejects tampered, wrongly signed, expired and malformed tokens', () => {
    const token = generateToken({ id: 1 }, secret);
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    assert.equal(verifyToken(tampered, secret), null);
    assert.equal(verifyToken(token, 'other'), null);
    assert.equal(verifyToken(generateToken({ id: 1 }, secret, -10), secret), null);
    for (const bad of ['', 'x', 'a.b.c.d', null]) assert.equal(verifyToken(bad, secret), null);
  });

  await t.test('rejects a token without exp', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ id: 1 })).toString('base64url');
    const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    assert.equal(verifyToken(`${header}.${body}.${sig}`, secret), null);
  });

  await t.test('HmacTokenService validates the role', () => {
    const tokens = new HmacTokenService({ secret });
    assert.deepEqual(tokens.verify(tokens.issue({ id: 5, role: 'admin' })), { id: 5, role: 'admin' });
    assert.equal(tokens.verify(generateToken({ id: 5, role: 'root' }, secret)), null);
  });
});
