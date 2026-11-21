import { RO_2016 } from '../assessments/assessment.format.js';
import { applyAction } from './actions.rules.js';
import { computeEvaluation } from './case.rules.js';
import { CaseRuleError } from './case-rule.error.js';
import type {
  ActorRef,
  AssessmentVersion,
  CaseRecord,
  Objection,
  ObjectionOutcome,
} from './case.types.js';
import { formatDatePl, isIsoDate } from './dates.js';
import { objectionDeadline, USC } from './deadlines.rules.js';
import {
  COURT_APPEAL_DAYS,
  currentObjection,
  currentRound,
  daysTerm,
  objectionDecisionDeadline,
  pendingObjection,
} from './objection-terms.rules.js';
import { applyPatch } from './patch.rules.js';
import { dueDateRequestRule, pendingDueDateRequest } from './due-date.rules.js';

export * from './objection-terms.rules.js';

/**
 * After the assessment is handed over: "fikcja zapoznania", the objection
 * (sprzeciw, art. 83 ustawy) and the decision of the dyrektor generalny.
 * Pure functions: each returns an updated copy or throws CaseRuleError (409).
 */

// --- Fikcja zapoznania -------------------------------------------------------

/** Why the fiction of acknowledgement cannot be recorded now, or null. */
export function ackFictionBlocker(record: CaseRecord): string | null {
  if (record.acknowledgedOn) {
    return `Zapoznanie z oceną jest już odnotowane (${formatDatePl(record.acknowledgedOn)}).`;
  }
  if (record.stage !== 'ACKNOWLEDGEMENT' || !record.sentForAckOn) {
    return 'Fikcję zapoznania odnotowuje się dopiero po podpisaniu oceny i przekazaniu jej ocenianemu.';
  }
  return null;
}

export function recordAckFiction(
  record: CaseRecord,
  input: { date: string; reason: string },
  by: ActorRef,
  today: string,
): CaseRecord {
  const blocked = ackFictionBlocker(record);
  if (blocked) {
    throw new CaseRuleError(
      `Nie można odnotować fikcji zapoznania. ${blocked}`,
    );
  }
  if (!isIsoDate(input.date)) {
    throw new CaseRuleError(
      'Data doręczenia oceny musi mieć format RRRR-MM-DD.',
    );
  }
  if (input.date > today || input.date < record.sentForAckOn!) {
    throw new CaseRuleError(
      `Data, w której ocena dotarła do ocenianego, musi przypadać między przekazaniem oceny (${formatDatePl(record.sentForAckOn!)}) a dniem dzisiejszym (${formatDatePl(today)}).`,
    );
  }
  // Same effects as the assessed person's own confirmation, dated `date`.
  const next = applyAction(record, 'EMPLOYEE_ACK_ASSESSMENT', input.date);
  next.ackFiction = {
    date: input.date,
    reason: input.reason,
    recordedOn: today,
    recordedBy: by,
  };
  const objection = objectionDeadline(input.date);
  next.history.push({
    date: today,
    text: `Stwierdzono fikcję zapoznania z oceną (${by.name}, ${by.role}): ocena dotarła do ocenianego ${formatDatePl(input.date)}, ale nie mógł lub nie chciał potwierdzić zapoznania. Powód: ${sentence(input.reason)} Termin na sprzeciw biegnie do ${formatDatePl(objection.date!)} (art. 83 ust. 1 ${USC}).`,
    event: {
      type: 'ACK_FICTION_RECORDED',
      notify: ['EMPLOYEE', 'EVALUATOR', 'HR'],
    },
  });
  return next;
}

// --- Sprzeciw ------------------------------------------------------------------

/** Why the assessed person cannot file an objection now, or null. */
export function objectionBlocker(
  record: CaseRecord,
  today: string,
): string | null {
  if (!record.acknowledgedOn) {
    return 'Sprzeciw wnosi się po zapoznaniu się z oceną (art. 83 ust. 1 ustawy o służbie cywilnej).';
  }
  const existing = currentObjection(record);
  if (existing) {
    return `Sprzeciw od tej oceny został już wniesiony ${formatDatePl(existing.filedOn)}.`;
  }
  const versions = record.assessmentVersions ?? [];
  if (versions.at(-1)?.status === 'CHANGED') {
    return `Ocena została zmieniona w wyniku uwzględnienia sprzeciwu; ponowny sprzeciw przysługuje od oceny sporządzonej po raz drugi (art. 83 ust. 4 ${USC}).`;
  }
  const deadline = objectionDeadline(record.acknowledgedOn).date!;
  if (today > deadline) {
    return `Termin na sprzeciw upłynął ${formatDatePl(deadline)} (7 dni od zapoznania się z oceną, art. 83 ust. 1 ${USC}).`;
  }
  return null;
}

