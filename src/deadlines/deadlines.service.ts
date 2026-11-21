import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { isAssessedIn, isEvaluatorOf } from '../auth/case.policy.js';
import { fullName } from '../cases/case.rules.js';
import {
  CaseRuleError,
  CaseValidationError,
} from '../cases/case-rule.error.js';
import type {
  ActorRef,
  CaseDetail,
  CaseRecord,
  DueChangeReason,
  DueDateChange,
  TalkInvitation,
} from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import { formatDatePl } from '../cases/dates.js';
import {
  changeDueDate,
  DUE_CHANGE_MIN_MONTHS,
  DUE_CHANGE_REASONS,
  positionChangeEffect,
  reassignEvaluator,
} from '../cases/due-date-change.rules.js';
import { EVALUATORS } from '../cases/seed/seed.data.js';
import { buildIcs } from '../notifications/ics.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { RemindersService } from '../notifications/reminders.service.js';
import {
  DUE_SOON_THRESHOLDS,
  type NotificationDraft,
  talkInvitationDraft,
  talkName,
} from '../notifications/reminders.rules.js';
import type {
  DueDateChangeInput,
  EvaluatorChangeInput,
  PositionChangeInput,
  TalkInvitationInput,
} from './deadlines.schemas.js';

/** Length of a talk in the calendar file. */
const TALK_MINUTES = 60;

/**
 * Due-date changes, talk invitations, position and evaluator changes. Legal
 * rules live in src/cases/due-date-change.rules.ts; this service checks who
 * may act, saves the case and notifies the people concerned.
 */
@Injectable()
export class DeadlinesService {
  constructor(
    private readonly cases: CasesService,
    private readonly notifications: NotificationsService,
    private readonly reminders: RemindersService,
    private readonly auth: AuthenticationContext,
  ) {}

  rules() {
    return {
      reasons: DUE_CHANGE_REASONS,
      minMonthsSinceLastAssessment: DUE_CHANGE_MIN_MONTHS,
      dueSoonThresholds: DUE_SOON_THRESHOLDS,
    };
  }

  /**
   * The single entry point for changing a case's due date (evaluator, an
   * employee's request accepted by the evaluator, other modules). Saves the
   * case, records the §8 notice and notifies the evaluee, evaluator and HR.
   * Throws 400/409 with a Polish message when not allowed.
   */
  async changeDueDate(
    caseId: string,
    newDate: string,
    reason: DueChangeReason,
    by: ActorRef,
    note?: string,
  ): Promise<DueDateChange> {
    const record = this.cases.record(caseId);
    const { record: next, change } = this.run(() =>
      changeDueDate(record, { newDate, reason, by, note }, this.cases.today),
    );
    this.cases.save(next);
    await this.reminders.deliverFor(next);
    return change;
  }

  async changeDueDateAsEvaluator(
    id: string,
    input: DueDateChangeInput,
  ): Promise<CaseDetail> {
    const record = this.ownCase(id);
    const user = this.auth.requireUser();
    await this.changeDueDate(
      record.id,
      input.date,
      input.reason,
      { name: `${user.firstName} ${user.lastName}`, role: 'Oceniający' },
      input.note,
    );
    return this.cases.view(id);
  }

  async inviteToTalk(
    id: string,
    input: TalkInvitationInput,
  ): Promise<CaseDetail> {
    const record = this.ownCase(id);
    if (input.date < this.cases.today) {
      throw new BadRequestException([
        'Termin rozmowy nie może być z przeszłości.',
      ]);
    }
    const next = structuredClone(record);
    const list = next.talkInvitations ?? [];
    const invitation: TalkInvitation = {
      id: `${record.id}-talk-${list.length + 1}`,
      kind: input.kind,
      date: input.date,
      time: input.time,
      place: input.place,
      note: input.note ?? '',
      createdOn: this.cases.today,
    };
    next.talkInvitations = [...list, invitation];
    next.history.push({
      date: this.cases.today,
      text: `Zaproszono ocenianego na ${talkName(input.kind)}: ${formatDatePl(input.date)}, godz. ${input.time}, ${input.place}.`,
    });
    this.cases.save(next);
    await this.notify([
      talkInvitationDraft(next, invitation, this.cases.evaluatorName(next)),
    ]);
    return this.cases.view(id);
  }

  /** The .ics file of an invitation: the evaluator and the evaluee only. */
  invitationIcs(id: string, invitationId: string): string {
    const record = this.cases.record(id);
    const user = this.auth.requireUser();
    if (!isEvaluatorOf(user, record) && !isAssessedIn(user, record)) {
      throw new ForbiddenException('To zaproszenie nie dotyczy Ciebie.');
    }
    const inv = record.talkInvitations?.find((i) => i.id === invitationId);
    if (!inv) throw new NotFoundException('Nie znaleziono zaproszenia.');
    return buildIcs({
      uid: `${inv.id}@cyfrowy-asystent`,
      date: inv.date,
      time: inv.time,
      durationMinutes: TALK_MINUTES,
      summary: `Ocena okresowa: ${talkName(inv.kind)}`,
      location: inv.place,
      description: `Oceniający: ${this.cases.evaluatorName(record)}. Oceniany: ${fullName(record.person)}.${inv.note ? ` ${inv.note}` : ''}`,
      stamp: new Date().toISOString(),
    });
  }

