import { openingTalkDeadline } from '../cases/deadlines.rules.js';
import {
  conflictingUnit,
  archiveBlocker,
  retentionUntil,
  effectiveEvaluator,
  newCycleStart,
  obligatoryPromotion,
  obligatoryPromotionNextStep,
  type PastAssessment,
} from './employees.rules.js';
import { parseHistoryCsv } from './history-import.rules.js';
import { computeStatistics, toCsv } from './statistics.rules.js';

const past = (
  assessedOn: string,
  result: 'POSITIVE' | 'NEGATIVE',
  level: string | null,
  acknowledgedOn: string | null = null,
): PastAssessment => ({
  source: 'IMPORT',
  caseId: null,
  assessedOn,
  acknowledgedOn,
  result,
  level,
});

describe('newCycleStart', () => {
  it('first assessment: from employment for an indefinite period, opening talk in 30 days (§7 pkt 1)', () => {
    const start = newCycleStart(
      { employment: 'PRACOWNIK', indefiniteSince: '2026-11-11' },
      [],
    );
    expect(start.ok && start.cycleStart).toEqual({
      kind: 'HIRED',
      date: '2026-11-11',
    });
    if (start.ok) {
      // 11.11 + 30 days = 11.12.2026 (Friday)
      expect(openingTalkDeadline(start.cycleStart).date).toBe('2026-12-11');
      expect(start.previousAssessment).toBeNull();
    }
  });

  it('after a positive assessment: from its date, previous assessment prefilled for an urzędnik', () => {
    const start = newCycleStart(
      { employment: 'URZEDNIK', indefiniteSince: '2010-01-01' },
      [
        past('2024-05-10', 'POSITIVE', 'na poziomie oczekiwań'),
        past('2026-10-01', 'POSITIVE', 'powyżej oczekiwań'),
      ],
    );
    expect(start.ok && start.cycleStart).toEqual({
      kind: 'PREVIOUS_POSITIVE',
      assessedOn: '2026-10-01',
    });
    expect(start.ok && start.previousAssessment).toEqual({
      result: 'POSITIVE',
      level: 'powyżej oczekiwań',
      date: '2026-10-01',
    });
  });

  it('after a negative assessment: 7 days (§7 pkt 2), acknowledgement date kept', () => {
    const start = newCycleStart(
      { employment: 'PRACOWNIK', indefiniteSince: null },
      [past('2026-11-17', 'NEGATIVE', 'poniżej oczekiwań', '2026-11-18')],
    );
    expect(start.ok && start.cycleStart).toEqual({
      kind: 'PREVIOUS_NEGATIVE',
      assessedOn: '2026-11-17',
      acknowledgedOn: '2026-11-18',
    });
    if (start.ok) {
      expect(openingTalkDeadline(start.cycleStart).date).toBe('2026-11-24');
      expect(start.previousAssessment).toBeNull();
    }
  });

  it('refuses without employment date and history', () => {
    const start = newCycleStart(
      { employment: 'PRACOWNIK', indefiniteSince: null },
      [],
    );
    expect(start.ok).toBe(false);
  });
});

describe('obligatoryPromotion (art. 89 ust. 2)', () => {
  const urzednik = {
    employment: 'URZEDNIK' as const,
    gradeGrantedOn: '2020-01-01',
  };

  it('two consecutive top-level positive assessments since the grade', () => {
    expect(
      obligatoryPromotion(urzednik, [
        past('2022-01-10', 'POSITIVE', 'znacznie powyżej oczekiwań'),
        past('2024-01-10', 'POSITIVE', 'Powyżej oczekiwań'),
      ]).due,
    ).toBe(true);
  });

  it('not when one of them is lower, before the grade, or for a pracownik', () => {
    const two = [
      past('2022-01-10', 'POSITIVE', 'na poziomie oczekiwań'),
      past('2024-01-10', 'POSITIVE', 'powyżej oczekiwań'),
    ];
    expect(obligatoryPromotion(urzednik, two).due).toBe(false);
    expect(
      obligatoryPromotion({ ...urzednik, gradeGrantedOn: '2023-01-01' }, [
        past('2022-01-10', 'POSITIVE', 'powyżej oczekiwań'),
        past('2024-01-10', 'POSITIVE', 'powyżej oczekiwań'),
      ]).due,
    ).toBe(false);
    expect(
      obligatoryPromotion({ employment: 'PRACOWNIK', gradeGrantedOn: null }, [
        past('2022-01-10', 'POSITIVE', 'powyżej oczekiwań'),
        past('2024-01-10', 'POSITIVE', 'powyżej oczekiwań'),
      ]).due,
    ).toBe(false);
  });
});

