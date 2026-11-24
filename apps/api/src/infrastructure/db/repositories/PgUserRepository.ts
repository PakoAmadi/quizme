import type { Role } from '@app/shared';
import type { UserRecord, UserRepository, UserWithCredentials } from '../../../application/auth/ports.ts';
import { EmailAlreadyTakenError } from '../../../domain/errors.ts';
import type { QueryExecutor } from '../db.ts';

const PG_UNIQUE_VIOLATION = '23505';

interface UserRow {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: Date;
}

const COLUMNS = 'id, name, email, role, created_at';

const toRecord = (row: UserRow): UserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  createdAt: row.created_at,
});

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === PG_UNIQUE_VIOLATION;

export class PgUserRepository implements UserRepository {
  readonly #db: QueryExecutor;

  constructor(db: QueryExecutor) {
    this.#db = db;
  }

  async create({ name, email, passwordHash }: { name: string; email: string; passwordHash: string }) {
    try {
      const { rows } = await this.#db.query<UserRow>(
        `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
        [name, email, passwordHash],
      );
      return toRecord(rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailAlreadyTakenError();
      throw error;
    }
  }

  async findByEmail(email: string): Promise<UserWithCredentials | null> {
    const { rows } = await this.#db.query<UserRow & { password_hash: string }>(
      `SELECT ${COLUMNS}, password_hash FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    const row = rows[0];
    return row ? { ...toRecord(row), passwordHash: row.password_hash } : null;
  }

  async findById(id: number) {
    const { rows } = await this.#db.query<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  }
}
