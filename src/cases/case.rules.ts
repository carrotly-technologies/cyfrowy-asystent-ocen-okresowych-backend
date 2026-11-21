import {
  evaluate,
  type EvaluateResult,
  validateEvaluation,
} from '../assessments/evaluate.rules.js';
import {
  CRITERIA_CATALOGUE,
  knownCriterionName,
} from '../criteria/data/criteria.data.js';
import { SHEETS } from '../sheets/sheets.data.js';
import type { Sheet } from '../sheets/sheet.types.js';
import type { CaseRecord, StageId } from './case.types.js';

export {
  criterionName,
  findCriterion,
  knownCriterionName,
} from '../criteria/data/criteria.data.js';

export function sheetOf(record: Pick<CaseRecord, 'sheetId'>): Sheet | null {
  return SHEETS.find((s) => s.id === record.sheetId) ?? null;
}

/** Criteria assessed in part II: mandatory of the sheet + part I additional. */
export function caseCriteria(
  record: Pick<CaseRecord, 'sheetId' | 'partI'>,
): string[] {
  const sheet = sheetOf(record);
  if (!sheet) return [];
  return [...sheet.mandatoryCriteria, ...record.partI.additionalCriteria];
}

export function allDecided(record: CaseRecord): boolean {
  const criteria = caseCriteria(record);
  return (
    criteria.length > 0 && criteria.every((id) => record.decisions[id] != null)
  );
}

/** Result once every criterion has a valid decision; null otherwise. */
export function computeEvaluation(
  record: CaseRecord,
  _today?: string,
): EvaluateResult | null {
  const sheet = sheetOf(record);
  if (!sheet || !allDecided(record)) return null;
  const scores = caseCriteria(record).map((criterionId) => ({
    criterionId,
    points: record.decisions[criterionId],
  }));
  if (validateEvaluation(sheet, scores, knownCriterionName).length > 0) {
    return null;
  }
  return evaluate(sheet, scores, knownCriterionName, CRITERIA_CATALOGUE.scale);
}

/** The current stage (kept for symmetry with older derived stages). */
export function effectiveStage(record: CaseRecord): StageId {
  return record.stage;
}

export const STAGE_NAMES: Record<StageId, string> = {
  SHEET_SELECTION: 'Wybór arkusza, kryteriów i terminu oceny',
  OPENING_TALK: 'Rozmowa rozpoczynająca · część I',
  PART_I_ACK: 'Potwierdzenie części I przez ocenianego',
  OBSERVATION: 'Okres oceny · obserwacje',
  ASSESSMENT: 'Rozmowa oceniająca i ocena',
  SIGNATURE: 'Podpis oceniającego i przekazanie do zapoznania',
  ACKNOWLEDGEMENT: 'Zapoznanie ocenianego z oceną',
};

export function fullName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`;
}
