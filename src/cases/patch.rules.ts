import { listPoints, RO_2016 } from '../assessments/assessment.format.js';
import { MAX_ADDITIONAL } from '../sheets/sheets.data.js';
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
  assessmentPeriodErrors,
  assessmentPeriodOf,
} from './assessment-period.rules.js';
import { assessmentChangedAfterObjection } from './objection-terms.rules.js';
import {
  mergePreviousAssessment,
  mergePromotionRequest,
} from './promotion.rules.js';

const LOCKED_NOTE =
  'Zmiana zablokowanego pola jest możliwa tylko w trybie korekty błędów przez administratora.';

/**
 * Stages at which part II of the sheet (partial scores, deviation notes,
 * justification, IPRZ, previous assessment, part III) can be edited: from the
 * assessment talk stage until the evaluator signs (field schema of sheets
 * A/B/C: „dostępne do edycji od etapu rozmowy oceniającej do zatwierdzenia
 * dokonania oceny”; §11 ust. 2 rozp. 2016: the written assessment takes the
 * talk into account). Before that the evaluator keeps observations and the
 * free-text „notatki robocze” (`workingNotes`, no legal effect).
 */
export const PART_II_STAGES: readonly StageId[] = ['ASSESSMENT', 'SIGNATURE'];

/** Whether part II of the sheet can be saved now (assessment stage until signature). */
export function partIIEditable(record: CaseRecord): boolean {
  if (record.signedByEvaluatorOn || record.acknowledgedOn) return false;
  // art. 83 ust. 4: the scores set when the objection was upheld are final.
  if (assessmentChangedAfterObjection(record)) return false;
  return record.sheetId !== null && PART_II_STAGES.includes(record.stage);
}

function partIIGuard(record: CaseRecord, field: string): void {
  if (partIIEditable(record)) return;
  if (assessmentChangedAfterObjection(record) && !record.signedByEvaluatorOn) {
    throw new CaseRuleError(
      `Pole „${field}” jest zablokowane: ocenę zmieniono w rozstrzygnięciu sprzeciwu (art. 83 ust. 4 ustawy o służbie cywilnej). Oceniający tylko podpisuje zmienioną ocenę i przekazuje ją ocenianemu. ${LOCKED_NOTE}`,
    );
  }
  if (record.signedByEvaluatorOn) {
    throw new CaseRuleError(
      `Pole „${field}” jest zablokowane: ocenę zatwierdzono ${formatDatePl(record.signedByEvaluatorOn)}. ${LOCKED_NOTE}`,
    );
  }
  throw new CaseRuleError(
    `Pole „${field}” jest dostępne do edycji od etapu „${STAGE_NAMES.ASSESSMENT}” do podpisania oceny; sprawa jest na etapie „${STAGE_NAMES[record.stage]}”. Wcześniej zapisuj obserwacje albo notatki robocze (bez skutków prawnych).`,
  );
}

/**
 * Drops entries of criteria that left the case (sheet or part I changed):
 * their expectations in part I and their part II scores and notes.
 */