export function fileObjection(
  record: CaseRecord,
  text: string,
  today: string,
): CaseRecord {
  const blocked = objectionBlocker(record, today);
  if (blocked)
    throw new CaseRuleError(`Nie można wnieść sprzeciwu. ${blocked}`);
  const next = structuredClone(record);
  const objections = next.objections ?? [];
  const objection: Objection = {
    id: `${record.id}-obj-${objections.length + 1}`,
    round: currentRound(record),
    filedOn: today,
    text,
    decision: null,
  };
  next.objections = [...objections, objection];
  const due = objectionDecisionDeadline(today).date!;
  next.history.push({
    date: today,
    text: `Oceniany wniósł sprzeciw od oceny do dyrektora generalnego urzędu (art. 83 ust. 1 ${USC}). Sprzeciw rozpatruje się do ${formatDatePl(due)} (14 dni, art. 83 ust. 3).`,
    event: { type: 'OBJECTION_FILED', notify: ['DIRECTOR', 'EVALUATOR', 'HR'] },
  });
  return next;
}

export interface ObjectionDecisionInput {
  outcome: ObjectionOutcome;
  reason: string;
  /** CHANGE only: new partial scores (criterion id → points). */
  decisions?: Record<string, number>;
  /** CHANGE only: new justification. */
  justification?: string;
}

/** Snapshot of the current assessment before it is replaced. */
function snapshot(
  record: CaseRecord,
  status: AssessmentVersion['status'],
  reason: string,
  today: string,
): AssessmentVersion {
  const evaluation = computeEvaluation(record, today);
  return {
    round: currentRound(record),
    status,
    closedOn: today,
    reason,
    decisions: { ...record.decisions },
    justification: record.justification,
    iprz: record.iprz,
    result: evaluation?.result ?? null,
    average: evaluation?.average ?? null,
    signedByEvaluatorOn: record.signedByEvaluatorOn,
    acknowledgedOn: record.acknowledgedOn,
    ackFiction: record.ackFiction ?? null,
  };
}

