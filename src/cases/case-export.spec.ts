import { toExport } from './case-export.js';
import {
  CASE_EXPORT_SCHEMA_VERSION,
  caseExportSchema,
} from './case-export.schema.js';
import type { CaseRecord } from './case.types.js';
import { toDetail } from './case-view.js';
import { buildSeed, EVALUATORS, OFFICE_NAME } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const AT = new Date('2026-11-21T10:00:00Z');
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;
const evaluatorOf = (r: CaseRecord) =>
  EVALUATORS.find((e) => e.id === r.evaluatorId)!;
const detail = (
  r: CaseRecord,
  actor: 'EVALUATOR' | 'EMPLOYEE' | null = 'EVALUATOR',
) => toDetail(r, TODAY, evaluatorOf(r), OFFICE_NAME, actor);

describe('toExport', () => {
  it('exports every seed case in the documented format', () => {
    for (const record of buildSeed(TODAY)) {
      const out = toExport(detail(record), AT);
      expect(() => caseExportSchema.parse(out), record.id).not.toThrow();
      expect(out.schemaVersion).toBe(CASE_EXPORT_SCHEMA_VERSION);
    }
  });

  it('has parts I, II and III of the sheet with the criteria of the case', () => {
    const record = seed('c-001');
    const out = toExport(detail(record), AT);
    expect(out.exportedAt).toBe('2026-11-21T10:00:00.000Z');
    expect(out.sheet).toMatchObject({ id: 'C', annex: 'Załącznik nr 4' });
    expect(out.partI.criteria.map((c) => [c.id, c.mandatory])).toEqual([
      ['wykorzystywanie_wiedzy', true],
      ['rzetelnosc', true],
      ['organizacja_pracy', true],
      ['wspolpraca', true],
      ['komunikacja', true],
      ['myslenie_analityczne', false],
    ]);
    expect(out.partII.scores.map((s) => s.id)).toEqual(
      out.partI.criteria.map((c) => c.id),
    );
    for (const s of out.partII.scores) {
      expect(s.points).toBe(record.decisions[s.id] ?? null);
    }
    expect(out.partII.iprz).toBe(record.iprz);
    expect(out.partIII).toHaveProperty('attached');
  });

  it('keeps out what is not on the sheet', () => {
    const out = toExport(detail(seed('c-001')), AT);
    expect(out).not.toHaveProperty('observations');
    expect(out).not.toHaveProperty('history');
    expect(out.assessed).not.toHaveProperty('hiredOn');
  });

  it('follows the view of the assessed person before the hand-over', () => {
    const record = seed('c-001');
    expect(record.sentForAckOn).toBeNull();
    const out = toExport(detail(record, 'EMPLOYEE'), AT);
    expect(out.partII.scores.every((s) => s.points === null)).toBe(true);
    expect(out.partII.justification).toBe('');
    expect(out.partII.evaluation).toBeNull();
  });
});
