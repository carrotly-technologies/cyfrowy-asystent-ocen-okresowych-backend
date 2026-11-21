import type {
  Competency,
  ScaleLevel,
  ScalePoints,
} from '../competency-model/competency-model.types.js';
import type { Sheet } from '../sheets/sheet.types.js';
import {
  displayName,
  formatPl,
  listPoints,
  nearlyEqual,
  RO_2016,
  RP_2015,
} from './assessment.format.js';

export interface IndicatorRating {
  indicatorId: string;
  /** null = "brak podstaw do oceny" */
  points: ScalePoints | null;
}

export interface SuggestLevelResult {
  suggestedPoints: number | null;
  suggestedLabel: string | null;
  ratedCount: number;
  skippedCount: number;
  mean: number | null;
  rationale: string;
  warnings: string[];
  isSuggestionOnly: true;
}

/** Domain validation; returns Polish error messages (empty when valid). */
export function validateSuggestLevel(
  sheet: Sheet,
  competencyId: string,
  competency: Competency | undefined,
  ratings: readonly IndicatorRating[],
): string[] {
  if (!competency) return [`Nieznana kompetencja „${competencyId}”.`];

  const errors: string[] = [];
  const name = displayName(competency.name);
  if (
    sheet.kind === 'FIRST' &&
    !sheet.mandatoryCriteria.includes(competency.id)
  ) {
    errors.push(
      `Kompetencja „${name}” nie jest elementem pierwszej oceny (§2 pkt 1 ${RP_2015}).`,
    );
  }

  const known = new Set(competency.indicators.map((i) => i.id));
  const seen = new Set<string>();
  for (const { indicatorId } of ratings) {
    if (!known.has(indicatorId)) {
      errors.push(
        `Wskaźnik „${indicatorId}” nie należy do kompetencji „${name}”.`,
      );
    } else if (seen.has(indicatorId)) {
      errors.push(`Wskaźnik „${indicatorId}” podano więcej niż raz.`);
    }
    seen.add(indicatorId);
  }
  return errors;
}

/**
 * Nearest point of `scale` to `mean`. An exact tie goes toward 5 pkt
 * (the conservative middle of the scale).
 */
export function snapToScale(
  mean: number,
  scale: readonly number[],
): { points: number; tie: boolean } {
  let best = scale[0];
  let bestDistance = Infinity;
  let tie = false;
  for (const point of scale) {
    const distance = Math.abs(mean - point);
    if (nearlyEqual(distance, bestDistance)) {
      tie = true;
      if (Math.abs(point - 5) < Math.abs(best - 5)) best = point;
    } else if (distance < bestDistance) {
      best = point;
      bestDistance = distance;
      tie = false;
    }
  }
  return { points: best, tie };
}

/**
 * Suggests a criterion score from indicator ratings. This is OUR rule (the
 * regulations don't define indicator -> criterion aggregation): mean of the
 * rated indicators, snapped to the nearest point of the sheet's scale, ties
 * toward 5. For FIRST (scale 3/5/7) indicator levels 1 and 9 are clamped to
 * 3 and 7 before averaging.
 */
