import { CaseRuleError, CaseValidationError } from './case-rule.error.js';
import type { CaseRecord } from './case.types.js';
import {
  applyCorrection,
  caseLocks,
  correctableFields,
  displayValue,
} from './correction.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;
const meta = {
  id: 'k-1',
  at: '2026-11-21T10:00:00.000Z',
  today: TODAY,
  by: { userId: 'u-admin', name: 'Marek Zając' },
};
const REASON = 'Błąd przepisania z wersji papierowej arkusza.';

describe('correction rules (tryb korekty błędów przez administratora)', () => {
  it('corrects a score of a signed assessment and audits old → new', () => {
    const signed = seed('c-006');
    const { record, correction } = applyCorrection(
      signed,
      { field: 'decisions.komunikacja', value: 7, reason: REASON },
      meta,
    );
    expect(record.decisions.komunikacja).toBe(7);
    expect(signed.decisions.komunikacja).toBe(5);
    expect(correction).toMatchObject({
      field: 'decisions.komunikacja',
      label: 'Ocena cząstkowa: Komunikacja',
      section: 'Część II',
      oldValue: '5 pkt',
      newValue: '7 pkt',
      reason: REASON,
      by: { name: 'Marek Zając' },
    });
    expect(record.corrections).toEqual([correction]);
    expect(record.history.at(-1)!.text).toContain(
      'Korekta błędu przez administratora (Marek Zając)',
    );
    expect(record.history.at(-1)!.text).toContain(REASON);
  });

  it('requires a reason', () => {
    expect(() =>
      applyCorrection(
        seed('c-006'),
        { field: 'iprz', value: 'nowy tekst', reason: ' krótki ' },
        meta,
      ),
    ).toThrow(CaseValidationError);
  });

  it('refuses a field that is not locked yet (the evaluator edits it)', () => {
    expect(() =>
      applyCorrection(
        seed('c-001'),
        { field: 'iprz', value: 'x', reason: REASON },
        meta,
      ),
    ).toThrow(CaseRuleError);
  });

  it('corrects part I after the confirmation and keeps the stage date in sync', () => {
    const { record } = applyCorrection(
      seed('c-003'),
      {
        field: 'partI.confirmedByEvaluatorOn',
        value: '2025-09-18',
        reason: REASON,
      },
      meta,
    );
    expect(record.partI.confirmedByEvaluatorOn).toBe('2025-09-18');
    expect(record.completedOn.OPENING_TALK).toBe('2025-09-18');
  });

  it('validates values: scale, dates from the future, unknown fields', () => {
    const signed = seed('c-006');
    expect(() =>
      applyCorrection(
        signed,
        { field: 'decisions.komunikacja', value: 4, reason: REASON },
        meta,
      ),
    ).toThrow(/musi mieć jedną z wartości/);
    expect(() =>
      applyCorrection(
        signed,
        { field: 'acknowledgedOn', value: '2027-01-01', reason: REASON },
        meta,
      ),
    ).toThrow(/z przyszłości/);
    expect(() =>
      applyCorrection(
        signed,
        { field: 'person.lastName', value: 'X', reason: REASON },
        meta,
      ),
    ).toThrow(CaseValidationError);
    expect(() =>
      applyCorrection(
        signed,
        { field: 'decisions.komunikacja', value: 5, reason: REASON },
        meta,
      ),
    ).toThrow(/taka sama/);
  });

  it('sets the requested grade to the next one when the current grade is corrected', () => {
    const signed = structuredClone(seed('c-006'));
    signed.promotionRequest.attached = 'YES';
    const { record } = applyCorrection(
      signed,
      { field: 'promotionRequest.currentGrade', value: 'III', reason: REASON },
      meta,
    );
    expect(record.promotionRequest.requestedGrade).toBe('IV');
  });

  it('hides urzędnik-only fields for a pracownik służby cywilnej', () => {
    const fields = correctableFields(seed('c-101')).map((f) => f.field);
    expect(fields).toContain('decisions.komunikacja');
    expect(fields).not.toContain('promotionRequest.attached');
  });

  it('describes locks and displays values as on the sheet', () => {
    expect(caseLocks(seed('c-004'))).toEqual({ partI: null, partII: null });
    const locks = caseLocks(seed('c-006'));
    expect(locks.partI).toMatch(/Część I zablokowana/);
    expect(locks.partII).toMatch(/trybie korekty/);
    expect(displayValue('DATE', '2026-11-21')).toBe('21.11.2026');
    expect(displayValue('TEXT', '')).toBe('(puste)');
  });
});