  /** §9 rozp. 2016: records the change of position and what follows from it. */
  async positionChange(
    id: string,
    input: PositionChangeInput,
  ): Promise<CaseDetail> {
    const user = this.auth.requireUser();
    const record = this.cases.record(id);
    if (user.role !== 'HR' && !isEvaluatorOf(user, record)) {
      throw new ForbiddenException(
        'Zmianę stanowiska wprowadza oceniający albo kadry (HR).',
      );
    }
    if (record.signedByEvaluatorOn) {
      throw new ConflictException('Ocena została już podpisana.');
    }
    const today = this.cases.today;
    const effect = positionChangeEffect(record, input.date);
    const next = structuredClone(record);
    const list = next.positionChanges ?? [];
    next.positionChanges = [
      ...list,
      {
        ...effect,
        id: `${record.id}-pos-${list.length + 1}`,
        recordedOn: today,
      },
    ];
    next.history.push({
      date: today,
      text: `Zmiana stanowiska pracy z istotną zmianą zakresu obowiązków od ${formatDatePl(input.date)}. ${effect.message} (${effect.legalBasis}).`,
    });
    this.cases.save(next);
    const drafts: NotificationDraft[] = (
      ['EVALUATOR', 'EMPLOYEE', 'HR'] as const
    ).map((audience) => ({
      key: `${record.id}:POSITION:${input.date}`,
      audience,
      caseId: record.id,
      type: 'POSITION_CHANGE',
      title: `Zmiana stanowiska: ${fullName(record.person)}`,
      body: `${effect.message} (${effect.legalBasis}).`,
    }));
    await this.notify(drafts);
    if (
      effect.effect === 'ASSESSMENT' &&
      effect.deadline !== next.partI.assessmentDue
    ) {
      try {
        await this.changeDueDate(
          id,
          effect.deadline,
          'POSITION_CHANGE',
          {
            name: `${user.firstName} ${user.lastName}`,
            role: user.role === 'HR' ? 'Kadry (HR)' : 'Oceniający',
          },
          effect.message,
        );
      } catch {
        // e.g. no due date yet: the position change itself is recorded.
      }
    }
    return this.cases.view(id);
  }

  /** §9 ust. 3 rozp. 2016: HR assigns another evaluator; criteria stay. */
  async changeEvaluator(
    id: string,
    input: EvaluatorChangeInput,
  ): Promise<CaseDetail> {
    const record = this.cases.record(id);
    const evaluator = EVALUATORS.find((e) => e.id === input.evaluatorId);
    if (!evaluator) {
      throw new BadRequestException([
        `Nie ma oceniającego „${input.evaluatorId}”.`,
      ]);
    }
    const next = this.run(() =>
      reassignEvaluator(
        record,
        evaluator.id,
        fullName(evaluator),
        this.cases.today,
      ),
    );
    this.cases.save(next);
    await this.notify(
      (['EVALUATOR', 'EMPLOYEE'] as const).map((audience) => ({
        key: `${id}:EVALUATOR:${evaluator.id}:${this.cases.today}`,
        audience,
        caseId: id,
        type: 'EVALUATOR_CHANGED',
        title: `Zmiana oceniającego: ${fullName(record.person)}`,
        body: `Ocenę sporządzi ${fullName(evaluator)}, na podstawie wybranych wcześniej kryteriów (§9 ust. 3 rozp. PRM z 4.04.2016). Nowy oceniający może zmienić termin oceny (art. 81 ust. 8 pkt 1 ustawy o służbie cywilnej).`,
      })),
    );
    return this.cases.view(id);
  }

  evaluators() {
    return EVALUATORS.map((e) => ({
      id: e.id,
      name: fullName(e),
      unit: e.unit,
    }));
  }

  private ownCase(id: string): CaseRecord {
    const record = this.cases.record(id);
    if (!isEvaluatorOf(this.auth.requireUser(), record)) {
      throw new ForbiddenException(
        'Tę czynność wykonuje oceniający w tej sprawie.',
      );
    }
    return record;
  }

  private notify(drafts: NotificationDraft[]) {
    return this.notifications.deliver(
      drafts,
      (caseId) => this.cases.all().find((c) => c.id === caseId) ?? null,
      this.cases.today,
    );
  }

  private run<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof CaseRuleError)
        throw new ConflictException(error.message);
      if (error instanceof CaseValidationError) {
        throw new BadRequestException(error.messages);
      }
      throw error;
    }
  }
}
