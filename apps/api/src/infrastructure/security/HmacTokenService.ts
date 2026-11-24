import { ROLES, type Role } from '@app/shared';
import type { AuthUser, TokenService } from '../../application/auth/ports.ts';
import { generateToken, verifyToken } from './jwt.ts';

const isRole = (value: unknown): value is Role => ROLES.includes(value as Role);

/** TokenService on HS256 JWT. Planned for the bearer strategy; not wired yet. */
export class HmacTokenService implements TokenService {
  readonly #secret: string;
  readonly #expiresInSeconds: number;

  constructor({ secret, expiresInSeconds = 3600 }: { secret: string; expiresInSeconds?: number }) {
    if (!secret) throw new Error('HmacTokenService: secret is required');
    this.#secret = secret;
    this.#expiresInSeconds = expiresInSeconds;
  }

  issue({ id, role }: AuthUser) {
    return generateToken({ id, role }, this.#secret, this.#expiresInSeconds);
  }

  verify(token: string): AuthUser | null {
    const payload = verifyToken(token, this.#secret);
    if (!payload || typeof payload.id !== 'number' || !isRole(payload.role)) return null;
    return { id: payload.id, role: payload.role };
  }
}
