import type {
  ActorRef,
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
    'Termin rozpatrzenia sprzeciwu',
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
    // art. 83 ust. 5: from the delivery of the decision (default: its date).
    return daysTerm(
      decision.deliveredOn ?? decision.decidedOn,
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

// --- Is there a right to a sprzeciw from the current assessment? -------------

/**
 * art. 83 ust. 4: an upheld objection ends with the assessment changed or made
 * a second time; a sprzeciw lies only from the one made a second time. So the
 * current assessment, once changed after an objection, has no objection path.
 */
export function assessmentChangedAfterObjection(record: CaseRecord): boolean {
  return record.assessmentVersions?.at(-1)?.status === 'CHANGED';
}

export interface ObjectionRight {
  /** false: no sprzeciw lies from the current assessment (it was changed). */
  open: boolean;
  /** Why not, in plain words for the assessed person; null when open. */
  note: string | null;
  legalBasis: string;
}

/** The single rule behind FILE_OBJECTION, the objection term, status and texts. */
export function objectionRight(record: CaseRecord): ObjectionRight {
  if (assessmentChangedAfterObjection(record)) {
    return {
      open: false,
      note: `Ocena została zmieniona w wyniku uwzględnienia sprzeciwu. Od zmienionej oceny nie przysługuje kolejny sprzeciw. Odwołanie do sądu pracy (art. 83 ust. 5) ustawa wiąże z nieuwzględnieniem sprzeciwu albo jego nierozpatrzeniem w terminie; w razie wątpliwości co do dalszych kroków skontaktuj się z komórką kadr.`,
      legalBasis: `art. 83 ust. 4–5 ${USC}`,
    };
  }
  return {
    open: true,
    note: null,
    legalBasis: `art. 83 ust. 1 ${USC}`,
  };
}

// --- The decision of the objection as the evaluator must see it --------------

export interface ObjectionDecisionNotice {
  outcome: 'CHANGE' | 'REDO';
  decidedOn: string;
  decidedBy: ActorRef;
  reason: string;
  title: string;
  text: string;
  /** CHANGE: partial scores set by the decision (criterion id → before/after). */
  changes: { criterionId: string; from: number | null; to: number }[];
  legalBasis: string;
}

/**
 * The upheld objection that produced the current assessment (CHANGE / REDO of
 * the previous round), for the banner on the case; null otherwise.
 * `who`: nominative of the decider ("Dyrektor generalny urzędu").
 */
export function objectionDecisionNotice(
  record: CaseRecord,
  who: string,
): ObjectionDecisionNotice | null {
  const version = record.assessmentVersions?.at(-1);
  if (!version) return null;
  const objection = (record.objections ?? []).find(
    (o) => o.round === version.round,
  );
  const decision = objection?.decision;
  if (!decision || decision.outcome === 'DISMISS') return null;
  const base = {
    decidedOn: decision.decidedOn,
    decidedBy: decision.decidedBy,
    reason: decision.reason,
    legalBasis: `art. 83 ust. 4 ${USC}`,
  };
  if (decision.outcome === 'CHANGE') {
    const changes = Object.entries(record.decisions)
      .filter(([id, to]) => version.decisions[id] !== to)
      .map(([criterionId, to]) => ({
        criterionId,
        from: version.decisions[criterionId] ?? null,
        to,
      }));
    return {
      ...base,
      outcome: 'CHANGE',
      title: `${who} uwzględnił sprzeciw i zmienił ocenę (${formatDatePl(decision.decidedOn)})`,
      text: 'Oceny cząstkowe ustalone w rozstrzygnięciu sprzeciwu wiążą: części II i III nie można już zmieniać. Oceniający podpisuje zmienioną ocenę i ponownie przekazuje ją ocenianemu do zapoznania. Od zmienionej oceny nie przysługuje kolejny sprzeciw.',
      changes,
    };
  }
  return {
    ...base,
    outcome: 'REDO',
    title: `${who} uwzględnił sprzeciw i polecił ponowne sporządzenie oceny (${formatDatePl(decision.decidedOn)})`,
    text: 'Dotychczasowa ocena została anulowana. Oceniający przeprowadza ponownie rozmowę oceniającą, sporządza ocenę, podpisuje ją i przekazuje ocenianemu. Od oceny sporządzonej po raz drugi przysługuje sprzeciw.',
    changes: [],
    legalBasis: `art. 83 ust. 4 ${USC}`,
  };
}