export function suggestLevel(
  sheet: Sheet,
  competency: Competency,
  ratings: readonly IndicatorRating[],
  scaleLevels: readonly ScaleLevel[],
): SuggestLevelResult {
  const min = Math.min(...sheet.scale);
  const max = Math.max(...sheet.scale);
  const rated = ratings.filter(
    (r): r is IndicatorRating & { points: ScalePoints } => r.points !== null,
  );
  const total = competency.indicators.length;
  const ratedCount = rated.length;
  // Only explicit "brak podstaw" (null) counts as skipped; indicators not sent
  // yet are still being rated, not skipped.
  const skippedCount = ratings.length - ratedCount;
  const name = displayName(competency.name);
  const warnings: string[] = [];

  if (ratedCount === 0) {
    return {
      suggestedPoints: null,
      suggestedLabel: null,
      ratedCount,
      skippedCount,
      mean: null,
      rationale: `Żaden wskaźnik kompetencji „${name}” nie został oceniony (brak podstaw do oceny), więc system nie proponuje poziomu. Ocenę kryterium ustala przełożony.`,
      warnings: [
        'Brak ocenionych wskaźników: przed przyznaniem oceny cząstkowej zbierz przykłady zachowań z ocenianego okresu.',
      ],
      isSuggestionOnly: true,
    };
  }

  const clamped = rated.filter((r) => r.points < min || r.points > max);
  const values = rated.map((r) => Math.min(max, Math.max(min, r.points)));
  const mean = values.reduce((sum, v) => sum + v, 0) / ratedCount;
  const { points, tie } = snapToScale(mean, sheet.scale);
  const label = scaleLevels.find((s) => s.points === points)?.label ?? null;

  const rationaleParts = [
    `Sugestia według reguły przyjętej w Kompasie (przepisy nie określają, jak przeliczać wskaźniki na ocenę kryterium): średnia ocen ${ratedCount} z ${total} wskaźników (pominięto „brak podstaw do oceny”) wynosi ${formatPl(mean)} pkt, a najbliższa wartość skali (${listPoints(sheet.scale)} pkt) to ${points} pkt${tie ? ' (przy remisie wybierana jest wartość bliższa 5 pkt)' : ''}.`,
  ];
  if (sheet.kind === 'FIRST') {
    rationaleParts.push(
      'Pierwsza ocena ma skalę 3/5/7 pkt, dlatego oceny wskaźników 1 i 9 pkt przed uśrednieniem przeliczono na 3 i 7 pkt (przeliczenie przyjęte w Kompasie, przepisy go nie określają).',
    );
  }

  if (skippedCount > 0) {
    warnings.push(
      `Brak podstaw do oceny ${skippedCount} z ${total} wskaźników: sugestia opiera się tylko na ocenionych wskaźnikach.`,
    );
  }
  if (sheet.kind === 'PERIODIC') {
    const ones = rated
      .filter((r) => r.points === 1)
      .map(
        (r) =>
          `W${competency.indicators.findIndex((i) => i.id === r.indicatorId) + 1}`,
      );
    if (ones.length > 0) {
      warnings.push(
        `Wskaźniki ocenione na 1 pkt: ${ones.join(', ')}. Ocena cząstkowa kryterium równa 1 pkt oznacza negatywną ocenę okresową niezależnie od średniej (§11 ust. 1 pkt 4 ${RO_2016}).`,
      );
    }
    if (points === 1) {
      warnings.push(
        `Sugerowana ocena kryterium to 1 pkt: taka ocena cząstkowa oznacza negatywną ocenę okresową (§11 ust. 1 pkt 4 ${RO_2016}).`,
      );
    }
  } else {
    if (clamped.length > 0) {
      warnings.push(
        `Wskaźniki przeliczone do skali 3/5/7 pkt: ${clamped.map((r) => `„${r.indicatorId}” (${r.points} pkt)`).join(', ')} (§9 ust. 1 ${RP_2015}).`,
      );
    }
    if (points === 3) {
      warnings.push(
        `Sugerowana ocena to 3 pkt: pozytywna pierwsza ocena dopuszcza najwyżej jedną ocenę cząstkową 3 pkt (§10 ust. 1 pkt 3 ${RP_2015}).`,
      );
    }
  }
  const spread = Math.max(...values) - Math.min(...values);
  if (spread >= 4) {
    warnings.push(
      `Duży rozrzut ocen wskaźników (od ${Math.min(...values)} do ${Math.max(...values)} pkt): opisz w uzasadnieniu konkretne przykłady zachowań.`,
    );
  }

  return {
    suggestedPoints: points,
    suggestedLabel: label,
    ratedCount,
    skippedCount,
    mean,
    rationale: rationaleParts.join(' '),
    warnings,
    isSuggestionOnly: true,
  };
}
