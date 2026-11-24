import type { LoginInput, RegisterInput } from '@app/shared';
import { InvalidCredentialsError, UserNotFoundError } from '../../domain/errors.ts';
import type { PasswordHasher, SessionMeta, SessionStore, UserRepository } from './ports.ts';

interface Deps {
  users: UserRepository;
  passwords: PasswordHasher;
  sessions: SessionStore;
}

/**
 * Authentication and profile use cases.
 * Input is expected to be validated at the boundary (HTTP schemas).
 */
export const makeAuthUseCases = ({ users, passwords, sessions }: Deps) => ({
  async registerUser({ name, email, password }: RegisterInput) {
    const passwordHash = await passwords.hash(password);
    return users.create({ name, email, passwordHash });
  },

  async loginUser({ email, password }: LoginInput, meta: SessionMeta) {
    const found = await users.findByEmail(email);

    // Always run the hash check (also for unknown emails) — constant-time behaviour
    const matched = await passwords.verify(password, found ? found.passwordHash : null);
    if (!found || !matched) throw new InvalidCredentialsError();

    const { passwordHash: _omit, ...user } = found;
    const session = await sessions.create(user.id, meta);
    return { user, session };
  },

  async logout(token: string) {
    await sessions.revoke(token);
  },

  async getCurrentUser(userId: number) {
    const user = await users.findById(userId);
    if (!user) throw new UserNotFoundError();
    return user;
  },
});

export type AuthUseCases = ReturnType<typeof makeAuthUseCases>;
