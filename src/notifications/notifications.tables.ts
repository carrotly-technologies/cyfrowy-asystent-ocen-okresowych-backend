import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** In-app notifications; one per user and key (the scheduler is idempotent). */
export const notifications = pgTable(
  'notifications',
  {
    id: text().primaryKey(),
    userId: text('user_id').notNull(),
    key: text().notNull(),
    caseId: text('case_id'),
    type: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    /** Demo "today" (DEMO_TODAY) on which it was generated. */
    createdOn: date('created_on', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('notifications_user_key_idx').on(t.userId, t.key),
    index('notifications_user_idx').on(t.userId),
  ],
);
