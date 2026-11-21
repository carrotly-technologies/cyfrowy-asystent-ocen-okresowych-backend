import { describe, expect, it } from 'vitest';
import { STAGES } from '../case.types.js';
import { formalCheck } from '../formal-check.rules.js';
import { EMPLOYEE_NOWAK, buildSeed } from './seed.data.js';

const TODAY = '2026-11-21';

describe('demo seed', () => {
  const seed = buildSeed(TODAY);

  it('has 10–20 cases across sheets A, B, C, both employments, every stage', () => {
    expect(seed.length).toBeGreaterThanOrEqual(10);
    expect(seed.length).toBeLessThanOrEqual(20);
    expect(new Set(seed.map((c) => c.id)).size).toBe(seed.length);
    for (const sheet of ['A', 'B', 'C']) {
      expect(seed.some((c) => c.sheetId === sheet)).toBe(true);
    }
    for (const e of ['URZEDNIK', 'PRACOWNIK']) {
      expect(seed.some((c) => c.person.employment === e)).toBe(true);
    }
    for (const stage of STAGES) {
      expect(seed.some((c) => c.stage === stage)).toBe(true);
    }
  });

  it('gives one assessed person several cases (previous and current cycle)', () => {
    const own = seed.filter((c) => c.person.id === EMPLOYEE_NOWAK);
    expect(own.map((c) => c.id)).toEqual(['c-000', 'c-001']);
    expect(own[0].nextCaseId).toBe('c-001');
  });

  it('cases with a confirmed part I keep the stage order consistent', () => {
    for (const c of seed) {
      const index = STAGES.indexOf(c.stage);
      if (index > STAGES.indexOf('OPENING_TALK')) {
        expect(c.partI.confirmedByEvaluatorOn).not.toBeNull();
        expect(c.sheetId).not.toBeNull();
      }
      if (index > STAGES.indexOf('PART_I_ACK')) {
        expect(c.partI.acknowledgedByEmployeeOn).not.toBeNull();
      }
    }
  });

  it('signed cases pass the formal check', () => {
    for (const c of seed.filter((x) => x.signedByEvaluatorOn)) {
      const failing = formalCheck(c, TODAY).filter((i) => !i.ok);
      expect([c.id, failing]).toEqual([c.id, []]);
    }
  });
});
