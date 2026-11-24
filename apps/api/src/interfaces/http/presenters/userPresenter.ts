import type { PublicUser } from '@app/shared';
import type { UserRecord } from '../../../application/auth/ports.ts';

export const presentUser = (u: UserRecord): PublicUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt.toISOString(),
});
