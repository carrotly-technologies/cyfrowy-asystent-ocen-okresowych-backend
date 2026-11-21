import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthenticationContext } from '@nestjs/authentication';
import type { User } from '../auth/user.types.js';
import { UsersRepository } from '../auth/users.repository.js';
import type { CaseRecord } from '../cases/case.types.js';
import { Mailer } from './mailer.js';
import type { AppNotification } from './notification.types.js';
import { NotificationsRepository } from './notifications.repository.js';
import type { Audience, NotificationDraft } from './reminders.rules.js';

/** Who in a case is meant by an audience. */
export function recipientsOf(
  users: readonly User[],
  audience: Audience,
  record: CaseRecord | null,
): User[] {
  return users.filter((u) => {
    switch (audience) {
      case 'EVALUATOR':
        return (
          u.role === 'SUPERVISOR' &&
          !!record &&
          u.evaluatorId === record.evaluatorId
        );
      case 'EMPLOYEE':
        return (
          u.role === 'EMPLOYEE' && !!record && u.personId === record.person.id
        );
      case 'HR':
        return u.role === 'HR';
      case 'ADMIN':
        return u.role === 'ADMIN';
      case 'DIRECTOR':
        return u.role === 'DIRECTOR';
    }
  });
}

/** The in-app inbox of every user, plus an optional e-mail copy. */
@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationsRepository)
    private readonly repo: NotificationsRepository,
    private readonly users: UsersRepository,
    private readonly auth: AuthenticationContext,
    private readonly mailer: Mailer,
  ) {}

  /**
   * Stores the drafts for their recipients; a (user, key) pair that already
   * exists is skipped, so delivering the same drafts again creates nothing.
   * Returns how many notifications were created.
   */
  async deliver(
    drafts: readonly NotificationDraft[],
    caseOf: (id: string) => CaseRecord | null,
    today: string,
  ): Promise<number> {
    const users = await this.users.list();
    let created = 0;
    for (const draft of drafts) {
      const record = draft.caseId ? caseOf(draft.caseId) : null;
      for (const user of recipientsOf(users, draft.audience, record)) {
        const inserted = await this.repo.insertIfAbsent({
          id: randomUUID(),
          userId: user.id,
          key: draft.key,
          caseId: draft.caseId,
          type: draft.type,
          title: draft.title,
          body: draft.body,
          createdOn: today,
          createdAt: new Date().toISOString(),
          readAt: null,
        });
        if (!inserted) continue;
        created += 1;
        if (user.email) {
          await this.mailer.send(user.email, draft.title, draft.body);
        }
      }
    }
    return created;
  }

  async mine(): Promise<{ items: AppNotification[]; unread: number }> {
    const items = await this.repo.listForUser(this.auth.requireUser().id);
    return { items, unread: items.filter((n) => !n.readAt).length };
  }

  async markRead(id: string): Promise<void> {
    const ok = await this.repo.markRead(
      id,
      this.auth.requireUser().id,
      new Date().toISOString(),
    );
    if (!ok) throw new NotFoundException('Nie znaleziono powiadomienia.');
  }

  async markAllRead(): Promise<number> {
    return this.repo.markAllRead(
      this.auth.requireUser().id,
      new Date().toISOString(),
    );
  }

  clear(): Promise<void> {
    return this.repo.clear();
  }

  get emailEnabled(): boolean {
    return this.mailer.enabled;
  }
}