describe('effectiveEvaluator (zastępstwo)', () => {
  const sub = {
    id: 's',
    evaluatorId: 'ev-a',
    substituteId: 'ev-b',
    from: '2026-11-01',
    to: '2026-11-30',
    note: '',
    createdAt: '',
  };
  it('uses the substitute only within the period', () => {
    expect(effectiveEvaluator('ev-a', [sub], '2026-11-30').evaluatorId).toBe(
      'ev-b',
    );
    expect(effectiveEvaluator('ev-a', [sub], '2026-12-01').evaluatorId).toBe(
      'ev-a',
    );
    expect(effectiveEvaluator('ev-c', [sub], '2026-11-15').evaluatorId).toBe(
      'ev-c',
    );
  });
});

describe('parseHistoryCsv', () => {
  const resolve = (cell: string) =>
    cell === 'p-1' || cell === 'Anna Nowak'
      ? { id: 'p-1' }
      : { error: `nie znaleziono pracownika „${cell}” w kartotece` };

  it('parses ; and , files, Polish dates and an optional acknowledgement date', () => {
    const semi = parseHistoryCsv(
      '﻿pracownik;data_sporządzenia;ocena;poziom;data_zapoznania\np-1;12.03.2024;pozytywna;Powyżej oczekiwań;13.03.2024\n\n',
      resolve,
      '2026-11-21',
    );
    expect(semi.errors).toEqual([]);
    expect(semi.rows).toEqual([
      {
        line: 2,
        employeeId: 'p-1',
        assessedOn: '2024-03-12',
        acknowledgedOn: '2024-03-13',
        result: 'POSITIVE',
        level: 'powyżej oczekiwań',
      },
    ]);
    const comma = parseHistoryCsv(
      'pracownik,data_sporzadzenia,ocena,poziom\n"Anna Nowak",2022-01-10,negatywna,',
      resolve,
      '2026-11-21',
    );
    expect(comma.rows[0]).toMatchObject({
      employeeId: 'p-1',
      result: 'NEGATIVE',
      level: null,
    });
  });

  it('reports every bad row with its line number', () => {
    const { rows, errors } = parseHistoryCsv(
      'pracownik;data_sporzadzenia;ocena;poziom\nx;2024-13-01;dobra;super\np-1;2030-01-01;pozytywna;',
      resolve,
      '2026-11-21',
    );
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
    expect(errors[0].message).toContain('nie znaleziono pracownika');
    expect(errors[0].message).toContain('poziom wybierz ze skali');
    expect(errors[1].message).toContain('z przyszłości');
  });

  it('requires the header', () => {
    expect(
      parseHistoryCsv('a;b\n1;2', resolve, '2026-11-21').errors[0].message,
    ).toContain('Brak kolumn');
  });
});

