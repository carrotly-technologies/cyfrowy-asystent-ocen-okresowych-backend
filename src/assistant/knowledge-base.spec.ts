import { KnowledgeBase } from './knowledge-base.js';

describe('KnowledgeBase retrieval', () => {
  const kb = new KnowledgeBase();
  const top = (q: string, k = 5) =>
    kb.search(q, { k, exclude: ['QA'] }).map((h) => h.chunk.ref);

  it('ships chunks of every source with a citable ref', () => {
    const docs = new Set(kb.chunks.map((c) => c.doc));
    expect([...docs].sort()).toEqual(
      ['AB', 'AC', 'LT', 'PO', 'QA', 'RO', 'SZ', 'U', 'UC'].sort(),
    );
    for (const c of kb.chunks) {
      expect(c.ref).toBeTruthy();
      expect(c.text.length).toBeGreaterThan(20);
    }
  });

  it('has the sheets B and C', () => {
    for (const doc of ['AB', 'AC'] as const) {
      expect(kb.chunks.some((c) => c.doc === doc)).toBe(true);
    }
    expect(
      kb.chunks.some(
        (c) => c.doc === 'AB' && c.text.includes('Zarządzanie ludźmi'),
      ),
    ).toBe(true);
  });

  it('answers a question on feedback from the HR management standards', () => {
    const hits = kb.search(
      'Jaka powinna być informacja zwrotna dla pracownika w standardach zarządzania zasobami ludzkimi?',
      { exclude: ['QA'] },
    );
    expect(hits.some((h) => h.chunk.doc === 'SZ')).toBe(true);
  });

  it('has no first-assessment Q&A entries', () => {
    expect(kb.chunks.some((c) => c.qa && /\[(RP|PP)\]/.test(c.qa.source))).toBe(
      false,
    );
  });

  it('chunks acts by legal unit', () => {
    const art = kb.chunks.find((c) =>
      c.ref.startsWith('art. 81 ust. 4 ustawy o służbie cywilnej'),
    );
    expect(art?.text).toContain('co 24 miesiące');
  });

  it.each([
    ['Jak często sporządza się ocenę okresową?', 'art. 81 ust. 4'],
    ['W jakim terminie przysługuje sprzeciw od oceny okresowej?', 'art. 83'],
    [
      'Co zrobić, gdy pracownik jest nieobecny dłużej niż miesiąc?',
      'art. 81 ust. 7',
    ],
    ['Kiedy używa się arkusza A, B, a kiedy C?', '§ 3'],
  ])('finds the rule for "%s"', (question, ref) => {
    expect(top(question).some((r) => r.startsWith(ref))).toBe(true);
  });

  it('returns nothing for questions outside the domain', () => {
    expect(kb.search('Jak upiec sernik?')).toEqual([]);
  });

  it('filters by document', () => {
    const qa = kb.search('sprzeciw od oceny', { only: ['QA'] });
    expect(qa.length).toBeGreaterThan(0);
    expect(qa.every((h) => h.chunk.doc === 'QA')).toBe(true);
    expect(
      kb
        .search('sprzeciw od oceny', { exclude: ['QA'] })
        .some((h) => h.chunk.doc === 'QA'),
    ).toBe(false);
  });
});
