import type { Role } from '@app/shared';

/** Who is making the request: what every protected handler gets in ctx.user. */
export interface AuthUser {
  id: number;
  role: Role;
}

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface UserWithCredentials extends UserRecord {
  passwordHash: string;
}

export interface UserRepository {
  /** Throws EmailAlreadyTakenError on duplicate email. */
  create(data: { name: string; email: string; passwordHash: string }): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserWithCredentials | null>;
  findById(id: number): Promise<UserRecord | null>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  /**
   * With hash === null it must still spend the same time and return false,
   * so the response time does not reveal whether the email exists.
   */
  verify(plain: string, hash: string | null): Promise<boolean>;
}

export interface SessionMeta {
  userAgent?: string | undefined;
  ip?: string | undefined;
}

export interface IssuedSession {
  /** Secret value for the cookie. Never stored as is. */
  token: string;
  expiresAt: Date;
}

export interface SessionStore {
  create(userId: number, meta: SessionMeta): Promise<IssuedSession>;
  /** null if the token is unknown or expired. */
  findUser(token: string): Promise<AuthUser | null>;
  revoke(token: string): Promise<void>;
  revokeAllForUser(userId: number): Promise<void>;
}

/** Stateless bearer tokens. Not wired yet: planned as a second auth strategy. */
export interface TokenService {
  issue(user: AuthUser): string;
  /** null if invalid or expired. */
  verify(token: string): AuthUser | null;
}
