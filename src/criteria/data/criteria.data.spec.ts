import { SHEETS } from '../../sheets/sheets.data.js';
import { CRITERIA_CATALOGUE, criterionName } from './criteria.data.js';

describe('CRITERIA_CATALOGUE', () => {
  const ids = CRITERIA_CATALOGUE.criteria.map((c) => c.id);

  it('has the 14 criteria of załącznik nr 1, numbered 1..14, unique ids', () => {
    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
    expect(CRITERIA_CATALOGUE.criteria.map((c) => c.number)).toEqual(
      Array.from({ length: 14 }, (_, i) => i + 1),
    );
    for (const c of CRITERIA_CATALOGUE.criteria) {
      expect(c.description.length).toBeGreaterThan(0);
    }
  });

  it('uses the 1/3/5/7/9 scale', () => {
    expect(CRITERIA_CATALOGUE.scale.map((s) => s.points)).toEqual([
      1, 3, 5, 7, 9,
    ]);
  });

  it('covers every mandatory criterion of sheets A, B and C', () => {
    for (const sheet of SHEETS) {
      for (const id of sheet.mandatoryCriteria) expect(ids).toContain(id);
    }
  });

  it('names criteria, falling back to the id', () => {
    expect(criterionName('rzetelnosc')).toBe('Rzetelność');
    expect(criterionName('nope')).toBe('nope');
  });
});
