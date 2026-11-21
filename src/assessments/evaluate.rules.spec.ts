import {
  CRITERIA_CATALOGUE,
  knownCriterionName,
} from '../criteria/data/criteria.data.js';
import { SHEETS } from '../sheets/sheets.data.js';
import type { Sheet, SheetId } from '../sheets/sheet.types.js';
import {
  type CriterionScore,
  evaluate,
  periodicLevel,
  validateEvaluation,
} from './evaluate.rules.js';

const sheet = (id: SheetId): Sheet => SHEETS.find((s) => s.id === id)!;
const scale = CRITERIA_CATALOGUE.scale;
const criterionName = knownCriterionName;

// C: wykorzystywanie_wiedzy, rzetelnosc, organizacja_pracy, wspolpraca, komunikacja
const scoresFor = (
  id: SheetId,
  points: number[],
  extra: CriterionScore[] = [],
) => [
  ...sheet(id).mandatoryCriteria.map((criterionId, i) => ({
    criterionId,
    points: points[i],
  })),
  ...extra,
];

const run = (id: SheetId, scores: CriterionScore[]) => {
  expect(validateEvaluation(sheet(id), scores, criterionName)).toEqual([]);
  return evaluate(sheet(id), scores, criterionName, scale);
};

describe('periodicLevel', () => {
  it.each([
    [1, 'Znacznie poniżej oczekiwań', '1–2'],
    [2, 'Znacznie poniżej oczekiwań', '1–2'],
    [2.2, 'Poniżej oczekiwań', '>2–4'],
    [4, 'Poniżej oczekiwań', '>2–4'],
    [4.2, 'Na poziomie oczekiwań', '>4–6'],
    [6, 'Na poziomie oczekiwań', '>4–6'],
    [8, 'Powyżej oczekiwań', '>6–8'],
    [8.2, 'Znacznie powyżej oczekiwań', '>8–9'],
    [9, 'Znacznie powyżej oczekiwań', '>8–9'],
  ])('average %d -> %s (%s)', (average, label, range) => {
    expect(periodicLevel(average, scale)).toEqual({ label, range });
  });
});

describe('evaluate: periodic', () => {
  it('average exactly 4.0 is NEGATIVE', () => {
    const result = run(
      'C',
      scoresFor(
        'C',
        [3, 5, 3, 5, 3],
        [{ criterionId: 'kreatywnosc', points: 5 }],
      ),
    );
    expect(result.average).toBe(4);
    expect(result.averageDisplay).toBe('4,00');
    expect(result.level).toEqual({ label: 'Poniżej oczekiwań', range: '>2–4' });
    expect(result.result).toBe('NEGATIVE');
    expect(result.reasons.join(' ')).toContain('nie przekracza 4 pkt');
  });

  it('average 4.2 with one score 1 is "Na poziomie oczekiwań" but NEGATIVE (E4)', () => {
    const result = run('C', scoresFor('C', [5, 1, 5, 5, 5]));
    expect(result.average).toBeCloseTo(4.2);
    expect(result.averageDisplay).toBe('4,20');
    expect(result.level?.label).toBe('Na poziomie oczekiwań');
    expect(result.result).toBe('NEGATIVE');
    expect(result.reasons.join(' ')).toContain('„Rzetelność” otrzymało 1 pkt');
    expect(result.reasons.join(' ')).toContain('mimo średniej powyżej 4 pkt');
  });

  it('average above 8 is "Znacznie powyżej oczekiwań" and POSITIVE', () => {
    const result = run(
      'B',
      scoresFor(
        'B',
        [9, 9, 9, 7, 9],
        [{ criterionId: 'kreatywnosc', points: 9 }],
      ),
    );
    expect(result.average).toBeCloseTo(52 / 6);
    expect(result.averageDisplay).toBe('8,66');
    expect(result.level).toEqual({
      label: 'Znacznie powyżej oczekiwań',
      range: '>8–9',
    });
    expect(result.result).toBe('POSITIVE');
  });

  it('average just above 4 without 1s is POSITIVE', () => {
    const result = run('C', scoresFor('C', [5, 3, 5, 3, 5]));
    expect(result.average).toBeCloseTo(4.2);
    expect(result.result).toBe('POSITIVE');
  });

  it('includes additional criteria in the average', () => {
    const result = run(
      'A',
      scoresFor(
        'A',
        [5, 5, 5, 5, 5, 5],
        [
          { criterionId: 'negocjowanie', points: 9 },
          { criterionId: 'kreatywnosc', points: 9 },
          { criterionId: 'rzetelnosc', points: 9 },
        ],
      ),
    );
    expect(result.average).toBeCloseTo(57 / 9);
    expect(result.level?.label).toBe('Powyżej oczekiwań');
  });
});

describe('validateEvaluation', () => {
  const errors = (id: SheetId, scores: CriterionScore[]) =>
    validateEvaluation(sheet(id), scores, criterionName);

  it('reports a missing mandatory criterion', () => {
    const scores = scoresFor('B', [5, 5, 5, 5, 5]).slice(1);
    expect(errors('B', scores)).toEqual([
      'Brak oceny kryterium obowiązkowego „Zarządzanie ludźmi” (arkusz B).',
    ]);
  });

  it('reports more than 3 additional criteria', () => {
    const scores = scoresFor(
      'C',
      [5, 5, 5, 5, 5],
      [
        { criterionId: 'kreatywnosc', points: 5 },
        { criterionId: 'negocjowanie', points: 5 },
        { criterionId: 'myslenie_analityczne', points: 5 },
        { criterionId: 'wystapienia_publiczne', points: 5 },
      ],
    );
    expect(errors('C', scores)).toEqual([
      expect.stringContaining('najwyżej 3 kryteria dodatkowe (podano 4'),
    ]);
  });

  it('reports a duplicated additional criterion', () => {
    const scores = scoresFor(
      'C',
      [5, 5, 5, 5, 5],
      [
        { criterionId: 'kreatywnosc', points: 5 },
        { criterionId: 'kreatywnosc', points: 7 },
      ],
    );
    expect(errors('C', scores)).toEqual([
      'Kryterium „Kreatywność” podano więcej niż raz.',
    ]);
  });

  it('reports an additional criterion that is already mandatory', () => {
    const scores = scoresFor(
      'C',
      [5, 5, 5, 5, 5],
      [{ criterionId: 'komunikacja', points: 7 }],
    );
    expect(errors('C', scores)).toEqual([
      expect.stringContaining('„Komunikacja” jest obowiązkowe w arkuszu C'),
    ]);
  });

  it('reports points outside the sheet scale', () => {
    expect(errors('C', scoresFor('C', [5, 4, 5, 5, 5]))).toEqual([
      'Ocena kryterium „Rzetelność” musi wynosić 1, 3, 5, 7 lub 9 pkt (podano 4).',
    ]);
  });

  it('reports an unknown criterion', () => {
    const scores = scoresFor(
      'C',
      [5, 5, 5, 5, 5],
      [{ criterionId: 'xyz', points: 5 }],
    );
    expect(errors('C', scores)).toEqual(['Nieznane kryterium „xyz”.']);
  });

  it('accepts up to 3 distinct additional criteria', () => {
    const scores = scoresFor(
      'A',
      [5, 5, 5, 5, 5, 5],
      [
        { criterionId: 'kreatywnosc', points: 5 },
        { criterionId: 'negocjowanie', points: 5 },
        { criterionId: 'rzetelnosc', points: 5 },
      ],
    );
    expect(errors('A', scores)).toEqual([]);
  });
});
