import { randomBytes, scrypt, timingSafeEqual, type BinaryLike } from 'node:crypto';

const KEY_LENGTH = 64;

const scryptAsync = (password: BinaryLike, salt: BinaryLike) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key)));
  });

/** Returns "salt:key", both base64. */
export const hash = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('base64');
  const key = await scryptAsync(password, salt);
  return `${salt}:${key.toString('base64')}`;
};

export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (!storedHash || typeof storedHash !== 'string') return false;
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;

  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
