import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CaseRecord } from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import { formatDatePl } from '../cases/dates.js';
import { DemoReset } from '../demo/demo-reset.service.js';
import { NotificationsService } from './notifications.service.js';
import {
  caseReminders,
  generateReminders,
  historyEventDrafts,
  invitationReminders,
  type NotificationDraft,
} from './reminders.rules.js';

export interface RemindersRun {
  today: string;
  created: number;
}

/**
 * The scheduler: at startup and then every REMINDERS_INTERVAL_MINUTES (60 by
 * default, 0 = only at startup and on demand) it applies absence extensions
 * of due dates and turns the reminders of reminders.rules.ts into
 * notifications. "Today" is DEMO_TODAY. Idempotent: a run on the same day
 * creates only what is new. POST /api/notifications/run starts it by hand.
 */
@Injectable()
export class RemindersService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RemindersService.name);
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<RemindersRun> | null = null;

  constructor(
    private readonly cases: CasesService,
    private readonly notifications: NotificationsService,
    private readonly demoReset: DemoReset,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Every saved change of a case (workflow action, objection, due-date
    // change...) notifies at once about what is new for that case.
    this.cases.onSave((record) => void this.deliverFor(record));
    this.demoReset.register(async () => {
      await this.notifications.clear();
      await this.run();
    });
    await this.run();
    const minutes = Number(
      this.config.get<string>('REMINDERS_INTERVAL_MINUTES') ?? 60,
    );
    if (Number.isFinite(minutes) && minutes > 0) {
      this.timer = setInterval(() => void this.run(), minutes * 60_000);
      this.timer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Notifications that follow from one case's current state and its history
   * events (idempotent, so it can be called after any change).
   */
  async deliverFor(record: CaseRecord): Promise<number> {
    const today = this.cases.today;
    const previous =
      this.cases.all().find((c) => c.nextCaseId === record.id) ?? null;
    const drafts = [
      ...caseReminders(record, today, previous),
      ...invitationReminders(record, today, this.cases.evaluatorName(record)),
      ...historyEventDrafts(record, today),
    ];
    try {
      return await this.notifications.deliver(drafts, () => record, today);
    } catch {
      this.logger.warn('Nie udało się zapisać powiadomień o zmianie sprawy.');
      return 0;
    }
  }

  /** One run at a time; a call during a run waits for it. */
  run(): Promise<RemindersRun> {
    this.running ??= this.runOnce().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async runOnce(): Promise<RemindersRun> {
    const today = this.cases.today;
    const drafts: NotificationDraft[] = [];
    drafts.push(
      ...generateReminders(this.cases.all(), today, (r) =>
        this.cases.evaluatorName(r),
      ),
    );
    const caseOf = (id: string) =>
      this.cases.all().find((c) => c.id === id) ?? null;
    let created = await this.notifications.deliver(drafts, caseOf, today);
    if (created > 0) {
      created += await this.notifications.deliver(
        [
          {
            key: `SCHEDULER_RUN:${today}`,
            audience: 'ADMIN',
            caseId: null,
            type: 'SCHEDULER_RUN',
            title: 'Harmonogram przypomnień uruchomiony',
            body: `Przebieg z dnia ${formatDatePl(today)}: utworzono ${created} powiadomień. E-mail: ${this.notifications.emailEnabled ? 'włączony (SMTP)' : 'wyłączony (brak SMTP_HOST)'}.`,
          },
        ],
        caseOf,
        today,
      );
    }
    this.logger.log(`Przypomnienia: utworzono ${created}.`);
    return { today, created };
  }
}
