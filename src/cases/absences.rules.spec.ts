import {
  continuousAbsences,
  extendAssessmentDue,
  isLongerThanMonth,
  oneMonthPeriodEnd,
  withAbsenceExtension,
} from './absences.rules.js';

describe('continuousAbsences (liczenie terminów: nieobecności)', () => {
  it('example of the challenge: sick leave 5–16.10.2026 and leave 19.10–6.11.2026 are one absence (weekend 17–18.10)', () => {
    const [period, ...rest] = continuousAbsences([
      { from: '2026-10-19', to: '2026-11-06' },
      { from: '2026-10-05', to: '2026-10-16' },
    ]);
    expect(rest).toEqual([]);
    expect(period).toEqual({
      from: '2026-10-05',
      to: '2026-11-06',
      days: 33,
      longerThanMonth: true,
    });
  });

  it('a working day between two absences breaks the continuity', () => {
    const periods = continuousAbsences([
      { from: '2026-10-05', to: '2026-10-15' },
      { from: '2026-10-19', to: '2026-11-06' },
    ]);
    expect(periods.map((p) => [p.from, p.to])).toEqual([
      ['2026-10-05', '2026-10-15'],
      ['2026-10-19', '2026-11-06'],
    ]);
    expect(periods.every((p) => !p.longerThanMonth)).toBe(true);
  });

  it('a public holiday between absences does not break it (11.11.2026 is a Wednesday)', () => {
    const periods = continuousAbsences([
      { from: '2026-11-02', to: '2026-11-10' },
      { from: '2026-11-12', to: '2026-11-20' },
    ]);
    expect(periods).toHaveLength(1);
    expect(periods[0].days).toBe(19);
  });

  it('merges overlapping and adjacent absences', () => {
    const periods = continuousAbsences([
      { from: '2026-03-02', to: '2026-03-10' },
      { from: '2026-03-08', to: '2026-03-12' },
      { from: '2026-03-13', to: '2026-03-13' },
    ]);
    expect(periods.map((p) => [p.from, p.to])).toEqual([
      ['2026-03-02', '2026-03-13'],
    ]);
  });

  it('ignores unjustified absences, also as a bridge', () => {
    const periods = continuousAbsences([
      { from: '2026-10-05', to: '2026-10-14' },
      { from: '2026-10-15', to: '2026-10-16', justified: false },
      { from: '2026-10-19', to: '2026-11-20' },
    ]);
    expect(periods).toHaveLength(2);
  });
});

describe('isLongerThanMonth (art. 112 KC)', () => {
  it.each([
    ['2026-10-05', '2026-11-04', false],
    ['2026-10-05', '2026-11-05', true],
    ['2026-02-01', '2026-02-28', false],
    ['2026-02-01', '2026-03-01', true],
    ['2026-03-01', '2026-03-31', false],
    ['2025-01-31', '2025-02-28', false],
    ['2025-01-31', '2025-03-01', true],
  ])('%s – %s: %s', (from, to, expected) => {
    expect(isLongerThanMonth({ from, to })).toBe(expected);
  });

  it('one-month period from 31.01.2024 (leap year) ends on 29.02.2024', () => {
    expect(oneMonthPeriodEnd('2024-01-31')).toBe('2024-02-29');
  });
});

describe('extendAssessmentDue (art. 81 ust. 7)', () => {
  const absences = [
    { from: '2026-10-05', to: '2026-10-16' },
    { from: '2026-10-19', to: '2026-11-06' },
  ];

  it('extends the due date by the days of an absence longer than a month', () => {
    // 2027-12-01 + 33 days = 2028-01-03 (Monday)
    const result = extendAssessmentDue('2027-12-01', '2025-12-01', absences);
    expect(result.days).toBe(33);
    expect(result.date).toBe('2028-01-03');
    expect(result.periods).toHaveLength(1);
  });

  it('shifts the extended date from a weekend to Monday', () => {
    // 2027-11-30 + 33 days = 2028-01-02 (Sunday) -> 2028-01-03
    expect(extendAssessmentDue('2027-11-30', '2025-12-01', absences).date).toBe(
      '2028-01-03',
    );
  });

  it('does not extend for a short absence or an absence outside the period', () => {
    expect(
      extendAssessmentDue('2027-12-01', '2025-12-01', [
        { from: '2026-10-05', to: '2026-10-16' },
      ]).days,
    ).toBe(0);
    expect(extendAssessmentDue('2027-12-01', '2026-12-01', absences).days).toBe(
      0,
    );
  });

  it('counts only the days inside the assessment period', () => {
    expect(extendAssessmentDue('2027-10-20', '2025-10-20', absences).days).toBe(
      33,
    );
    expect(extendAssessmentDue('2028-10-20', '2026-10-20', absences).days).toBe(
      18,
    );
  });

  it('withAbsenceExtension: no extension after a negative assessment (art. 81 ust. 9)', () => {
    const spec = { date: '2027-12-01', label: 'x', legalBasis: 'art. 81' };
    const negative = withAbsenceExtension(
      {
        cycleStart: {
          kind: 'PREVIOUS_NEGATIVE',
          assessedOn: '2026-01-01',
          acknowledgedOn: '2026-01-02',
        },
        partI: { confirmedByEvaluatorOn: '2026-01-05' },
        absences,
      },
      spec,
    );
    expect(negative).toBe(spec);
    const positive = withAbsenceExtension(
      {
        cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: '2025-11-20' },
        partI: { confirmedByEvaluatorOn: '2025-12-01' },
        absences,
      },
      spec,
    );
    expect(positive.date).toBe('2028-01-03');
    expect(positive.legalBasis).toContain('art. 81 ust. 7');
    expect(positive.legalBasis).toContain('05.10.2026–06.11.2026');
  });
});