function pruneCriteria(record: CaseRecord, criteria: Set<string>): void {
  for (const map of [
    record.partI.expectations,
    record.decisions,
    record.deviationNotes,
  ]) {
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
    if (patch.partI.additionalCriteria !== undefined && !partIOpen) {
      throw new CaseRuleError(
        `Kryteria dodatkowe można zmienić tylko przed potwierdzeniem części I${record.partI.confirmedByEvaluatorOn ? ` (część I potwierdzono ${formatDatePl(record.partI.confirmedByEvaluatorOn)})` : ''}. ${LOCKED_NOTE}`,
      );
    }
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
    const max = sheet?.maxAdditionalCriteria ?? MAX_ADDITIONAL;
    if (list.length > max) {
      errors.push(
        `Można wybrać najwyżej ${max} kryteria dodatkowe (podano ${list.length}; §5 ust. 2 ${RO_2016}).`,
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

  if (patch.assessmentTalkOn !== undefined) {
    partIIGuard(record, 'Data przeprowadzenia rozmowy oceniającej');
    const since =
      record.partI.acknowledgedByEmployeeOn ??
      record.partI.confirmedByEvaluatorOn;
    if (patch.assessmentTalkOn > today) {
      errors.push(
        'Data przeprowadzenia rozmowy oceniającej nie może być z przyszłości.',
      );
    } else if (since && patch.assessmentTalkOn < since) {
      errors.push(
        `Rozmowa oceniająca nie mogła się odbyć przed potwierdzeniem części I (${formatDatePl(since)}).`,
      );
    } else next.assessmentTalkOn = patch.assessmentTalkOn;
  }

  if (patch.assessmentPeriod !== undefined) {
    partIIGuard(record, 'Okres, w którym oceniany podlegał ocenie');
    const stored = { from: null, to: null, ...next.assessmentPeriod };
    const merged = { ...stored, ...patch.assessmentPeriod };
    const shown = assessmentPeriodOf(
      { ...next, assessmentPeriod: merged },
      today,
    );
    const periodErrors = assessmentPeriodErrors(shown, today);
    if (periodErrors.length > 0) errors.push(...periodErrors);
    else next.assessmentPeriod = merged;
  }

  if (patch.workingNotes !== undefined) {
    if (record.signedByEvaluatorOn) {
      throw new CaseRuleError(
        `Notatki robocze są zamknięte: ocenę podpisano ${formatDatePl(record.signedByEvaluatorOn)}.`,
      );
    }
    next.workingNotes = patch.workingNotes;
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
  logAdditionalCriteriaChange(record, next, today);
  return next;
}

/**
 * Notes a change of the additional criteria in the case history once the
 * sheet was accepted (before that ACCEPT_SHEET notes the chosen criteria).
 */
function logAdditionalCriteriaChange(
  before: CaseRecord,
  next: CaseRecord,
  today: string,
): void {
  if (before.stage === 'SHEET_SELECTION') return;
  const old = before.partI.additionalCriteria;
  const now = next.partI.additionalCriteria;
  const added = now.filter((id) => !old.includes(id));
  const removed = old.filter((id) => !now.includes(id));
  if (added.length === 0 && removed.length === 0) return;
  const names = (ids: string[]) =>
    ids.map((id) => `„${criterionName(id)}”`).join(', ');
  const changes = [
    added.length > 0 ? `dodano ${names(added)}` : null,
    removed.length > 0 ? `usunięto ${names(removed)}` : null,
  ].filter(Boolean);
  const max = sheetOf(next)?.maxAdditionalCriteria ?? MAX_ADDITIONAL;
  next.history.push({
    date: today,
    text: `Zmieniono kryteria dodatkowe: ${changes.join('; ')} (kryteria dodatkowe ${now.length}/${max}).`,
  });
}

/**
 * Why no observation can be added now (Polish), or null when the journal is
 * open. Evidence is gathered from the confirmation of part I right up to the
 * assessment talk, so the journal stays open in the OBSERVATION and
 * ASSESSMENT stages (also after a "Popraw" return) and closes only once the
 * evaluator signs the assessment.
 */
export function observationLock(record: CaseRecord): string | null {
  if (record.signedByEvaluatorOn)
    return `Ocena została podpisana ${formatDatePl(record.signedByEvaluatorOn)} — dziennik obserwacji jest zamknięty.`;
  if (record.partI.confirmedByEvaluatorOn === null)
    return 'Obserwacje zapisuje się w okresie oceny: najpierw potwierdź część I (kryteria), aby było wiadomo, do których kryteriów je przypinać.';
  return null;
}

/** Validates and adds an observation; returns the updated copy. */
export function addObservation(
  record: CaseRecord,
  input: ObservationInput,
  id: string,
  today: string,
): CaseRecord {
  const lock = observationLock(record);
  if (lock) throw new CaseRuleError(lock);
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
