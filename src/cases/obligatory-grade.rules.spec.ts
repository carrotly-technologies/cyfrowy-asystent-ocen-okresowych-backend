import type { CaseRecord } from './case.types.js';
import {
  obligatoryGradeFor,
  obligatoryNextGrade,
  topLevels,
} from './obligatory-grade.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  structuredClone(buildSeed(TODAY).find((c) => c.id === id)!);

const top = (date: string, level = 'Powyżej oczekiwań') => ({
  date,
  result: 'POSITIVE' as const,
  level,
});

describe('obligatory next civil-service grade (art. 89 ust. 2)', () => {
  it('the two highest levels come from the scale', () => {
    expect(topLevels()).toEqual([
      'znacznie powyżej oczekiwań',
      'powyżej oczekiwań',
    ]);
  });

  it('two consecutive top-level positive assessments of an urzędnik: due', () => {
    expect(
      obligatoryNextGrade({
        employment: 'URZEDNIK',
        lastGradeGrantedOn: null,
        assessments: [
          top('2024-11-01', 'znacznie powyżej oczekiwań'),
          top('2026-11-01'),
        ],
      }),
    ).toBe(true);
  });

  it('not for a pracownik, nor with a level "na poziomie oczekiwań" in between', () => {
    expect(
      obligatoryNextGrade({
        employment: 'PRACOWNIK',
        lastGradeGrantedOn: null,
        assessments: [top('2024-11-01'), top('2026-11-01')],
      }),
    ).toBe(false);
    expect(
      obligatoryNextGrade({
        employment: 'URZEDNIK',
        lastGradeGrantedOn: null,
        assessments: [
          top('2022-11-01'),
          top('2024-11-01', 'Na poziomie oczekiwań'),
          top('2026-11-01'),
        ],
      }),
    ).toBe(false);
  });

  it('only assessments after the last grade count', () => {
    expect(
      obligatoryNextGrade({
        employment: 'URZEDNIK',
        lastGradeGrantedOn: '2025-01-10',
        assessments: [top('2024-11-01'), top('2026-11-01')],
      }),
    ).toBe(false);
  });

  it('a negative assessment never counts', () => {
    expect(
      obligatoryNextGrade({
        employment: 'URZEDNIK',
        lastGradeGrantedOn: null,
        assessments: [
          top('2024-11-01'),
          {
            date: '2026-11-01',
            result: 'NEGATIVE',
            level: 'Powyżej oczekiwań',
          },
        ],
      }),
    ).toBe(false);
  });

  it('seed c-006: previous "powyżej", this one "Powyżej oczekiwań" -> 30 days from acknowledgement', () => {
    const grade = obligatoryGradeFor(seed('c-006'), null);
    expect(grade).not.toBeNull();
    expect(grade!.legalBasis).toContain('art. 89 ust. 2');
    expect(grade!.deadline > TODAY).toBe(true);
  });

  it('not before the assessed person acknowledged the assessment', () => {
    const record = seed('c-006');
    record.acknowledgedOn = null;
    expect(obligatoryGradeFor(record, null)).toBeNull();
  });
});
