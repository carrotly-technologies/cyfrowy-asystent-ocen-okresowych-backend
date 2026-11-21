import { CaseRuleError } from './case-rule.error.js';
import type { CaseRecord } from './case.types.js';
import {
  changeDueDate,
  dueChangeBlocker,
  positionChangeEffect,
  reassignEvaluator,
  sixMonthsBlocker,
} from './due-date-change.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const EV = { name: 'X', role: 'Oceniający' };
const seed = (id: string): CaseRecord =>
  structuredClone(buildSeed(TODAY).find((c) => c.id === id)!);

describe('changeDueDate (art. 81 ust. 8, §8 rozp. 2016)', () => {
  it('changes the due date, logs it and records the written notice', () => {
    const record = seed('c-001');
    const before = record.partI.assessmentDue;
    const { record: next, change } = changeDueDate(
      record,
      {
        newDate: '2027-02-15',
        reason: 'EVALUATOR_ABSENCE_EXPECTED',
        by: { name: 'Joanna Kamińska', role: 'Oceniający' },
        note: 'Planowany urlop.',
      },
      TODAY,
    );
    expect(next.partI.assessmentDue).toBe('2027-02-15');
    expect(change).toMatchObject({
      from: before,
      to: '2027-02-15',
      reasonCode: 'EVALUATOR_ABSENCE_EXPECTED',
      legalBasis: 'art. 81 ust. 8 pkt 3 ustawy o służbie cywilnej',
      by: { name: 'Joanna Kamińska', role: 'Oceniający' },
    });
    expect(change.notice!.text).toContain(
      'Kopię niniejszego pisma dołącza się do arkusza',
    );
    expect(next.dueDateChanges).toHaveLength(1);
    expect(next.history.at(-1)!.text).toContain('Zmieniono termin');
    expect(record.partI.assessmentDue).toBe(before); // pure
  });

  it('a weekend date moves to the next working day (Saturday 13.02.2027 -> Monday 15.02.2027)', () => {
    const { change } = changeDueDate(
      seed('c-001'),
      { newDate: '2027-02-13', reason: 'EVALUEE_REQUEST', by: EV },
      TODAY,
    );
    expect(change.to).toBe('2027-02-15');
  });

  it('6-month condition: blocked when the last assessment was 11 days ago', () => {
    const record = seed('c-002'); // previous assessment 11 days ago
    expect(sixMonthsBlocker(record, TODAY)).toContain(
      'upłynęło więcej niż 6 miesięcy',
    );
    expect(() =>
      changeDueDate(
        record,
        { newDate: '2027-06-01', reason: 'EVALUEE_REQUEST', by: EV },
        TODAY,
      ),
    ).toThrow(CaseRuleError);
  });

  it('6-month condition: exactly 6 months is not "more than"', () => {
    const record = seed('c-001');
    record.cycleStart = { kind: 'PREVIOUS_POSITIVE', assessedOn: '2026-05-21' };
    expect(sixMonthsBlocker(record, '2026-11-21')).not.toBeNull();
    expect(sixMonthsBlocker(record, '2026-11-22')).toBeNull();
  });

  it('first assessment: the assessed period must be longer than 6 months', () => {
    const record = seed('c-001');
    record.cycleStart = { kind: 'HIRED', date: '2026-08-01' };
    expect(sixMonthsBlocker(record, TODAY)).toContain('dłuższy niż 6 miesięcy');
  });

  it('the re-assessment after a negative one cannot be changed (art. 81 ust. 9)', () => {
    const record = seed('c-005');
    record.partI.assessmentDue = '2027-05-24';
    expect(dueChangeBlocker(record, 'EVALUEE_REQUEST', TODAY)).toContain(
      'art. 81 ust. 9',
    );
    expect(dueChangeBlocker(record, 'ABSENCE_EXTENSION', TODAY)).toContain(
      'art. 81 ust. 9',
    );
  });

  it('a signed assessment or a past date is refused', () => {
    expect(dueChangeBlocker(seed('c-006'), 'EVALUEE_REQUEST', TODAY)).toContain(
      'sporządzona',
    );
    expect(() =>
      changeDueDate(
        seed('c-001'),
        { newDate: '2026-11-20', reason: 'EVALUEE_REQUEST', by: EV },
        TODAY,
      ),
    ).toThrow(CaseRuleError);
  });
});

describe('change of position (§9 rozp. 2016) and of evaluator (§9 ust. 3)', () => {
  it('within 6 months of the last assessment: part I again within 30 days', () => {
    const record = seed('c-002'); // last assessment 11 days ago
    const effect = positionChangeEffect(record, '2026-11-23');
    expect(effect.effect).toBe('REDO_PART_I');
    expect(effect.deadline).toBe('2026-12-23');
    expect(effect.legalBasis).toContain('§9 ust. 1');
  });

  it('later: an assessment between 7 days before and 30 days after', () => {
    const effect = positionChangeEffect(seed('c-001'), '2026-12-01');
    expect(effect).toMatchObject({
      effect: 'ASSESSMENT',
      earliest: '2026-11-24',
      deadline: '2026-12-31',
    });
  });

  it('30 days ending on a Saturday move to Monday', () => {
    // 2026-12-07 + 30 days = 2027-01-06 (Trzech Króli) -> 2027-01-07
    expect(positionChangeEffect(seed('c-001'), '2026-12-07').deadline).toBe(
      '2027-01-07',
    );
  });

  it('a new evaluator keeps the criteria chosen earlier', () => {
    const record = seed('c-003');
    const next = reassignEvaluator(record, 'ev-sikora', 'Robert Sikora', TODAY);
    expect(next.evaluatorId).toBe('ev-sikora');
    expect(next.partI).toEqual(record.partI);
    expect(next.history.at(-1)!.text).toContain('§9 ust. 3');
    expect(() =>
      reassignEvaluator(seed('c-006'), 'ev-sikora', 'R', TODAY),
    ).toThrow(CaseRuleError);
  });
});
