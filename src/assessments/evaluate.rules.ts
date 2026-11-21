import type { ScaleLevel } from '../criteria/criteria.types.js';
import type { Sheet } from '../sheets/sheet.types.js';
import { formatPl, listPoints, RO_2016 } from './assessment.format.js';

export interface CriterionScore {
  criterionId: string;
  points: number;
}

export interface EvaluateResult {
  average: number;
  averageDisplay: string;
  level: { label: string; range: string } | null;
  result: 'POSITIVE' | 'NEGATIVE';
  reasons: string[];
}

/** Display name of a criterion id, or undefined when the id is unknown. */
export type CriterionNameLookup = (id: string) => string | undefined;

/** Domain validation; returns Polish error messages (empty when valid). */
export function validateEvaluation(
  sheet: Sheet,
  scores: readonly CriterionScore[],
  criterionName: CriterionNameLookup,
): string[] {
  const errors: string[] = [];
  const mandatory = new Set(sheet.mandatoryCriteria);
  const label = (id: string) => criterionName(id) ?? id;
  const seen = new Set<string>();
  const additional: string[] = [];

  for (const { criterionId, points } of scores) {
    if (!criterionName(criterionId)) {
      errors.push(`Nieznane kryterium „${criterionId}”.`);
      continue;
    }
    if (seen.has(criterionId)) {
      errors.push(
        mandatory.has(criterionId)
          ? `Kryterium „${label(criterionId)}” jest obowiązkowe w arkuszu ${sheet.id} i nie może być dodatkowo wybrane jako kryterium dodatkowe.`
          : `Kryterium „${label(criterionId)}” podano więcej niż raz.`,
      );
      continue;
    }
    seen.add(criterionId);
    if (!mandatory.has(criterionId)) additional.push(criterionId);
    if (!sheet.scale.includes(points)) {
      errors.push(
        `Ocena kryterium „${label(criterionId)}” musi wynosić ${listPoints(sheet.scale)} pkt (podano ${points}).`,
      );
    }
  }

  for (const id of sheet.mandatoryCriteria) {
    if (!seen.has(id)) {
      errors.push(
        `Brak oceny kryterium obowiązkowego „${label(id)}” (arkusz ${sheet.id}).`,
      );
    }
  }

  if (additional.length > sheet.maxAdditionalCriteria) {
    errors.push(
      `Można wybrać najwyżej ${sheet.maxAdditionalCriteria} kryteria dodatkowe (podano ${additional.length}; §5 ust. 2 ${RO_2016}).`,
    );
  }

  return errors;
}

/** §11 ust. 1 pkt 2 rozp. 2016: average bands of the overall level. */
export const PERIODIC_BANDS: readonly {
  max: number;
  points: number;
  range: string;
}[] = [
  { max: 2, points: 1, range: '1–2' },
  { max: 4, points: 3, range: '>2–4' },
  { max: 6, points: 5, range: '>4–6' },
  { max: 8, points: 7, range: '>6–8' },
  { max: 9, points: 9, range: '>8–9' },
];

/** Overall level of a periodic assessment (§11 ust. 1 pkt 2 rozp. 2016). */
export function periodicLevel(
  average: number,
  scaleLevels: readonly ScaleLevel[],
): { label: string; range: string } {
  const band =
    PERIODIC_BANDS.find((b) => average <= b.max) ??
    PERIODIC_BANDS[PERIODIC_BANDS.length - 1];
  const label = scaleLevels.find((s) => s.points === band.points)?.label ?? '';
  return { label, range: band.range };
}

/**
 * Computes the result of an already validated assessment. Thresholds compare
 * the exact average; nothing is rounded before the comparison.
 */
export function evaluate(
  sheet: Sheet,
  scores: readonly CriterionScore[],
  criterionName: CriterionNameLookup,
  scaleLevels: readonly ScaleLevel[],
): EvaluateResult {
  const average = scores.reduce((sum, s) => sum + s.points, 0) / scores.length;
  const averageDisplay = formatPl(average);
  const names = (list: readonly CriterionScore[]) =>
    list
      .map((s) => `„${criterionName(s.criterionId) ?? s.criterionId}”`)
      .join(', ');

  const level = periodicLevel(average, scaleLevels);
  const reasons: string[] = [
    `Średnia arytmetyczna ${scores.length} ocen cząstkowych wynosi ${averageDisplay} pkt, co odpowiada poziomowi „${level.label}” (przedział ${level.range} pkt; §11 ust. 1 pkt 2 ${RO_2016}).`,
  ];
  const averageOk = average > 4;
  reasons.push(
    averageOk
      ? `Średnia przekracza 4 pkt (§11 ust. 1 pkt 3 ${RO_2016}).`
      : `Średnia nie przekracza 4 pkt, co oznacza ocenę negatywną (§11 ust. 1 pkt 3 ${RO_2016}).`,
  );
  const ones = scores.filter((s) => s.points === 1);
  if (ones.length > 0) {
    reasons.push(
      `${ones.length === 1 ? 'Kryterium' : 'Kryteria'} ${names(ones)} ${ones.length === 1 ? 'otrzymało' : 'otrzymały'} 1 pkt: każda ocena cząstkowa 1 pkt oznacza ocenę negatywną${averageOk ? ', mimo średniej powyżej 4 pkt' : ''} (§11 ust. 1 pkt 4 ${RO_2016}).`,
    );
  } else {
    reasons.push(
      `Żadna ocena cząstkowa nie wynosi 1 pkt (§11 ust. 1 pkt 4 ${RO_2016}).`,
    );
  }

  return {
    average,
    averageDisplay,
    level,
    result: averageOk && ones.length === 0 ? 'POSITIVE' : 'NEGATIVE',
    reasons,
  };
}
