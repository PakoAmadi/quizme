import { createHash, randomBytes } from 'node:crypto';
import type { AuthUser, SessionMeta, SessionStore } from '../../../application/auth/ports.ts';
import type { QueryExecutor } from '../db.ts';

const TOKEN_BYTES = 32;
const MAX_USER_AGENT_LENGTH = 512;

// Only the hash goes to the DB: a leaked sessions table can't be used to log in.
const hashToken = (token: string) => createHash('sha256').update(token).digest();

export class PgSessionStore implements SessionStore {
  readonly #db: QueryExecutor;
  readonly #ttlSeconds: number;

  constructor(db: QueryExecutor, { ttlSeconds }: { ttlSeconds: number }) {
    this.#db = db;
    this.#ttlSeconds = ttlSeconds;
  }

  async create(userId: number, meta: SessionMeta) {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const { rows } = await this.#db.query<{ expires_at: Date }>(
      `INSERT INTO sessions (id_hash, user_id, expires_at, user_agent, ip)
       VALUES ($1, $2, now() + make_interval(secs => $3), $4, $5)
       RETURNING expires_at`,
      [hashToken(token), userId, this.#ttlSeconds, meta.userAgent?.slice(0, MAX_USER_AGENT_LENGTH) ?? null, meta.ip ?? null],
    );
    return { token, expiresAt: rows[0]!.expires_at };
  }

  async findUser(token: string): Promise<AuthUser | null> {
    if (!token) return null;
    // Role is read from users on every request, so a role change applies immediately.
    const { rows } = await this.#db.query<AuthUser>(
      `SELECT u.id, u.role
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)],
    );
    return rows[0] ?? null;
  }

  async revoke(token: string) {
    await this.#db.query('DELETE FROM sessions WHERE id_hash = $1', [hashToken(token)]);
  }

  async revokeAllForUser(userId: number) {
    await this.#db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }
}
