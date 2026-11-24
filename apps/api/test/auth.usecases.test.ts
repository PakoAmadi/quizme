import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeAuthUseCases } from '../src/application/auth/authUseCases.ts';
import type { SessionStore, UserRepository, UserWithCredentials } from '../src/application/auth/ports.ts';
import { InvalidCredentialsError, UserNotFoundError } from '../src/domain/errors.ts';

const setup = () => {
  const stored: UserWithCredentials[] = [];
  const users: UserRepository = {
    async create({ name, email, passwordHash }) {
      const u = { id: stored.length + 1, name, email, role: 'user' as const, createdAt: new Date(0), passwordHash };
      stored.push(u);
      const { passwordHash: _p, ...rec } = u;
      return rec;
    },
    async findByEmail(email) {
      return stored.find((u) => u.email === email) ?? null;
    },
    async findById(id) {
      const u = stored.find((x) => x.id === id);
      if (!u) return null;
      const { passwordHash: _p, ...rec } = u;
      return rec;
    },
  };
  const verifyCalls: (string | null)[] = [];
  const passwords = {
    hash: async (p: string) => `hashed:${p}`,
    verify: async (p: string, h: string | null) => {
      verifyCalls.push(h);
      return h === `hashed:${p}`;
    },
  };
  const revoked: string[] = [];
  const sessions: SessionStore = {
    create: async () => ({ token: 'tok', expiresAt: new Date(Date.now() + 1000) }),
    findUser: async () => null,
    revoke: async (t) => void revoked.push(t),
    revokeAllForUser: async () => {},
  };
  return { auth: makeAuthUseCases({ users, passwords, sessions }), stored, verifyCalls, revoked };
};

test('auth use cases', async (t) => {
  await t.test('register stores only the hash', async () => {
    const { auth, stored } = setup();
    const user = await auth.registerUser({ name: 'Ann', email: 'ann@x.io', password: 'secret123' });
    assert.equal(user.email, 'ann@x.io');
    assert.ok(!('passwordHash' in user));
    assert.equal(stored[0]!.passwordHash, 'hashed:secret123');
  });

  await t.test('login creates a session and never returns the hash', async () => {
    const { auth } = setup();
    await auth.registerUser({ name: 'Ann', email: 'ann@x.io', password: 'secret123' });
    const { user, session } = await auth.loginUser({ email: 'ann@x.io', password: 'secret123' }, {});
    assert.equal(session.token, 'tok');
    assert.ok(!('passwordHash' in user));
  });

  await t.test('wrong password and unknown email fail the same way, both run the hash check', async () => {
    const { auth, verifyCalls } = setup();
    await auth.registerUser({ name: 'Ann', email: 'ann@x.io', password: 'secret123' });
    await assert.rejects(auth.loginUser({ email: 'ann@x.io', password: 'nope' }, {}), InvalidCredentialsError);
    await assert.rejects(auth.loginUser({ email: 'who@x.io', password: 'nope' }, {}), InvalidCredentialsError);
    assert.deepEqual(verifyCalls, ['hashed:secret123', null]);
  });

  await t.test('logout revokes the session', async () => {
    const { auth, revoked } = setup();
    await auth.logout('tok');
    assert.deepEqual(revoked, ['tok']);
  });

  await t.test('current user', async () => {
    const { auth } = setup();
    await assert.rejects(auth.getCurrentUser(42), UserNotFoundError);
  });
});
