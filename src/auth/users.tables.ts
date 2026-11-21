import { sql } from 'drizzle-orm';
import { pgTable, serial, text, uniqueIndex } from 'drizzle-orm/pg-core';
import type { Role } from './user.types.js';

/** Accounts. Login is unique case-insensitively (sign-in ignores case). */
export const users = pgTable(
  'users',
  {
    id: text().primaryKey(),
    /** Insertion order, so the admin list keeps the seed order. */
    seq: serial().notNull(),
    login: text().notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    role: text().$type<Role>().notNull(),
    position: text().notNull(),
    unit: text().notNull(),
    evaluatorId: text('evaluator_id'),
    personId: text('person_id'),
    email: text(),
    passwordHash: text('password_hash').notNull(),
  },
  (t) => [uniqueIndex('users_login_idx').on(sql`lower(${t.login})`)],
);
