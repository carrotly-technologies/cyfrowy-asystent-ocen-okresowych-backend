import { analyseOsp } from './osp-analysis.rules.js';
import { OSP_DOCS } from './osp.data.js';

const osp = (id: string) => OSP_DOCS.find((o) => o.id === id)!;

describe('analyseOsp', () => {
  it('starszy specjalista: sheet C, myślenie analityczne as the only candidate', () => {
    const result = analyseOsp(osp('osp-dc-wzksoic-6'));
    expect(result.suggestedSheet).toMatchObject({
      sheetId: 'C',
      legalBasis: expect.stringContaining('§3 ust. 4'),
    });
    expect(result.additionalCandidates.map((c) => c.criterionId)).toEqual([
      'myslenie_analityczne',
    ]);
    expect(result.additionalCandidates[0].ospQuote).toContain(
      'myślenie analityczne',
    );
  });

  it('radca: sheet C and no candidates (all soft competencies are mandatory)', () => {
    const result = analyseOsp(osp('osp-dsi-wwi-5'));
    expect(result.suggestedSheet?.sheetId).toBe('C');
    expect(result.additionalCandidates).toEqual([]);
  });

  it('naczelnik: sheet B, wykorzystywanie wiedzy as candidate', () => {
    const result = analyseOsp(osp('osp-dwm-wkam-1'));
    expect(result.suggestedSheet).toMatchObject({
      sheetId: 'B',
      legalBasis: expect.stringContaining('§3 ust. 3'),
    });
    expect(result.additionalCandidates.map((c) => c.criterionId)).toEqual([
      'wykorzystywanie_wiedzy',
    ]);
  });

  it('matches opisy_stanowisk_przyklady for every OSP', () => {
    for (const doc of OSP_DOCS) {
      expect(analyseOsp(doc).suggestedSheet).not.toBeNull();
    }
  });

  it('suggests nothing for an unrecognised subordinates field', () => {
    const result = analyseOsp({
      ...osp('osp-dsi-wwi-5'),
      subordinates: 'nie określono',
    });
    expect(result).toEqual({ suggestedSheet: null, additionalCandidates: [] });
  });
});
