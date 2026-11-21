import {
  addMonths,
  daysTermEnd,
  easterSunday,
  isNonWorkingDay,
  monthsTermEnd,
  shiftToWorkingDay,
} from './dates.js';
import {
  assessmentDueDeadline,
  cycleAnchor,
  defaultAssessmentDue,
  rawAssessmentDue,
  describeDaysLeft,
  objectionDeadline,
  openingTalkDeadline,
  reassessmentAfterNegativeDue,
  toDeadline,
} from './deadlines.rules.js';

describe('term arithmetic (art. 110–115 KC, examples from the poradnik)', () => {
  it('R1: 30 days from 4.09.2015 end on 4.10.2015', () => {
    expect(daysTermEnd('2015-09-04', 30)).toBe('2015-10-04');
  });

  it('R1: 21 days from 23.11.2015 end on 14.12.2015', () => {
    expect(daysTermEnd('2015-11-23', 21)).toBe('2015-12-14');
  });

  it.each([
    ['2024-03-16', 24, '2026-03-16'],
    ['2024-01-31', 13, '2025-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2013-12-04', 24, '2015-12-04'],
  ])('R2: %s + %d months = %s', (start, months, end) => {
    expect(monthsTermEnd(start, months)).toBe(end);
  });

  it('R3: a term ending on Sunday moves to Monday (4.10.2015 -> 5.10.2015)', () => {
    expect(shiftToWorkingDay('2015-10-04')).toBe('2015-10-05');
  });

  it('R3: Saturday and holidays are non-working days', () => {
    expect(isNonWorkingDay('2026-11-21')).toBe(true); // Saturday
    expect(isNonWorkingDay('2026-11-11')).toBe(true); // Święto Niepodległości
    expect(isNonWorkingDay('2026-12-24')).toBe(true); // Wigilia (since 2025)
    expect(isNonWorkingDay('2024-12-24')).toBe(false);
    expect(isNonWorkingDay('2026-11-20')).toBe(false);
    expect(shiftToWorkingDay('2026-12-24')).toBe('2026-12-28');
  });

  it('computes Easter and the movable holidays', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(isNonWorkingDay('2026-04-06')).toBe(true); // Poniedziałek Wielkanocny
    expect(isNonWorkingDay('2026-06-04')).toBe(true); // Boże Ciało
  });

  it('addMonths clamps to the end of month backwards too', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('opening talk (§7 rozp. 2016)', () => {
  it('30 days after a positive assessment, with legal basis', () => {
    const spec = openingTalkDeadline({
      kind: 'PREVIOUS_POSITIVE',
      assessedOn: '2026-11-10',
    });
    expect(spec.date).toBe('2026-12-10');
    expect(spec.legalBasis).toContain('§7 pkt 1');
  });

  it('30 days after an indefinite contract, shifted from a Sunday', () => {
    const spec = openingTalkDeadline({ kind: 'HIRED', date: '2015-09-04' });
    expect(spec.date).toBe('2015-10-05');
    expect(spec.legalBasis).toContain('art. 115 KC');
  });

  it('7 days after a negative assessment', () => {
    const spec = openingTalkDeadline({
      kind: 'PREVIOUS_NEGATIVE',
      assessedOn: '2026-11-17',
      acknowledgedOn: '2026-11-18',
    });
    expect(spec.date).toBe('2026-11-24');
    expect(spec.legalBasis).toContain('§7 pkt 2');
  });
});

describe('assessment due date', () => {
  it('anchors the 24-month period at employment or the previous assessment', () => {
    expect(cycleAnchor({ kind: 'HIRED', date: '2025-03-03' })).toBe(
      '2025-03-03',
    );
    expect(
      cycleAnchor({ kind: 'PREVIOUS_POSITIVE', assessedOn: '2024-11-29' }),
    ).toBe('2024-11-29');
    // 24 months from the previous assessment, not from the day part I was accepted
    expect(
      defaultAssessmentDue(
        cycleAnchor({ kind: 'PREVIOUS_POSITIVE', assessedOn: '2024-11-29' }),
      ),
    ).toBe('2026-11-30'); // 29.11.2026 is a Sunday
    expect(rawAssessmentDue('2024-11-29')).toBe('2026-11-29');
  });

  it('defaults to 24 months from the anchor (art. 81 ust. 4)', () => {
    expect(defaultAssessmentDue('2024-12-04')).toBe('2026-12-04');
    // 2026-11-15 is a Sunday
    expect(defaultAssessmentDue('2024-11-15')).toBe('2026-11-16');
  });

  it('after a negative one: day after 6 months from acknowledgement (art. 81 ust. 9)', () => {
    // poradnik: zapoznanie 15.02.2015 -> ocena 16.08.2015 (a Sunday -> 17.08)
    expect(reassessmentAfterNegativeDue('2015-02-15')).toBe('2015-08-17');
    expect(reassessmentAfterNegativeDue('2026-11-18')).toBe('2027-05-19');
    const spec = assessmentDueDeadline(
      {
        kind: 'PREVIOUS_NEGATIVE',
        assessedOn: '2026-11-17',
        acknowledgedOn: '2026-11-18',
      },
      null,
    );
    expect(spec.date).toBe('2027-05-19');
    expect(spec.legalBasis).toContain('art. 81 ust. 9');
  });

  it('is unknown before part I in a regular cycle', () => {
    expect(
      assessmentDueDeadline(
        { kind: 'PREVIOUS_POSITIVE', assessedOn: '2026-11-10' },
        null,
      ).date,
    ).toBeNull();
  });
});

describe('objection (art. 83 ust. 1)', () => {
  it('7 days from acknowledgement', () => {
    const spec = objectionDeadline('2026-11-18');
    expect(spec.date).toBe('2026-11-25');
    expect(spec.legalBasis).toContain('art. 83 ust. 1');
  });
});

describe('toDeadline', () => {
  const spec = (date: string | null) => ({
    date,
    label: 'x',
    legalBasis: 'y',
  });

  it.each([
    ['2026-12-10', 19, 'OK'],
    ['2026-12-05', 14, 'SOON'],
    ['2026-11-21', 0, 'SOON'],
    ['2026-11-20', -1, 'OVERDUE'],
  ])('%s -> %d days, %s', (date, daysLeft, state) => {
    expect(toDeadline(spec(date), '2026-11-21')).toMatchObject({
      daysLeft,
      state,
    });
  });

  it('no date -> NONE', () => {
    expect(toDeadline(spec(null), '2026-11-21')).toMatchObject({
      date: null,
      daysLeft: null,
      state: 'NONE',
    });
  });
});

describe('describeDaysLeft', () => {
  it.each([
    [0, 'upływa dziś'],
    [1, 'został 1 dzień'],
    [3, 'zostały 3 dni'],
    [13, 'zostało 13 dni'],
    [22, 'zostały 22 dni'],
    [-1, 'po terminie 1 dzień'],
    [-5, 'po terminie 5 dni'],
  ])('%d -> %s', (days, text) => {
    expect(describeDaysLeft(days)).toBe(text);
  });
});