describe('computeStatistics', () => {
  it('counts results, levels, timeliness, stages, promotions and units', () => {
    const stats = computeStatistics(
      [
        {
          unit: 'A',
          stage: 'ACKNOWLEDGEMENT',
          signedOn: '2026-01-10',
          finished: true,
          result: 'POSITIVE',
          level: 'powyżej oczekiwań',
          dueOn: '2026-02-01',
          overdue: false,
          promotionRequested: true,
        },
        {
          unit: 'A',
          stage: 'OBSERVATION',
          signedOn: null,
          finished: false,
          result: null,
          level: null,
          dueOn: '2026-01-01',
          overdue: true,
          promotionRequested: false,
        },
        {
          unit: 'B',
          stage: 'SIGNATURE',
          signedOn: '2026-03-10',
          finished: false,
          result: 'NEGATIVE',
          level: 'poniżej oczekiwań',
          dueOn: '2026-03-01',
          overdue: false,
          promotionRequested: false,
        },
      ],
      [{ unit: 'B', result: 'POSITIVE', level: 'na poziomie oczekiwań' }],
      [
        { unit: 'A', obligatoryPromotion: true },
        { unit: 'B', obligatoryPromotion: false },
      ],
    );
    expect(stats.results).toEqual({
      positive: 2,
      negative: 1,
      negativePercent: 33.3,
    });
    expect(
      stats.levels.find((l) => l.label === 'powyżej oczekiwań')?.count,
    ).toBe(1);
    expect(stats.timeliness).toEqual({
      signedOnTime: 1,
      signedLate: 1,
      openOverdue: 1,
      openOnTrack: 1,
    });
    expect(stats.stages.find((s) => s.stageId === 'OBSERVATION')?.count).toBe(
      1,
    );
    expect(stats.promotions).toEqual({ requested: 1, obligatory: 1 });
    expect(stats.units).toEqual([
      {
        unit: 'A',
        employees: 1,
        openCases: 1,
        positive: 1,
        negative: 0,
        overdue: 1,
      },
      {
        unit: 'B',
        employees: 1,
        openCases: 1,
        positive: 1,
        negative: 1,
        overdue: 0,
      },
    ]);
  });

  it('toCsv writes numbers with a decimal comma', () => {
    expect(toCsv([['Odsetek', 11.1, 3]])).toBe('\uFEFFOdsetek;11,1;3\r\n');
  });

  it('toCsv quotes cells with separators', () => {
    expect(toCsv([['a;b', 'x"y', 3]])).toBe('﻿"a;b";"x""y";3\r\n');
  });
});

describe('conflictingUnit', () => {
  const units = [
    'Wydział Legislacji, Departament Prawny',
    'Wydział Kadr i Szkoleń, Biuro Dyrektora Generalnego',
    'Sekretariat',
  ];
  it('accepts an existing unit and a new one', () => {
    expect(
      conflictingUnit('Wydział Legislacji, Departament Prawny', units),
    ).toBeNull();
    expect(
      conflictingUnit('Wydział Kontroli, Departament Prawny', units),
    ).toBeNull();
    expect(
      conflictingUnit('Wydział Kadr, Departament Prawny', units),
    ).toBeNull();
  });
  it('rejects only the first part of an existing unit (seeded duplicate in statistics)', () => {
    expect(conflictingUnit('Wydział Legislacji', units)).toBe(units[0]);
  });
  it('rejects the same name written differently or with a part added', () => {
    expect(
      conflictingUnit('  wydział legislacji,  departament prawny', units),
    ).toBe(units[0]);
    expect(conflictingUnit('Sekretariat, Biuro Ministra', units)).toBe(
      'Sekretariat',
    );
  });
});

describe('obligatoryPromotionNextStep', () => {
  const fmt = (d: string) => d.split('-').reverse().join('.');
  it('gives the date to grant the grade by, or says it passed', () => {
    expect(
      obligatoryPromotionNextStep('2026-12-21', '2026-11-21', fmt),
    ).toContain('do 21.12.2026');
    expect(
      obligatoryPromotionNextStep('2024-12-27', '2026-11-21', fmt),
    ).toContain('niezwłocznie: termin upłynął 27.12.2024');
    expect(obligatoryPromotionNextStep(null, '2026-11-21', fmt)).toContain(
      '30 dni od zapoznania',
    );
  });
});

describe('archiveBlocker (akta osobowe, art. 94 pkt 9b KP)', () => {
  it('no assessment or retention over: allowed', () => {
    expect(
      archiveBlocker({ assessedOn: [], today: '2026-11-21', role: 'HR' }),
    ).toBeNull();
    expect(
      archiveBlocker({
        assessedOn: ['2016-11-20'],
        today: '2026-11-21',
        role: 'HR',
      }),
    ).toBeNull();
  });

  it('within 10 years of the latest assessment: only ADMIN with a reason', () => {
    const input = {
      assessedOn: ['2016-01-01', '2024-11-29'],
      today: '2026-11-21',
    };
    expect(retentionUntil(input.assessedOn)).toBe('2034-11-29');
    expect(archiveBlocker({ ...input, role: 'HR', reason: 'x' })).toContain(
      '29.11.2034',
    );
    expect(archiveBlocker({ ...input, role: 'ADMIN' })).toContain(
      'administrator',
    );
    expect(
      archiveBlocker({ ...input, role: 'ADMIN', reason: 'Błędna kartoteka' }),
    ).toBeNull();
  });
});
