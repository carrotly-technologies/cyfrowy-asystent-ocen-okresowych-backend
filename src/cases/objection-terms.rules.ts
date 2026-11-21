import type {
  CaseRecord,
  CaseStatus,
  Deadline,
  Objection,
  ObjectionView,
} from './case.types.js';
import { daysTermEnd, formatDatePl, shiftToWorkingDay } from './dates.js';
import { type DeadlineSpec, toDeadline, USC } from './deadlines.rules.js';

/**
 * Terms and status of the objection path (sprzeciw, art. 83 ustawy), without
 * transitions, so stage/status rules can use them without import cycles.
 */

/** Sprzeciw rozpatruje się w terminie 14 dni od dnia wniesienia (art. 83 ust. 3). */
export const OBJECTION_DECISION_DAYS = 14;
/** Odwołanie do sądu pracy w terminie 14 dni (art. 83 ust. 5). */
export const COURT_APPEAL_DAYS = 14;

/** A term of `days` days ending on a working day (art. 111, 115 KC). */
export function daysTerm(
  start: string,
  days: number,
  label: string,
  legalBasis: string,
): DeadlineSpec {
  const raw = daysTermEnd(start, days);
  const date = shiftToWorkingDay(raw);
  return {
    date,
    label,
    legalBasis:
      date === raw
        ? legalBasis
        : `${legalBasis}; termin przypadał na dzień wolny od pracy (${formatDatePl(raw)}), więc upływa w najbliższy dzień roboczy (art. 115 KC)`,
  };
}

export function objectionDecisionDeadline(filedOn: string): DeadlineSpec {
  return daysTerm(
    filedOn,
    OBJECTION_DECISION_DAYS,
    'Termin rozpatrzenia sprzeciwu przez dyrektora generalnego',
    `art. 83 ust. 3 ${USC}: 14 dni od dnia wniesienia sprzeciwu`,
  );
}

/**
 * Labour court: 14 days from the delivery of the decision dismissing the
 * objection, or from the end of the 14-day decision term when the objection
 * was not decided in time (art. 83 ust. 5).
 */
export function courtAppealDeadline(
  objection: Objection,
  today: string,
): DeadlineSpec | null {
  const label = 'Termin na odwołanie do sądu pracy';
  const decision = objection.decision;
  if (decision?.outcome === 'DISMISS') {
    return daysTerm(
      decision.decidedOn,
      COURT_APPEAL_DAYS,
      label,
      `art. 83 ust. 5 ${USC}: 14 dni od doręczenia rozstrzygnięcia o nieuwzględnieniu sprzeciwu`,
    );
  }
  if (!decision) {
    const term = objectionDecisionDeadline(objection.filedOn).date!;
    if (today <= term) return null;
    return daysTerm(
      term,
      COURT_APPEAL_DAYS,
      label,
      `art. 83 ust. 5 ${USC}: 14 dni od upływu terminu na rozpatrzenie sprzeciwu`,
    );
  }
  return null;
}

/** Which assessment is current: 1, then +1 after each change or re-making. */
export function currentRound(record: CaseRecord): number {
  return (record.assessmentVersions?.length ?? 0) + 1;
}

export function currentObjection(record: CaseRecord): Objection | undefined {
  const round = currentRound(record);
  return (record.objections ?? []).find((o) => o.round === round);
}

export function pendingObjection(record: CaseRecord): Objection | undefined {
  const objection = currentObjection(record);
  return objection && !objection.decision ? objection : undefined;
}

/**
 * Status override of the objection path: pending → SPRZECIW_W_ROZPATRZENIU,
 * dismissed → ZAKONCZONA; null when the usual status applies.
 */
export function appealStatus(record: CaseRecord): CaseStatus | null {
  const objection = currentObjection(record);
  if (!objection) return null;
  if (!objection.decision) return 'SPRZECIW_W_ROZPATRZENIU';
  return objection.decision.outcome === 'DISMISS' ? 'ZAKONCZONA' : null;
}

/** The deadline that matters while an objection is pending, else null. */
export function appealNextDeadline(
  record: CaseRecord,
  today: string,
): Deadline | null {
  const pending = pendingObjection(record);
  return pending
    ? toDeadline(objectionDecisionDeadline(pending.filedOn), today)
    : null;
}

export function objectionViews(
  record: CaseRecord,
  today: string,
): ObjectionView[] {
  return (record.objections ?? []).map((o) => {
    const court = courtAppealDeadline(o, today);
    return {
      ...o,
      decisionDeadline: toDeadline(objectionDecisionDeadline(o.filedOn), today),
      courtAppealDeadline: court ? toDeadline(court, today) : null,
    };
  });
}
