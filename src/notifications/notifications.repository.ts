import type { AppNotification } from './notification.types.js';

/** Storage of notifications: PostgreSQL with DATABASE_URL, else in memory. */
export abstract class NotificationsRepository {
  /** Newest first. */
  abstract listForUser(userId: string): Promise<AppNotification[]>;
  /** False when the user already has a notification with this key. */
  abstract insertIfAbsent(n: AppNotification): Promise<boolean>;
  abstract markRead(id: string, userId: string, at: string): Promise<boolean>;
  abstract markAllRead(userId: string, at: string): Promise<number>;
  abstract clear(): Promise<void>;
}

export class InMemoryNotificationsRepository extends NotificationsRepository {
  private items: AppNotification[] = [];

  async listForUser(userId: string) {
    return this.items
      .filter((n) => n.userId === userId)
      .sort(
        (a, b) =>
          b.createdOn.localeCompare(a.createdOn) ||
          b.createdAt.localeCompare(a.createdAt) ||
          b.id.localeCompare(a.id),
      )
      .map((n) => ({ ...n }));
  }

  async insertIfAbsent(n: AppNotification) {
    if (this.items.some((x) => x.userId === n.userId && x.key === n.key))
      return false;
    this.items.push({ ...n });
    return true;
  }

  async markRead(id: string, userId: string, at: string) {
    const n = this.items.find((x) => x.id === id && x.userId === userId);
    if (!n) return false;
    n.readAt ??= at;
    return true;
  }

  async markAllRead(userId: string, at: string) {
    let count = 0;
    for (const n of this.items) {
      if (n.userId === userId && !n.readAt) {
        n.readAt = at;
        count += 1;
      }
    }
    return count;
  }

  async clear() {
    this.items = [];
  }
}
