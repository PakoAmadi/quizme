import { randomBytes } from 'node:crypto';
import type { PasswordHasher } from '../../application/auth/ports.ts';
import { hash, verifyPassword } from './hash.ts';

// A valid "salt:key" pair used when the user does not exist, so that verify()
// performs a real scrypt computation and takes the same time.
const DUMMY_HASH = `${randomBytes(16).toString('base64')}:${randomBytes(64).toString('base64')}`;

export class ScryptPasswordHasher implements PasswordHasher {
  hash(plain: string) {
    return hash(plain);
  }

  async verify(plain: string, storedHash: string | null) {
    if (storedHash === null) {
      await verifyPassword(plain, DUMMY_HASH);
      return false;
    }
    return verifyPassword(plain, storedHash);
  }
}
