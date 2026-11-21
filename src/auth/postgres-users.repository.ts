import { asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../database/database.js';
import type { Role, User } from './user.types.js';
import {
  publicUser,
  type UserCredentials,
  type UserRow,
  UsersRepository,
} from './users.repository.js';
import { users } from './users.tables.js';

type Row = typeof users.$inferSelect;

const toUserRow = ({ seq: _seq, email, ...row }: Row): UserRow => ({
  ...row,
  ...(email !== null ? { email } : {}),
});

const toRow = (row: UserRow) => ({ ...row, email: row.email ?? null });

/** Used with DATABASE_URL: table users. */
export class PostgresUsersRepository extends UsersRepository {
  constructor(private readonly db: Database) {
    super();
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id));
    return row ? publicUser(toUserRow(row)) : null;
  }

  async findCredentials(login: string): Promise<UserCredentials | null> {
    const wanted = login.trim().toLowerCase();
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(sql`lower(${users.login})`, wanted));
    if (!row) return null;
    const stored = toUserRow(row);
    return { user: publicUser(stored), passwordHash: stored.passwordHash };
  }

  async list(): Promise<User[]> {
    const rows = await this.db.select().from(users).orderBy(asc(users.seq));
    return rows.map((r) => publicUser(toUserRow(r)));
  }

  async updateRole(id: string, role: Role): Promise<User | null> {
    const [row] = await this.db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning();
    return row ? publicUser(toUserRow(row)) : null;
  }

  async isEmpty(): Promise<boolean> {
    const [row] = await this.db.select({ id: users.id }).from(users).limit(1);
    return !row;
  }

  async replaceAll(rows: readonly UserRow[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(users);
      if (rows.length) await tx.insert(users).values(rows.map(toRow));
    });
  }
}
