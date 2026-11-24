import type { Role } from '@app/shared';
import type { AuthUser } from '../../../application/auth/ports.ts';
import { ForbiddenError } from '../errors.ts';
import type { Stage } from '../types.ts';

/** Must come after the auth stage — the types enforce it. */
export const requireRole =
  (...roles: Role[]): Stage<{ user: AuthUser }> =>
  (_req, _res, _route, { user }) => {
    if (!roles.includes(user.role)) throw new ForbiddenError('Access denied: insufficient privileges');
  };
