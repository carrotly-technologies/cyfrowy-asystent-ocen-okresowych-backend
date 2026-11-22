import { applyAction } from './actions.rules.js';
import { CaseRuleError } from './case-rule.error.js';
import type { CaseRecord } from './case.types.js';
import { addObservation, observationLock } from './patch.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;

const input = (criterionId: string) => ({
  date: '2026-11-20',
  criterionId,
  kind: 'STRENGTH' as const,
  situation: 'S',
  action: 'A',
  result: 'R',
});

describe('observation journal: open until the assessment is signed', () => {
  it('is open in the observation period', () => {
    const r = seed('c-003');
    expect(r.stage).toBe('OBSERVATION');
    expect(observationLock(r)).toBeNull();
  });

  it('stays open at the assessment talk stage (after START_ASSESSMENT)', () => {
    const r = applyAction(seed('c-003'), 'START_ASSESSMENT', TODAY);
    expect(r.stage).toBe('ASSESSMENT');
    expect(observationLock(r)).toBeNull();
    const criterion = r.observations[0]?.criterionId ?? 'komunikacja';
    const next = addObservation(r, input(criterion), 'o-new', TODAY);
    expect(next.observations).toHaveLength(r.observations.length + 1);
  });

  it('is closed with a Polish reason once the evaluator signed', () => {
    const r = { ...seed('c-003'), signedByEvaluatorOn: '2026-11-20' };
    expect(observationLock(r)).toMatch(/Ocena została podpisana/);
    expect(() =>
      addObservation(r, input('komunikacja'), 'o-new', TODAY),
    ).toThrow(CaseRuleError);
  });

  it('is closed before part I is confirmed', () => {
    const r = seed('c-004');
    expect(observationLock(r)).toMatch(/potwierdź część I/);
  });
});
