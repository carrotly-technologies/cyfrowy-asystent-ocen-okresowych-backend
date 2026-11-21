import type { CaseRecord } from './case.types.js';
import { formalCheck } from './formal-check.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;

const item = (record: CaseRecord, id: string, today = TODAY) =>
  formalCheck(record, today).find((i) => i.id === id);

const decided = (points: number[]): CaseRecord => {
  const r = seed('c-001');
  const ids = [
    'wykorzystywanie_wiedzy',
    'rzetelnosc',
    'organizacja_pracy',
    'wspolpraca',
    'komunikacja',
    'myslenie_analityczne',
  ];
  return {
    ...r,
    decisions: Object.fromEntries(ids.map((id, i) => [id, points[i]])),
  };
};

describe('formalCheck: periodic', () => {
  it('a fresh assessment lists the missing criteria, justification and IPRZ', () => {
    const items = formalCheck(seed('c-001'), TODAY);
    expect(items.map((i) => [i.id, i.ok])).toEqual([
      ['PART_I_CONFIRMED', true],
      ['ALL_CRITERIA_DECIDED', false],
      ['POINTS_IN_SCALE', true],
      ['ADDITIONAL_CRITERIA_CONSISTENT', true],
      ['ASSESSMENT_TALK_HELD', false],
      ['JUSTIFICATION_IF_NEGATIVE', false],
      ['IPRZ_REQUIRED', false],
      ['PROMOTION_REQUEST', false],
    ]);
    expect(item(seed('c-001'), 'ALL_CRITERIA_DECIDED')?.message).toContain(
      '„Myślenie analityczne”',
    );
    for (const i of items) expect(i.legalBasis).toBeTruthy();
  });

  it('justification is optional for a positive and required for a negative result', () => {
    expect(
      item(decided([5, 5, 5, 5, 5, 7]), 'JUSTIFICATION_IF_NEGATIVE')?.ok,
    ).toBe(true);
    const negative = decided([5, 1, 5, 5, 5, 7]); // a single 1 pkt -> NEGATIVE
    expect(item(negative, 'JUSTIFICATION_IF_NEGATIVE')).toMatchObject({
      ok: false,
      legalBasis: expect.stringContaining('§11 ust. 3–4'),
    });
    expect(
      item({ ...negative, justification: 'Opis.' }, 'JUSTIFICATION_IF_NEGATIVE')
        ?.ok,
    ).toBe(true);
  });

  it('requires the assessment talk before signing (§10)', () => {
    const r = decided([7, 7, 7, 7, 7, 7]);
    expect(item(r, 'ASSESSMENT_TALK_HELD')?.ok).toBe(false);
    expect(
      item({ ...r, assessmentTalkOn: TODAY }, 'ASSESSMENT_TALK_HELD')?.ok,
    ).toBe(true);
  });

  it('IPRZ is always required', () => {
    const r = decided([7, 7, 7, 7, 7, 7]);
    expect(item(r, 'IPRZ_REQUIRED')?.ok).toBe(false);
    // the assessment itself contains the IPRZ conclusions (art. 81 ust. 5)
    expect(item(r, 'IPRZ_REQUIRED')?.legalBasis).toMatch(/^art\. 81 ust\. 5/);
    expect(item({ ...r, iprz: 'Plan rozwoju.' }, 'IPRZ_REQUIRED')?.ok).toBe(
      true,
    );
  });

  it('detects criteria in part II that were not set in part I', () => {
    const r = { ...decided([5, 5, 5, 5, 5, 5]) };
    r.decisions = { ...r.decisions, kreatywnosc: 5 };
    expect(item(r, 'ADDITIONAL_CRITERIA_CONSISTENT')).toMatchObject({
      ok: false,
      message: expect.stringContaining('„Kreatywność”'),
    });
  });

  it('detects points outside the scale', () => {
    expect(item(decided([5, 5, 4, 5, 5, 5]), 'POINTS_IN_SCALE')?.ok).toBe(
      false,
    );
  });

  it('all green for a complete positive assessment', () => {
    const base = decided([5, 7, 5, 7, 5, 7]);
    const r = {
      ...base,
      iprz: 'Plan.',
      assessmentTalkOn: TODAY,
      promotionRequest: { ...base.promotionRequest, attached: 'NO' as const },
    };
    expect(formalCheck(r, TODAY).every((i) => i.ok)).toBe(true);
  });
});
