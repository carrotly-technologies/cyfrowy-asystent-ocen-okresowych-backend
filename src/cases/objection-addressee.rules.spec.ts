import { objectionAddressee } from './objection-addressee.rules.js';

describe('objectionAddressee (art. 83 ust. 1–2, footnote 17)', () => {
  it('sheets B and C: the dyrektor generalny decides (art. 83 ust. 1)', () => {
    for (const sheetId of ['B', 'C'] as const) {
      expect(objectionAddressee({ sheetId })).toMatchObject({
        decider: 'DIRECTOR',
        to: 'dyrektora generalnego urzędu',
        legalBasis: expect.stringContaining('art. 83 ust. 1'),
      });
    }
  });

  it('sheet A: to the person who made the assessment (art. 83 ust. 2)', () => {
    expect(objectionAddressee({ sheetId: 'A' })).toMatchObject({
      decider: 'EVALUATOR',
      to: 'osoby, która dokonała oceny okresowej',
      legalBasis: expect.stringContaining('art. 83 ust. 2'),
    });
    expect(
      objectionAddressee(
        { sheetId: 'A' },
        { objectionRecipient: 'Prezesa Rady Ministrów' },
      ),
    ).toMatchObject({ decider: 'EVALUATOR', to: 'Prezesa Rady Ministrów' });
  });

  it('assessment made by the dyrektor generalny: to him as the assessor (art. 83 ust. 2)', () => {
    const a = objectionAddressee({
      sheetId: 'B',
      assessedByDirectorGeneral: true,
    });
    expect(a.decider).toBe('DIRECTOR');
    expect(a.legalBasis).toContain('art. 83 ust. 2');
  });

  it('office without a dyrektor generalny: to the kierownik urzędu (footnote 17)', () => {
    expect(
      objectionAddressee({ sheetId: 'C' }, { hasDirectorGeneral: false }),
    ).toMatchObject({ decider: 'DIRECTOR', to: 'kierownika urzędu' });
    // sheet A is not affected
    expect(
      objectionAddressee({ sheetId: 'A' }, { hasDirectorGeneral: false })
        .decider,
    ).toBe('EVALUATOR');
  });
});
