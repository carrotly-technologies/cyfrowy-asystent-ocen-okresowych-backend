import { COMPETENCY_MODEL } from '../competency-model/data/model.data.js';
import type { Competency } from '../competency-model/competency-model.types.js';
import { SHEETS } from '../sheets/sheets.data.js';
import type { Sheet, SheetId } from '../sheets/sheet.types.js';
import {
  type IndicatorRating,
  snapToScale,
  suggestLevel,
  validateSuggestLevel,
} from './suggest-level.rules.js';

const sheet = (id: SheetId): Sheet => SHEETS.find((s) => s.id === id)!;
const competency = (id: string): Competency =>
  COMPETENCY_MODEL.competencies.find((c) => c.id === id)!;
const scale = COMPETENCY_MODEL.scale;

// komunikacja has 4 indicators, wspolpraca 6, rzetelnosc 2.
const ratings = (
  competencyId: string,
  points: (IndicatorRating['points'] | undefined)[],
): IndicatorRating[] =>
  points.flatMap((p, i) =>
    p === undefined
      ? []
      : [{ indicatorId: `${competencyId}.${i + 1}`, points: p }],
  );

describe('snapToScale', () => {
  it.each([
    [4.33, 5],
    [3.9, 3],
    [8.5, 9],
    [1.2, 1],
  ])('snaps %d to %d on the periodic scale', (mean, expected) => {
    expect(snapToScale(mean, [1, 3, 5, 7, 9])).toEqual({
      points: expected,
      tie: false,
    });
  });

  it.each([
    [2, 3],
    [4, 5],
    [6, 5],
    [8, 7],
  ])('breaks the tie at %d toward 5 (-> %d)', (mean, expected) => {
    expect(snapToScale(mean, [1, 3, 5, 7, 9])).toEqual({
      points: expected,
      tie: true,
    });
  });

  it('breaks ties toward 5 on the FIRST scale too', () => {
    expect(snapToScale(4, [3, 5, 7]).points).toBe(5);
    expect(snapToScale(6, [3, 5, 7]).points).toBe(5);
  });
});

describe('suggestLevel', () => {
  it('returns null when nothing is rated', () => {
    const result = suggestLevel(
      sheet('C'),
      competency('komunikacja'),
      ratings('komunikacja', [null, null, null, null]),
      scale,
    );
    expect(result).toMatchObject({
      suggestedPoints: null,
      suggestedLabel: null,
      mean: null,
      ratedCount: 0,
      skippedCount: 4,
      isSuggestionOnly: true,
    });
    expect(result.rationale).toContain('nie proponuje');
  });

  it('averages rated indicators and skips null ones', () => {
    const result = suggestLevel(
      sheet('C'),
      competency('komunikacja'),
      ratings('komunikacja', [5, 5, 3, null]),
      scale,
    );
    expect(result.mean).toBeCloseTo(13 / 3);
    expect(result).toMatchObject({
      suggestedPoints: 5,
      suggestedLabel: 'Na poziomie oczekiwań',
      ratedCount: 3,
      skippedCount: 1,
    });
    expect(result.rationale).toContain('reguły przyjętej w Kompasie');
    expect(result.warnings.some((w) => w.includes('Brak podstaw'))).toBe(true);
  });

  it('does not count indicators left out of the request as skipped', () => {
    const result = suggestLevel(
      sheet('B'),
      competency('wspolpraca'),
      ratings('wspolpraca', [7]),
      scale,
    );
    expect(result).toMatchObject({
      ratedCount: 1,
      skippedCount: 0,
      suggestedPoints: 7,
    });
    expect(result.warnings.some((w) => w.includes('Brak podstaw'))).toBe(false);
  });

  it('snaps an exact tie toward 5 and says so', () => {
    const result = suggestLevel(
      sheet('C'),
      competency('komunikacja'),
      ratings('komunikacja', [3, 5, null, null]),
      scale,
    );
    expect(result.mean).toBe(4);
    expect(result.suggestedPoints).toBe(5);
    expect(result.rationale).toContain('bliższa 5 pkt');
  });

  it('snaps a tie between 7 and 9 toward 7', () => {
    const result = suggestLevel(
      sheet('A'),
      competency('komunikacja'),
      ratings('komunikacja', [7, 9]),
      scale,
    );
    expect(result.suggestedPoints).toBe(7);
  });

  it('warns about an indicator rated 1 on a periodic sheet', () => {
    const result = suggestLevel(
      sheet('C'),
      competency('rzetelnosc'),
      ratings('rzetelnosc', [1, 9]),
      scale,
    );
    expect(result.suggestedPoints).toBe(5);
    expect(result.warnings.some((w) => w.includes('§11 ust. 1 pkt 4'))).toBe(
      true,
    );
    expect(result.warnings.some((w) => w.includes('rozrzut'))).toBe(true);
  });

  it('clamps FIRST indicator levels 1 -> 3 and 9 -> 7 before averaging', () => {
    const low = suggestLevel(
      sheet('FIRST'),
      competency('rzetelnosc'),
      ratings('rzetelnosc', [1, 1]),
      scale,
    );
    expect(low.mean).toBe(3);
    expect(low.suggestedPoints).toBe(3);
    expect(low.suggestedLabel).toBe('Poniżej oczekiwań');
    expect(low.rationale).toContain('3/5/7');

    const high = suggestLevel(
      sheet('FIRST'),
      competency('rzetelnosc'),
      ratings('rzetelnosc', [9, 9]),
      scale,
    );
    expect(high.mean).toBe(7);
    expect(high.suggestedPoints).toBe(7);
    expect(high.warnings.some((w) => w.includes('przeliczone'))).toBe(true);
  });

  it('never suggests 1 or 9 on the FIRST sheet', () => {
    const result = suggestLevel(
      sheet('FIRST'),
      competency('komunikacja'),
      ratings('komunikacja', [9, 9, 9, 7]),
      scale,
    );
    expect(result.suggestedPoints).toBe(7);
  });
});

describe('validateSuggestLevel', () => {
  it('accepts valid input', () => {
    expect(
      validateSuggestLevel(
        sheet('C'),
        'komunikacja',
        competency('komunikacja'),
        ratings('komunikacja', [5, null]),
      ),
    ).toEqual([]);
  });

  it('rejects an unknown competency', () => {
    expect(validateSuggestLevel(sheet('C'), 'xyz', undefined, [])).toEqual([
      'Nieznana kompetencja „xyz”.',
    ]);
  });

  it('rejects a competency that is not a FIRST element', () => {
    const errors = validateSuggestLevel(
      sheet('FIRST'),
      'kreatywnosc',
      competency('kreatywnosc'),
      [],
    );
    expect(errors[0]).toContain('nie jest elementem pierwszej oceny');
  });

  it('rejects foreign and duplicate indicators', () => {
    const errors = validateSuggestLevel(
      sheet('C'),
      'komunikacja',
      competency('komunikacja'),
      [
        { indicatorId: 'rzetelnosc.1', points: 5 },
        { indicatorId: 'komunikacja.1', points: 5 },
        { indicatorId: 'komunikacja.1', points: 3 },
      ],
    );
    expect(errors).toEqual([
      'Wskaźnik „rzetelnosc.1” nie należy do kompetencji „Komunikacja”.',
      'Wskaźnik „komunikacja.1” podano więcej niż raz.',
    ]);
  });
});
