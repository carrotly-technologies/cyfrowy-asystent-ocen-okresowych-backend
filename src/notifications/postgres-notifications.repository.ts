import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../database/database.js';
import type { AppNotification } from './notification.types.js';
import { NotificationsRepository } from './notifications.repository.js';
import { notifications } from './notifications.tables.js';
import type { NotificationType } from './reminders.rules.js';

type Row = typeof notifications.$inferSelect;

const toNotification = (row: Row): AppNotification => ({
  ...row,
  type: row.type as NotificationType,
  createdAt: row.createdAt.toISOString(),
  readAt: row.readAt ? row.readAt.toISOString() : null,
});

/** Used with DATABASE_URL: table notifications. */
export class PostgresNotificationsRepository extends NotificationsRepository {
  constructor(private readonly db: Database) {
    super();
  }

  async listForUser(userId: string) {
    const rows = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(
        desc(notifications.createdOn),
        desc(notifications.createdAt),
        desc(notifications.id),
      );
    return rows.map(toNotification);
  }

  async insertIfAbsent(n: AppNotification) {
    const rows = await this.db
      .insert(notifications)
      .values({
        ...n,
        createdAt: new Date(n.createdAt),
        readAt: n.readAt ? new Date(n.readAt) : null,
      })
      .onConflictDoNothing({
        target: [notifications.userId, notifications.key],
      })
      .returning({ id: notifications.id });
    return rows.length > 0;
  }

  async markRead(id: string, userId: string, at: string) {
    const [row] = await this.db
      .select({ id: notifications.id, readAt: notifications.readAt })
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    if (!row) return false;
    if (!row.readAt) {
      await this.db
        .update(notifications)
        .set({ readAt: new Date(at) })
        .where(eq(notifications.id, id));
    }
    return true;
  }

  async markAllRead(userId: string, at: string) {
    const rows = await this.db
      .update(notifications)
      .set({ readAt: new Date(at) })
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      )
      .returning({ id: notifications.id });
    return rows.length;
  }

  async clear() {
    await this.db.delete(notifications);
  }
}
