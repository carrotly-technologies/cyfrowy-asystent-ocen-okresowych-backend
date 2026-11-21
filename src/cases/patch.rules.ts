import { listPoints, RO_2016 } from '../assessments/assessment.format.js';
import {
  caseCriteria,
  computeEvaluation,
  criterionName,
  findCriterion,
  sheetOf,
  STAGE_NAMES,
} from './case.rules.js';
import { CaseRuleError, CaseValidationError } from './case-rule.error.js';
import type { CaseRecord, Observation, StageId } from './case.types.js';
import type { ObservationInput, PatchCase } from './cases.schemas.js';
import { formatDatePl } from './dates.js';
import {
  mergePreviousAssessment,
  mergePromotionRequest,
} from './promotion.rules.js';

const LOCKED_NOTE =
  'Zmiana zablokowanego pola jest możliwa tylko w trybie korekty błędów przez administratora.';

/**
 * Stages at which part II of the sheet (partial scores, deviation notes,
 * justification, IPRZ, previous assessment, part III) can be saved as a draft
 * ("wersja robocza"): from the moment the sheet is known until the evaluator
 * signs (Poradnik „Oceny okresowe w służbie cywilnej”, s. 20: „wypełniony na
 * roboczo arkusz oceny”; §11 ust. 2 rozp. 2016: the written assessment takes
 * the assessment talk into account, so drafting continues after the talk).
 * Decision log: notatki/decyzje.md.
 */
const PART_II_STAGES: readonly StageId[] = [
  'SHEET_SELECTION',
  'OPENING_TALK',
  'PART_I_ACK',
  'OBSERVATION',
  'ASSESSMENT',
  'SIGNATURE',
];

/** Whether part II of the sheet can be saved now (draft until signature). */
export function partIIEditable(record: CaseRecord): boolean {
  if (record.signedByEvaluatorOn || record.acknowledgedOn) return false;
  return record.sheetId !== null && PART_II_STAGES.includes(record.stage);
}

function partIIGuard(record: CaseRecord, field: string): void {
  if (partIIEditable(record)) return;
  if (record.signedByEvaluatorOn) {
    throw new CaseRuleError(
      `Pole „${field}” jest zablokowane: ocenę zatwierdzono ${formatDatePl(record.signedByEvaluatorOn)}. ${LOCKED_NOTE}`,
    );
  }
  throw new CaseRuleError(
    `Pole „${field}” można wypełnić, gdy wybrany jest arkusz oceny; sprawa jest na etapie „${STAGE_NAMES[record.stage]}”. Najpierw wybierz arkusz.`,
  );
}

/** Drops part II entries of criteria that left the case (sheet or part I changed). */
function pruneCriteria(record: CaseRecord, criteria: Set<string>): void {
  for (const map of [record.decisions, record.deviationNotes]) {
    for (const id of Object.keys(map)) {
      if (!criteria.has(id)) delete map[id];
    }
  }
}

/**
 * Applies PATCH /cases/:id: checks which parts are editable at the current
 * stage (CaseRuleError -> 409) and validates values (CaseValidationError ->
 * 400). Returns the updated copy.
 */
