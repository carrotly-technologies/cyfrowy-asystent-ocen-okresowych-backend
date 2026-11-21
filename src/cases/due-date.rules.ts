import { CaseRuleError } from './case-rule.error.js';
import type { ActorRef, CaseRecord, DueDateRequest } from './case.types.js';
import { addMonths, formatDatePl } from './dates.js';
import { USC } from './deadlines.rules.js';
import { changeDueDate as changeDueDateByRule } from './due-date-change.rules.js';

/**
 * Change of the assessment due date ("termin oceny", art. 81 ust. 8 ustawy)
 * and the assessed person's request for it (ust. 8 pkt 4). Pure functions:
 * each returns an updated copy or throws CaseRuleError (409).
 */

/** Months that must have passed for a request (art. 81 ust. 8 in fine). */
export const DUE_DATE_REQUEST_MIN_MONTHS = 6;
export const DUE_DATE_REQUEST_BASIS = `art. 81 ust. 8 pkt 4 ${USC}`;

export interface DueDateRequestRule {
  eligible: boolean;
  reason: string;
  legalBasis: string;
}

/** Why the due date cannot be changed at all now, or null. */
function changeBlocker(record: CaseRecord): string | null {
  if (record.cycleStart.kind === 'PREVIOUS_NEGATIVE') {
    return `Po ocenie negatywnej termin ponownej oceny wynika z ustawy (po upływie 6 miesięcy od zapoznania, art. 81 ust. 9 ${USC}) i nie podlega zmianie.`;
  }
  if (record.signedByEvaluatorOn) {
    return `Ocena została już sporządzona (${formatDatePl(record.signedByEvaluatorOn)}), więc jej termin nie może się zmienić.`;
  }
  if (!record.partI.assessmentDue) {
    return 'Termin oceny nie został jeszcze ustalony (ustala go oceniający przy wyborze arkusza, część I).';
  }
  return null;
}

/**
 * Whether the assessed person may file a request now: more than 6 months
 * since the last periodic assessment was made, or, for a first assessment,
 * an assessment period longer than 6 months (from the start of employment).
 */
export function dueDateRequestRule(
  record: CaseRecord,
  today: string,
): DueDateRequestRule {
  const legalBasis = DUE_DATE_REQUEST_BASIS;
  const blocked = changeBlocker(record);
  if (blocked) return { eligible: false, reason: blocked, legalBasis };
  const pending = pendingDueDateRequest(record);
  if (pending) {
    return {
      eligible: false,
      reason: `Twój wniosek z ${formatDatePl(pending.filedOn)} czeka na rozpatrzenie przez oceniającego.`,
      legalBasis,
    };
  }
  const first = record.cycleStart.kind === 'HIRED';
  const anchor =
    record.cycleStart.kind === 'HIRED'
      ? record.cycleStart.date
      : record.cycleStart.assessedOn;
  const from = first
    ? `początku okresu podlegającego ocenie (${formatDatePl(anchor)})`
    : `sporządzenia ostatniej oceny okresowej (${formatDatePl(anchor)})`;
  const sixMonthsEnd = addMonths(anchor, DUE_DATE_REQUEST_MIN_MONTHS);
  if (today <= sixMonthsEnd) {
    return {
      eligible: false,
      reason: `Wniosek można złożyć, gdy od ${from} upłynie więcej niż 6 miesięcy, czyli od ${formatDatePl(addOneDay(sixMonthsEnd))}.`,
      legalBasis,
    };
  }
  return {
    eligible: true,
    reason: `Od ${from} upłynęło więcej niż 6 miesięcy, więc możesz wnioskować o zmianę terminu oceny.`,
    legalBasis,
  };
}

function addOneDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function pendingDueDateRequest(
  record: CaseRecord,
): DueDateRequest | undefined {
  return (record.dueDateRequests ?? []).find((r) => r.status === 'PENDING');
}

/**
 * Moves "termin sporządzenia oceny" on the assessed person's request (art. 81
 * ust. 8 pkt 4) through the single changeDueDate of due-date-change.rules.ts
 * (6-month condition, §8 notice, history event).
 */
