import { RO_2016 } from '../assessments/assessment.format.js';
import { fullName } from '../cases/case.rules.js';
import type {
  CaseEventType,
  CaseRecord,
  TalkInvitation,
} from '../cases/case.types.js';
import { daysBetween, formatDatePl } from '../cases/dates.js';
import { withAbsenceExtension } from '../cases/absences.rules.js';
import {
  assessmentDueDeadline,
  describeDaysLeft,
  USC,
} from '../cases/deadlines.rules.js';
import { obligatoryGradeFor } from '../cases/obligatory-grade.rules.js';
import { objectionDeadlineOf, stageDeadline } from '../cases/stages.rules.js';
import {
  type ObjectionAddressee,
  objectionAddressee,
} from '../cases/objection-addressee.rules.js';

/**
 * What the scheduler reminds about (use cases "(scheduler) przypomnienie
 * ..."). Pure: from the cases and "today" it returns notification drafts with
 * a deterministic `key`, so running it twice on the same day creates nothing
 * new (the store keeps one notification per user and key).
 */

export const NOTIFICATION_TYPES = [
  'CRITERIA_REMINDER',
  'ASSESSMENT_DUE_SOON',
  'DEADLINE_OVERDUE',
  'OBLIGATORY_GRADE',
  'DUE_DATE_CHANGED',
  'PENDING_ACK',
  'OBJECTION_PERIOD',
  'OBJECTION_PERIOD_ENDED',
  'TALK_INVITATION',
  'POSITION_CHANGE',
  'EVALUATOR_CHANGED',
  'SCHEDULER_RUN',
  'CASE_EVENT',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Who in a case gets it. */
export type Audience = 'EVALUATOR' | 'EMPLOYEE' | 'HR' | 'ADMIN' | 'DIRECTOR';

export interface NotificationDraft {
  key: string;
  audience: Audience;
  caseId: string | null;
  type: NotificationType;
  title: string;
  body: string;
}

/** Days before the assessment due date at which the evaluator is reminded. */
export const DUE_SOON_THRESHOLDS = [30, 14, 7] as const;
/** Days before the opening-talk deadline (§7 rozp. 2016) to remind about criteria. */
export const CRITERIA_REMINDER_DAYS = 14;
/** How long after the objection term (art. 83 ust. 1) its end is still announced. */
export const OBJECTION_ENDED_LOOKBACK_DAYS = 30;

/** The smallest threshold that `daysLeft` already reached; null when none. */
export function dueSoonBucket(daysLeft: number): number | null {
  if (daysLeft < 0) return null;
  const reached = DUE_SOON_THRESHOLDS.filter((t) => daysLeft <= t);
  return reached.length ? Math.min(...reached) : null;
}

const short = (basis: string) => basis.split(/[:;(]/)[0].trim();

function draftsFor(
  base: Omit<NotificationDraft, 'audience' | 'key'> & { key: string },
  audiences: Audience[],
): NotificationDraft[] {
  return audiences.map((audience) => ({ ...base, audience }));
}

export function caseReminders(
  record: CaseRecord,
  today: string,
  previousCase: CaseRecord | null = null,
  addressee: ObjectionAddressee = objectionAddressee(record),
): NotificationDraft[] {
  if (record.nextCaseId) return [];
  const name = fullName(record.person);
  const id = record.id;
  const out: NotificationDraft[] = [];

  if (record.acknowledgedOn) {
    const objection = objectionDeadlineOf(record, today, addressee);
    if (objection?.date && objection.daysLeft !== null) {
      if (objection.daysLeft >= 0) {
        out.push({
          key: `${id}:OBJECTION_OPEN:${objection.date}`,
          audience: 'EMPLOYEE',
          caseId: id,
          type: 'OBJECTION_PERIOD',
          title: 'Biegnie termin na sprzeciw od oceny',
          body: `Od oceny możesz wnieść sprzeciw do ${addressee.to} do ${formatDatePl(objection.date)} (${describeDaysLeft(objection.daysLeft)}; ${addressee.legalBasis}).`,
        });
      } else if (-objection.daysLeft <= OBJECTION_ENDED_LOOKBACK_DAYS) {
        out.push(
          ...draftsFor(
            {
              key: `${id}:OBJECTION_ENDED:${objection.date}`,
              caseId: id,
              type: 'OBJECTION_PERIOD_ENDED',
              title: `Upłynął termin sprzeciwu: ${name}`,
              body: `Termin na wniesienie sprzeciwu od oceny upłynął ${formatDatePl(objection.date)} (art. 83 ust. 1 ${USC}). Bez sprzeciwu ocena jest ostateczna; kolejny cykl oceny rozpoczyna się rozmową rozpoczynającą.`,
            },
            ['EVALUATOR', 'HR', 'EMPLOYEE'],
          ),
        );
      }
    }
    const grade = obligatoryGradeFor(record, previousCase);
    if (grade) {
      out.push(
        ...draftsFor(
          {
            key: `${id}:OBLIGATORY_GRADE`,
            caseId: id,
            type: 'OBLIGATORY_GRADE',
            title: `Obowiązek przyznania kolejnego stopnia służbowego: ${name}`,
            body: `${grade.message} (${grade.legalBasis}).`,
          },
          // the stopień is granted by the dyrektor generalny (art. 89 ust. 2)
          ['HR', 'EVALUATOR', 'DIRECTOR'],
        ),
      );
    }
    return out;
  }

  const stage = record.stage;
  const deadline = stageDeadline(record, stage, today);

  if (deadline?.date && deadline.daysLeft !== null && deadline.daysLeft < 0) {
    out.push(
      ...draftsFor(
        {
          key: `${id}:OVERDUE:${stage}:${deadline.date}`,
          caseId: id,
          type: 'DEADLINE_OVERDUE',
          title: `Przekroczony termin: ${name}`,
          body: `${deadline.label} ${formatDatePl(deadline.date)} – ${describeDaysLeft(deadline.daysLeft)} (${short(deadline.legalBasis)}).`,
        },
        ['EVALUATOR', 'HR'],
      ),
    );
  } else if (deadline?.date && deadline.daysLeft !== null) {
    if (
      (stage === 'SHEET_SELECTION' || stage === 'OPENING_TALK') &&
      deadline.daysLeft <= CRITERIA_REMINDER_DAYS
    ) {
      out.push({
        key: `${id}:CRITERIA:${deadline.date}`,
        audience: 'EVALUATOR',
        caseId: id,
        type: 'CRITERIA_REMINDER',
        title: `Wyznacz kryteria oceny: ${name}`,
        body: `Przeprowadź rozmowę rozpoczynającą i wyznacz kryteria oceny (część I) do ${formatDatePl(deadline.date)} (${describeDaysLeft(deadline.daysLeft)}; §7 ${RO_2016}).`,
      });
      out.push({
        key: `${id}:CRITERIA:${deadline.date}`,
        audience: 'EMPLOYEE',
        caseId: id,
        type: 'CRITERIA_REMINDER',
        title: 'Wkrótce rozmowa rozpoczynająca Twoją ocenę okresową',
        body: `Do ${formatDatePl(deadline.date)} przełożony przeprowadzi z Tobą rozmowę rozpoczynającą: omówicie obowiązki, kryteria oceny i oczekiwania (część I arkusza, §5–§7 ${RO_2016}).`,
      });
    }
    if (
      stage === 'OBSERVATION' ||
      stage === 'ASSESSMENT' ||
      stage === 'SIGNATURE'
    ) {
      const bucket = dueSoonBucket(deadline.daysLeft);
      if (bucket !== null) {
        out.push({
          key: `${id}:DUE:${deadline.date}:${bucket}`,
          audience: 'EVALUATOR',
          caseId: id,
          type: 'ASSESSMENT_DUE_SOON',
          title: `Zbliża się termin oceny: ${name}`,
          body: `Termin sporządzenia oceny: ${formatDatePl(deadline.date)} (${describeDaysLeft(deadline.daysLeft)}). Zaplanuj rozmowę oceniającą (§10 ${RO_2016}).`,
        });
        out.push({
          key: `${id}:DUE:${deadline.date}:${bucket}`,
          audience: 'EMPLOYEE',
          caseId: id,
          type: 'ASSESSMENT_DUE_SOON',
          title: 'Zbliża się termin Twojej oceny okresowej',
          body: `Termin sporządzenia oceny: ${formatDatePl(deadline.date)} (${describeDaysLeft(deadline.daysLeft)}). Oceniający zaprosi Cię na rozmowę oceniającą.`,
        });
      }
    }
  }

  // art. 81 ust. 7: the due date written in part I, extended by long absences.
  if (record.partI.assessmentDue && deadline?.date) {
    const raw = assessmentDueDeadline(
      record.cycleStart,
      record.partI.assessmentDue,
    );
    const extended = withAbsenceExtension(record, raw);
    if (
      (stage === 'OBSERVATION' ||
        stage === 'ASSESSMENT' ||
        stage === 'SIGNATURE') &&
      raw.date &&
      extended.date &&
      extended.date !== raw.date
    ) {
      const what = `Termin sporządzenia oceny przedłużono z ${formatDatePl(raw.date)} do ${formatDatePl(extended.date)} o czas usprawiedliwionej nieobecności trwającej dłużej niż miesiąc (art. 81 ust. 7 ${USC}).`;
      out.push({
        key: `${id}:ABSENCE_EXT:${extended.date}`,
        audience: 'EMPLOYEE',
        caseId: id,
        type: 'DUE_DATE_CHANGED',
        title: 'Zmiana terminu Twojej oceny okresowej',
        body: what,
      });
      out.push(
        ...draftsFor(
          {
            key: `${id}:ABSENCE_EXT:${extended.date}`,
            caseId: id,
            type: 'DUE_DATE_CHANGED',
            title: `Zmiana terminu oceny: ${name}`,
            body: what,
          },
          ['EVALUATOR', 'HR'],
        ),
      );
    }
  }

  if (stage === 'PART_I_ACK') {
    const since = record.completedOn.OPENING_TALK ?? today;
    out.push({
      key: `${id}:ACK_PART_I:${since}`,
      audience: 'EMPLOYEE',
      caseId: id,
      type: 'PENDING_ACK',
      title: 'Potwierdź rozmowę rozpoczynającą (część I)',
      body: `Oceniający potwierdził rozmowę rozpoczynającą ${formatDatePl(since)}. Potwierdź zapoznanie z kryteriami i terminem oceny (§6 ust. 2 ${RO_2016}).`,
    });
  }
  if (stage === 'ACKNOWLEDGEMENT' && record.sentForAckOn) {
    const waiting = daysBetween(record.sentForAckOn, today);
    out.push({
      key: `${id}:ACK:${record.sentForAckOn}`,
      audience: 'EMPLOYEE',
      caseId: id,
      type: 'PENDING_ACK',
      title: 'Zapoznaj się z oceną okresową',
      body: `Ocena została przekazana ${formatDatePl(record.sentForAckOn)}. Zapoznaj się z nią i potwierdź; od tego dnia biegnie 7-dniowy termin na sprzeciw (art. 83 ust. 1 ${USC}).`,
    });
    if (waiting >= 7) {
      out.push({
        key: `${id}:ACK_WAITING:${record.sentForAckOn}`,
        audience: 'EVALUATOR',
        caseId: id,
        type: 'PENDING_ACK',
        title: `Oceniany nie potwierdził zapoznania: ${name}`,
        body: `Ocenę przekazano ${formatDatePl(record.sentForAckOn)} (${waiting} dni temu); oceniany jeszcze nie potwierdził zapoznania się z nią.`,
      });
    }
  }
  return out;
}

/** Every case's reminders for "today". */
export function generateReminders(
  records: readonly CaseRecord[],
  today: string,
  evaluatorName?: (record: CaseRecord) => string,
  addresseeOf?: (record: CaseRecord) => ObjectionAddressee,
): NotificationDraft[] {
  const byNext = new Map(
    records.filter((r) => r.nextCaseId).map((r) => [r.nextCaseId!, r]),
  );
  return records.flatMap((r) => [
    ...caseReminders(r, today, byNext.get(r.id) ?? null, addresseeOf?.(r)),
    ...invitationReminders(r, today, evaluatorName?.(r) ?? 'Oceniający'),
    ...historyEventDrafts(r, today),
  ]);
}

/** Invitations still ahead (or sent in the last week) reach the evaluee. */
export const INVITATION_LOOKBACK_DAYS = 7;

export function invitationReminders(
  record: CaseRecord,
  today: string,
  evaluatorName: string,
): NotificationDraft[] {
  if (record.nextCaseId) return [];
  return (record.talkInvitations ?? [])
    .filter(
      (i) =>
        i.date >= today ||
        daysBetween(i.createdOn, today) <= INVITATION_LOOKBACK_DAYS,
    )
    .map((i) => talkInvitationDraft(record, i, evaluatorName));
}

/** History events (CaseEvent) older than this are not announced any more. */
export const EVENT_LOOKBACK_DAYS = 30;

const EVENT_TITLES: Record<CaseEventType, string> = {
  ACK_FICTION_RECORDED: 'Stwierdzono zapoznanie z oceną (fikcja zapoznania)',
  OBJECTION_FILED: 'Wniesiono sprzeciw od oceny',
  OBJECTION_DISMISSED: 'Sprzeciw nie został uwzględniony',
  OBJECTION_ASSESSMENT_CHANGE: 'Sprzeciw uwzględniony: zmiana oceny',
  OBJECTION_ASSESSMENT_REDO:
    'Sprzeciw uwzględniony: ocena do ponownego sporządzenia',
  DUE_DATE_CHANGE_REQUESTED: 'Wniosek o zmianę terminu oceny',
  DUE_DATE_CHANGE_APPROVED: 'Wniosek o zmianę terminu oceny uwzględniony',
  DUE_DATE_CHANGE_REJECTED: 'Wniosek o zmianę terminu oceny nieuwzględniony',
  DUE_DATE_CHANGE_WITHDRAWN: 'Oceniany wycofał wniosek o zmianę terminu oceny',
  DUE_DATE_CHANGED: 'Zmiana terminu oceny',
  PROMOTION_REQUESTED:
    'Złożono wniosek o przyznanie kolejnego stopnia służbowego',
};

const EVENT_TYPE: Partial<Record<CaseEventType, NotificationType>> = {
  DUE_DATE_CHANGED: 'DUE_DATE_CHANGED',
};

/**
 * Notifications for the domain events written in the case history (who to
 * tell is in `event.notify`). Key = case + history position, so each event
 * is announced once.
 */
export function historyEventDrafts(
  record: CaseRecord,
  today: string,
): NotificationDraft[] {
  const name = fullName(record.person);
  return record.history.flatMap((entry, index) => {
    if (!entry.event) return [];
    if (daysBetween(entry.date, today) > EVENT_LOOKBACK_DAYS) return [];
    const { type, notify } = entry.event;
    return notify.map((party): NotificationDraft => ({
      key: `${record.id}:EVENT:${index}:${type}`,
      audience: party,
      caseId: record.id,
      type: EVENT_TYPE[type] ?? 'CASE_EVENT',
      title:
        party === 'EMPLOYEE'
          ? `${EVENT_TITLES[type]} (Twoja ocena)`
          : `${EVENT_TITLES[type]}: ${name}`,
      body: entry.text,
    }));
  });
}

const TALK_NAMES: Record<TalkInvitation['kind'], string> = {
  OPENING: 'rozmowę rozpoczynającą (ustalenie kryteriów, część I)',
  ASSESSMENT: 'rozmowę oceniającą',
};

export function talkInvitationDraft(
  record: CaseRecord,
  invitation: TalkInvitation,
  evaluatorName: string,
): NotificationDraft {
  return {
    key: `${record.id}:TALK:${invitation.id}`,
    audience: 'EMPLOYEE',
    caseId: record.id,
    type: 'TALK_INVITATION',
    title: `Zaproszenie na ${invitation.kind === 'OPENING' ? 'rozmowę rozpoczynającą' : 'rozmowę oceniającą'}`,
    body: `${evaluatorName} zaprasza Cię na ${TALK_NAMES[invitation.kind]} ${formatDatePl(invitation.date)} o ${invitation.time}, miejsce: ${invitation.place}.${invitation.note ? ` ${invitation.note}` : ''}`,
  };
}

export function talkName(kind: TalkInvitation['kind']): string {
  return TALK_NAMES[kind];
}

/**
 * The evaluator's manual reminder to the assessed person: confirm part I (§6 ust. 2 rozp. 2016) or acknowledge the
 * assessment. One per case, stage and day (the key). Null when nothing waits for the assessed person.
 */
export function manualAckReminder(
  record: CaseRecord,
  today: string,
  evaluatorName: string,
): NotificationDraft | null {
  const id = record.id;
  if (record.stage === 'PART_I_ACK' && !record.partI.acknowledgedByEmployeeOn) {
    return {
      key: `${id}:REMIND_PART_I:${today}`,
      audience: 'EMPLOYEE',
      caseId: id,
      type: 'PENDING_ACK',
      title: 'Przypomnienie: potwierdź część I oceny',
      body: `${evaluatorName} przypomina o potwierdzeniu rozmowy rozpoczynającej oraz zapoznania z kryteriami i terminem oceny (§6 ust. 2 ${RO_2016}).`,
    };
  }
  if (
    record.stage === 'ACKNOWLEDGEMENT' &&
    record.sentForAckOn &&
    !record.acknowledgedOn
  ) {
    return {
      key: `${id}:REMIND_ACK:${today}`,
      audience: 'EMPLOYEE',
      caseId: id,
      type: 'PENDING_ACK',
      title: 'Przypomnienie: zapoznaj się z oceną okresową',
      body: `${evaluatorName} przypomina o zapoznaniu się z oceną przekazaną ${formatDatePl(record.sentForAckOn)} i potwierdzeniu tego na koncie.`,
    };
  }
  return null;
}
