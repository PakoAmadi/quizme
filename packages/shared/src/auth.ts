import { z } from 'zod';

export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(255, 'Email is too long')
  .pipe(z.email('Invalid email format'));

export const RegisterInput = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters long').max(100, 'Name is too long'),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters long').max(200, 'Password is too long'),
});
export type RegisterInput = z.output<typeof RegisterInput>;

// Login does not re-check password rules: they may change after the user registered.
export const LoginInput = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(200, 'Password is too long'),
});
export type LoginInput = z.output<typeof LoginInput>;

/** User as the API returns it. */
export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: string; // ISO 8601
}
