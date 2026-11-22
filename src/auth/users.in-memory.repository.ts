import type { Role, User } from './user.types.js';
import {
  publicUser,
  type UserCredentials,
  type UserRow,
  UsersRepository,
} from './users.repository.js';

/** Used without DATABASE_URL: accounts live in this process only. */
export class InMemoryUsersRepository extends UsersRepository {
  private rows = new Map<string, UserRow>();

  findById(id: string): Promise<User | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? publicUser(row) : null);
  }

  findCredentials(login: string): Promise<UserCredentials | null> {
    const wanted = login.trim().toLowerCase();
    const row = [...this.rows.values()].find(
      (r) => r.login.toLowerCase() === wanted,
    );
    return Promise.resolve(
      row ? { user: publicUser(row), passwordHash: row.passwordHash } : null,
    );
  }

  list(): Promise<User[]> {
    return Promise.resolve([...this.rows.values()].map(publicUser));
  }

  updateRole(id: string, role: Role): Promise<User | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    row.role = role;
    return Promise.resolve(publicUser(row));
  }

  insert(row: UserRow): Promise<User> {
    this.rows.set(row.id, { ...row });
    return Promise.resolve(publicUser(row));
  }

  findByPersonId(personId: string): Promise<User | null> {
    const row = [...this.rows.values()].find((r) => r.personId === personId);
    return Promise.resolve(row ? publicUser(row) : null);
  }

  isEmpty(): Promise<boolean> {
    return Promise.resolve(this.rows.size === 0);
  }

  replaceAll(rows: readonly UserRow[]): Promise<void> {
    this.rows = new Map(rows.map((r) => [r.id, { ...r }]));
    return Promise.resolve();
  }
}
