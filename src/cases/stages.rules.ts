import { RO_2016 } from '../assessments/assessment.format.js';
import { computeEvaluation, STAGE_NAMES } from './case.rules.js';
import {
  type CaseRecord,
  type CaseStatus,
  type CycleStart,
  type Deadline,
  type StageId,
  type StageInfo,
  STAGES,
} from './case.types.js';
import { addMonths } from './dates.js';
import {
  assessmentDueDeadline,
  type DeadlineSpec,
  objectionDeadline,
  openingTalkDeadline,
  toDeadline,
  USC,
} from './deadlines.rules.js';
import { appealNextDeadline, appealStatus } from './objection-terms.rules.js';

export const STAGE_LEGAL_BASIS: Record<StageId, string> = {
  SHEET_SELECTION: `§2 ust. 2, §3, §5 ust. 2–3 ${RO_2016}`,
  OPENING_TALK: `§5–§7 ${RO_2016}`,
  PART_I_ACK: `§6 ust. 2–3 ${RO_2016}`,
  OBSERVATION: `art. 81 ust. 1 ${USC}`,
  ASSESSMENT: `§10, §11 ${RO_2016}; art. 108 ${USC}`,
  SIGNATURE: `§11 ust. 2, §12 ust. 1 ${RO_2016}`,
  ACKNOWLEDGEMENT: `§12 ${RO_2016}; art. 83 ust. 1 ${USC}`,
};

export function stageOrder(): readonly StageId[] {
  return STAGES;
}

function stageDeadlineSpec(
  record: CaseRecord,
  stage: StageId,
): DeadlineSpec | null {
  switch (stage) {
    case 'SHEET_SELECTION':
      return {
        ...openingTalkDeadline(record.cycleStart),
        label: 'Wybór arkusza i kryteriów przed rozmową rozpoczynającą, do',
      };
    case 'OPENING_TALK':
    case 'PART_I_ACK':
      return openingTalkDeadline(record.cycleStart);
    case 'OBSERVATION':
    case 'ASSESSMENT':
      return assessmentDueDeadline(
        record.cycleStart,
        record.partI.assessmentDue,
      );
    case 'SIGNATURE':
      return assessmentDueDeadline(
        record.cycleStart,
        record.partI.assessmentDue,
      );
    case 'ACKNOWLEDGEMENT':
      return {
        date: null,
        label: 'Zapoznanie ocenianego z oceną niezwłocznie po jej sporządzeniu',
        legalBasis: `§12 ust. 1 ${RO_2016}; art. 81 ust. 3 ${USC}`,
      };
  }
}

/** Deadline of a stage; null when the stage has no date yet. */
export function stageDeadline(
  record: CaseRecord,
  stage: StageId,
  today: string,
): Deadline | null {
  const spec = stageDeadlineSpec(record, stage);
  if (!spec) return null;
  // "Niezwłocznie" keeps a NONE deadline; others need a date.
  if (!spec.date && stage !== 'ACKNOWLEDGEMENT') return null;
  return toDeadline(spec, today);
}

/** Start of the next periodic cycle, once this assessment was made. */
export function nextCycleStart(
  record: CaseRecord,
  today: string,
): CycleStart | null {
  if (!record.signedByEvaluatorOn) return null;
  const negative = computeEvaluation(record, today)?.result === 'NEGATIVE';
  if (negative && record.acknowledgedOn) {
    return {
      kind: 'PREVIOUS_NEGATIVE',
      assessedOn: record.signedByEvaluatorOn,
      acknowledgedOn: record.acknowledgedOn,
    };
  }
  return { kind: 'PREVIOUS_POSITIVE', assessedOn: record.signedByEvaluatorOn };
}

export function objectionDeadlineOf(
  record: CaseRecord,
  today: string,
): Deadline | null {
  if (!record.acknowledgedOn) return null;
  return toDeadline(objectionDeadline(record.acknowledgedOn), today);
}

export function caseStatus(record: CaseRecord, today: string): CaseStatus {
  const appeal = appealStatus(record);
  if (appeal) return appeal;
  if (record.acknowledgedOn) {
    const objection = objectionDeadlineOf(record, today);
    return objection && objection.daysLeft !== null && objection.daysLeft >= 0
      ? 'OKRES_SPRZECIWU'
      : 'ZAKONCZONA';
  }
  if (record.sentForAckOn) return 'DO_ZAPOZNANIA';
  return 'W_TOKU';
}

export function buildStages(record: CaseRecord, today: string): StageInfo[] {
  const order = stageOrder();
  const current = order.indexOf(record.stage);
  const finished = record.acknowledgedOn !== null;
  return order.map((id, index) => {
    const status =
      finished || index < current
        ? 'DONE'
        : index === current
          ? 'CURRENT'
          : index === current + 1
            ? 'UPCOMING'
            : 'LOCKED';
    return {
      id,
      name: STAGE_NAMES[id],
      status,
      deadline: status === 'DONE' ? null : stageDeadline(record, id, today),
      completedOn: status === 'DONE' ? (record.completedOn[id] ?? null) : null,
      legalBasis: STAGE_LEGAL_BASIS[id],
    };
  });
}

/**
 * The deadline that matters now: the current stage's; after the employee
 * acknowledged the assessment, the objection term and then the opening talk
 * of the next cycle (unless the next cycle already has its own case).
 */
export function nextDeadline(
  record: CaseRecord,
  today: string,
): Deadline | null {
  const appeal = appealNextDeadline(record, today);
  if (appeal) return appeal;
  if (record.acknowledgedOn) {
    const objection = objectionDeadlineOf(record, today);
    if (objection && objection.daysLeft !== null && objection.daysLeft >= 0) {
      return objection;
    }
    if (record.nextCaseId) return null;
    const next = nextCycleStart(record, today);
    if (!next) return null;
    return toDeadline(
      {
        ...openingTalkDeadline(next),
        label: 'Nowy cykl: rozmowa rozpoczynająca (część I) do',
      },
      today,
    );
  }
  return stageDeadline(record, record.stage, today);
}

export function cycleLabel(record: CaseRecord): string {
  const anchor =
    record.cycleStart.kind === 'HIRED'
      ? record.cycleStart.date
      : record.cycleStart.assessedOn;
  const from = record.partI.acknowledgedByEmployeeOn ?? anchor;
  const negative = record.cycleStart.kind === 'PREVIOUS_NEGATIVE';
  const to = record.partI.assessmentDue ?? addMonths(from, negative ? 6 : 24);
  const years =
    from.slice(0, 4) === to.slice(0, 4)
      ? from.slice(0, 4)
      : `${from.slice(0, 4)}–${to.slice(0, 4)}`;
  return negative
    ? `Ponowna ocena okresowa (po ocenie negatywnej) ${years}`
    : `Ocena okresowa ${years}`;
}