export function decideObjection(
  record: CaseRecord,
  input: ObjectionDecisionInput,
  by: ActorRef,
  today: string,
): CaseRecord {
  const pending = pendingObjection(record);
  if (!pending) {
    throw new CaseRuleError(
      'W tej sprawie nie ma sprzeciwu czekającego na rozstrzygnięcie.',
    );
  }
  const term = objectionDecisionDeadline(pending.filedOn).date!;
  const late =
    today > term
      ? ` Rozstrzygnięcie po terminie (upłynął ${formatDatePl(term)}).`
      : '';
  let next = structuredClone(record);
  next.objections = (next.objections ?? []).map((o) =>
    o.id === pending.id
      ? {
          ...o,
          decision: {
            outcome: input.outcome,
            decidedOn: today,
            reason: input.reason,
            decidedBy: by,
          },
        }
      : o,
  );

  switch (input.outcome) {
    case 'DISMISS': {
      const court = daysTerm(today, COURT_APPEAL_DAYS, '', '').date!;
      next.history.push({
        date: today,
        text: `Dyrektor generalny urzędu nie uwzględnił sprzeciwu (oddalenie). Uzasadnienie: ${sentence(input.reason)}${late} Oceniany może odwołać się do sądu pracy w terminie 14 dni od doręczenia rozstrzygnięcia (do ${formatDatePl(court)}, art. 83 ust. 5 ${USC}).`,
        event: {
          type: 'OBJECTION_DISMISSED',
          notify: ['EMPLOYEE', 'EVALUATOR', 'HR'],
        },
      });
      return next;
    }
    case 'CHANGE': {
      next.assessmentVersions = [
        ...(next.assessmentVersions ?? []),
        snapshot(record, 'CHANGED', input.reason, today),
      ];
      reopen(next, 'SIGNATURE');
      if (input.decisions || input.justification !== undefined) {
        next = applyPatch(
          next,
          {
            ...(input.decisions ? { decisions: input.decisions } : {}),
            ...(input.justification !== undefined
              ? { justification: input.justification }
              : {}),
          },
          today,
        );
      }
      next.history.push({
        date: today,
        text: `Dyrektor generalny urzędu uwzględnił sprzeciw i zmienił ocenę (art. 83 ust. 4 ${USC}). Uzasadnienie: ${sentence(input.reason)}${late} Zmienioną ocenę oceniający podpisuje i ponownie przekazuje ocenianemu do zapoznania.`,
        event: {
          type: 'OBJECTION_ASSESSMENT_CHANGE',
          notify: ['EMPLOYEE', 'EVALUATOR', 'HR'],
        },
      });
      return next;
    }
    case 'REDO': {
      next.assessmentVersions = [
        ...(next.assessmentVersions ?? []),
        snapshot(record, 'CANCELLED', input.reason, today),
      ];
      reopen(next, 'ASSESSMENT');
      next.assessmentTalkOn = null;
      delete next.completedOn.ASSESSMENT;
      next.history.push({
        date: today,
        text: `Dyrektor generalny urzędu uwzględnił sprzeciw i polecił ponowne sporządzenie oceny (art. 83 ust. 4 ${USC}). Uzasadnienie: ${sentence(input.reason)}${late} Dotychczasowa ocena została anulowana; sprawa wraca do etapu „Rozmowa oceniająca i ocena” (§10–§11 ${RO_2016}). Od oceny sporządzonej po raz drugi przysługuje sprzeciw.`,
        event: {
          type: 'OBJECTION_ASSESSMENT_REDO',
          notify: ['EMPLOYEE', 'EVALUATOR', 'HR'],
        },
      });
      return next;
    }
  }
}

/** Clears the signature and acknowledgement so the assessment can be made again. */
function reopen(record: CaseRecord, stage: 'SIGNATURE' | 'ASSESSMENT'): void {
  record.stage = stage;
  record.signedByEvaluatorOn = null;
  record.sentForAckOn = null;
  record.acknowledgedOn = null;
  record.ackFiction = null;
  delete record.completedOn.SIGNATURE;
  delete record.completedOn.ACKNOWLEDGEMENT;
}

// --- What the viewer may do -------------------------------------------------

export const LEGAL_ACTIONS = [
  'RECORD_ACK_FICTION',
  'FILE_OBJECTION',
  'DECIDE_OBJECTION',
  'REQUEST_DUE_DATE_CHANGE',
  'DECIDE_DUE_DATE_REQUEST',
] as const;
export type LegalAction = (typeof LEGAL_ACTIONS)[number];

/** The viewer's part in a case (null: no part, e.g. ADMIN). */
export type Viewer = 'EVALUATOR' | 'EMPLOYEE' | 'HR' | 'DIRECTOR' | null;

/** Who may record the fiction of acknowledgement: the evaluator or HR (kadry). */
export const ACK_FICTION_VIEWERS: readonly Viewer[] = ['EVALUATOR', 'HR'];

/** Post-assessment actions the viewer may take now. */
export function legalActions(
  record: CaseRecord,
  today: string,
  viewer: Viewer,
): LegalAction[] {
  const out: LegalAction[] = [];
  if (ACK_FICTION_VIEWERS.includes(viewer) && !ackFictionBlocker(record)) {
    out.push('RECORD_ACK_FICTION');
  }
  if (viewer === 'EMPLOYEE' && !objectionBlocker(record, today)) {
    out.push('FILE_OBJECTION');
  }
  if (viewer === 'DIRECTOR' && pendingObjection(record)) {
    out.push('DECIDE_OBJECTION');
  }
  if (viewer === 'EMPLOYEE' && dueDateRequestRule(record, today).eligible) {
    out.push('REQUEST_DUE_DATE_CHANGE');
  }
  if (viewer === 'EVALUATOR' && pendingDueDateRequest(record)) {
    out.push('DECIDE_DUE_DATE_REQUEST');
  }
  return out;
}

/** Free text written into a history sentence, ending with exactly one full stop. */
function sentence(text: string): string {
  return `${text.trim().replace(/[.\s]+$/, '')}.`;
}