export function changeDueDate(
  record: CaseRecord,
  newDate: string,
  reason: string,
  by: ActorRef,
  today: string,
): CaseRecord {
  return changeDueDateByRule(
    record,
    { newDate, reason: 'EVALUEE_REQUEST', by, note: reason },
    today,
  ).record;
}

export function fileDueDateRequest(
  record: CaseRecord,
  input: { reason: string; proposedDate?: string | null },
  today: string,
): CaseRecord {
  const rule = dueDateRequestRule(record, today);
  if (!rule.eligible) {
    throw new CaseRuleError(
      `Nie można złożyć wniosku o zmianę terminu oceny. ${rule.reason}`,
    );
  }
  const next = structuredClone(record);
  const requests = next.dueDateRequests ?? [];
  const request: DueDateRequest = {
    id: `${record.id}-ddr-${requests.length + 1}`,
    filedOn: today,
    reason: input.reason,
    proposedDate: input.proposedDate ?? null,
    status: 'PENDING',
    decidedOn: null,
    decisionNote: null,
    newDate: null,
    decidedBy: null,
  };
  next.dueDateRequests = [...requests, request];
  next.history.push({
    date: today,
    text: `Oceniany złożył wniosek o zmianę terminu oceny${request.proposedDate ? ` (proponowany termin: ${formatDatePl(request.proposedDate)})` : ''}. Uzasadnienie: ${input.reason} (${DUE_DATE_REQUEST_BASIS}).`,
    event: { type: 'DUE_DATE_CHANGE_REQUESTED', notify: ['EVALUATOR'] },
  });
  return next;
}

export function decideDueDateRequest(
  record: CaseRecord,
  input: { approve: boolean; newDate?: string | null; note?: string | null },
  by: ActorRef,
  today: string,
): CaseRecord {
  const pending = pendingDueDateRequest(record);
  if (!pending) {
    throw new CaseRuleError(
      'W tej sprawie nie ma wniosku o zmianę terminu oceny czekającego na rozpatrzenie.',
    );
  }
  const note = input.note?.trim() || null;
  let next = structuredClone(record);
  if (input.approve) {
    const newDate = input.newDate ?? pending.proposedDate;
    if (!newDate) {
      throw new CaseRuleError(
        'Uwzględniając wniosek, podaj nowy termin oceny.',
      );
    }
    next = changeDueDate(
      next,
      newDate,
      `wniosek ocenianego z ${formatDatePl(pending.filedOn)}${note ? `; ${note}` : ''}`,
      by,
      today,
    );
    setDecision(next, pending.id, {
      status: 'APPROVED',
      decidedOn: today,
      decisionNote: note,
      newDate,
      decidedBy: by,
    });
    next.history.push({
      date: today,
      text: `Oceniający uwzględnił wniosek ocenianego o zmianę terminu oceny; nowy termin: ${formatDatePl(newDate)}.`,
      event: { type: 'DUE_DATE_CHANGE_APPROVED', notify: ['EMPLOYEE', 'HR'] },
    });
  } else {
    if (!note) {
      throw new CaseRuleError(
        'Odmawiając zmiany terminu, podaj uzasadnienie dla ocenianego.',
      );
    }
    setDecision(next, pending.id, {
      status: 'REJECTED',
      decidedOn: today,
      decisionNote: note,
      newDate: null,
      decidedBy: by,
    });
    next.history.push({
      date: today,
      text: `Oceniający nie uwzględnił wniosku ocenianego o zmianę terminu oceny. Uzasadnienie: ${note}. Termin bez zmian: ${formatDatePl(next.partI.assessmentDue!)}.`,
      event: { type: 'DUE_DATE_CHANGE_REJECTED', notify: ['EMPLOYEE'] },
    });
  }
  return next;
}

function setDecision(
  record: CaseRecord,
  id: string,
  decision: Partial<DueDateRequest>,
): void {
  record.dueDateRequests = (record.dueDateRequests ?? []).map((r) =>
    r.id === id ? { ...r, ...decision } : r,
  );
}