export function applyPatch(
  record: CaseRecord,
  patch: PatchCase,
  today: string,
): CaseRecord {
  const next = structuredClone(record);
  const errors: string[] = [];
  // Part I (sheet, additional criteria, due date, talk notes) is open until
  // the evaluator confirms the opening talk (§5 ust. 3, §6 rozp. 2016).
  const partIOpen =
    record.stage === 'SHEET_SELECTION' || record.stage === 'OPENING_TALK';

  if (patch.sheetId !== undefined && patch.sheetId !== record.sheetId) {
    if (!partIOpen) {
      throw new CaseRuleError(
        `Arkusza nie można już zmienić: część I zatwierdzono${record.partI.confirmedByEvaluatorOn ? ` ${formatDatePl(record.partI.confirmedByEvaluatorOn)}` : ''}. ${LOCKED_NOTE}`,
      );
    } else {
      next.sheetId = patch.sheetId;
    }
  }

  if (patch.partI) {
    if (!partIOpen) {
      throw new CaseRuleError(
        `Część I jest zablokowana: oceniający zatwierdził ją ${formatDatePl(record.partI.confirmedByEvaluatorOn!)}. ${LOCKED_NOTE}`,
      );
    }
    const { additionalCriteria, assessmentDue, topics, expectations } =
      patch.partI;
    if (additionalCriteria !== undefined) {
      next.partI.additionalCriteria = additionalCriteria;
    }
    if (assessmentDue !== undefined) {
      if (assessmentDue !== null && assessmentDue <= today) {
        errors.push(
          'Termin sporządzenia oceny musi przypadać po dniu dzisiejszym.',
        );
      }
      next.partI.assessmentDue = assessmentDue;
    }
    if (topics) next.partI.topics = { ...next.partI.topics, ...topics };
    if (expectations) {
      for (const id of Object.keys(expectations)) {
        if (!findCriterion(id))
          errors.push(`Nieznane kryterium „${id}” w oczekiwaniach.`);
      }
      next.partI.expectations = { ...next.partI.expectations, ...expectations };
    }
  }

  // Additional criteria vs the (possibly new) sheet.
  if (
    patch.partI?.additionalCriteria !== undefined ||
    patch.sheetId !== undefined
  ) {
    const sheet = sheetOf(next);
    const list = next.partI.additionalCriteria;
    if (list.length > 3) {
      errors.push(
        `Można wybrać najwyżej 3 kryteria dodatkowe (podano ${list.length}; §2 ust. 2 ${RO_2016}).`,
      );
    }
    const seen = new Set<string>();
    for (const id of list) {
      if (!findCriterion(id)) errors.push(`Nieznane kryterium „${id}”.`);
      else if (seen.has(id))
        errors.push(`Kryterium „${criterionName(id)}” podano więcej niż raz.`);
      else if (sheet?.mandatoryCriteria.includes(id)) {
        errors.push(
          `Kryterium „${criterionName(id)}” jest obowiązkowe w arkuszu ${sheet.id}, więc nie może być kryterium dodatkowym.`,
        );
      }
      seen.add(id);
    }
  }

  const criteria = new Set(caseCriteria(next));
  // Part II can be drafted before part I is confirmed (see partIIEditable).
  if (
    patch.partI?.additionalCriteria !== undefined ||
    patch.sheetId !== undefined
  ) {
    pruneCriteria(next, criteria);
  }
  const unknownCriterion = (id: string) =>
    `Kryterium „${criterionName(id)}” nie jest oceniane w tej sprawie (kryteria z części I: ${[...criteria].map((c) => `„${criterionName(c)}”`).join(', ')}).`;

  if (patch.decisions) {
    partIIGuard(record, 'decisions');
    const scale = sheetOf(next)?.scale ?? [];
    for (const [criterionId, points] of Object.entries(patch.decisions)) {
      if (points === null) {
        delete next.decisions[criterionId];
        continue;
      }
      if (!criteria.has(criterionId))
        errors.push(unknownCriterion(criterionId));
      else if (!scale.includes(points)) {
        errors.push(
          `Ocena cząstkowa kryterium „${criterionName(criterionId)}” musi wynosić ${listPoints(scale)} pkt (podano ${points}).`,
        );
      } else next.decisions[criterionId] = points;
    }
  }

  if (patch.deviationNotes) {
    partIIGuard(record, 'deviationNotes');
    for (const [criterionId, note] of Object.entries(patch.deviationNotes)) {
      if (note === null) delete next.deviationNotes[criterionId];
      else if (!criteria.has(criterionId))
        errors.push(unknownCriterion(criterionId));
      else next.deviationNotes[criterionId] = note;
    }
  }

  if (patch.justification !== undefined) {
    partIIGuard(record, 'justification');
    next.justification = patch.justification;
  }
  if (patch.iprz !== undefined) {
    partIIGuard(record, 'iprz');
    next.iprz = patch.iprz;
  }

  if (patch.previousAssessment !== undefined) {
    partIIGuard(record, 'Dane dotyczące poprzedniej oceny okresowej');
    next.previousAssessment = mergePreviousAssessment(
      record.previousAssessment,
      patch.previousAssessment,
      today,
      errors,
    );
  }
  if (patch.promotionRequest !== undefined) {
    partIIGuard(record, 'Wniosek o przyznanie kolejnego stopnia służbowego');
    // Decisions of the same patch count: the request needs a positive result.
    next.promotionRequest = mergePromotionRequest(
      record,
      patch.promotionRequest,
      computeEvaluation(next, today),
      today,
      errors,
    );
  }

  if (errors.length > 0) throw new CaseValidationError(errors);
  return next;
}

/** Validates and adds an observation; returns the updated copy. */
export function addObservation(
  record: CaseRecord,
  input: ObservationInput,
  id: string,
  today: string,
): CaseRecord {
  const open =
    !record.signedByEvaluatorOn && record.partI.confirmedByEvaluatorOn !== null;
  if (!open) {
    throw new CaseRuleError(
      record.signedByEvaluatorOn
        ? `Ocena została zatwierdzona ${formatDatePl(record.signedByEvaluatorOn)}; obserwacje dotyczą okresu oceny i nie można ich już dodawać.`
        : 'Obserwacje zapisuje się w okresie oceny: najpierw potwierdź część I (kryteria), aby było wiadomo, do których kryteriów je przypinać.',
    );
  }
  const errors: string[] = [];
  const criteria = caseCriteria(record);
  if (!criteria.includes(input.criterionId)) {
    errors.push(
      `Kryterium „${criterionName(input.criterionId)}” nie jest oceniane w tej sprawie.`,
    );
  }
  if (input.date > today)
    errors.push('Data obserwacji nie może być z przyszłości.');
  if (errors.length > 0) throw new CaseValidationError(errors);

  const next = structuredClone(record);
  const observation: Observation = { id, ...input };
  next.observations.push(observation);
  next.observations.sort((a, b) => a.date.localeCompare(b.date));
  return next;
}
