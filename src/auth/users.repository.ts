import type { Role, User } from './user.types.js';

export interface UserCredentials {
  user: User;
  passwordHash: string;
}

/** An account as stored: the user and its password hash. */
export type UserRow = User & { passwordHash: string };

/**
 * Where accounts live: PostgreSQL with DATABASE_URL
 * (postgres-users.repository.ts), memory without it
 * (users.in-memory.repository.ts). Auth depends only on this contract.
 */
export abstract class UsersRepository {
  abstract findById(id: string): Promise<User | null>;
  /** The account and its hash, for sign-in only. Login is case-insensitive. */
  abstract findCredentials(login: string): Promise<UserCredentials | null>;
  abstract list(): Promise<User[]>;
  /** The updated user, or null when there is no such user. */
  abstract updateRole(id: string, role: Role): Promise<User | null>;
  /** Adds one account (POST /api/admin/users); the caller checks the login is free. */
  abstract insert(row: UserRow): Promise<User>;
  /** The EMPLOYEE account linked to the assessed person, if any. */
  abstract findByPersonId(personId: string): Promise<User | null>;
  abstract isEmpty(): Promise<boolean>;
  /** Replaces every account (seed, POST /api/demo/reset). */
  abstract replaceAll(rows: readonly UserRow[]): Promise<void>;
}

export function publicUser({ passwordHash: _hash, ...user }: UserRow): User {
  return { ...user };
}
