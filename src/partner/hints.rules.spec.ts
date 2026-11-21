import {
  buildCaseHints,
  DECISION_NOTE,
  feedbackPhrase,
  type HintObservation,
} from './hints.rules.js';
import { countObservations } from './hints.rules.js';

const obs = (o: Partial<HintObservation>): HintObservation => ({
  date: '2026-10-01',
  criterionId: 'komunikacja',
  kind: 'DEVELOPMENT',
  situation: 'Spotkanie z interesantami.',
  action: 'Odpowiadała językiem przepisów.',
  result: 'Dwie osoby prosiły o ponowne wyjaśnienie.',
  ...o,
});

describe('buildCaseHints', () => {
  it('areas from low scores or development observations, strengths from the rest', () => {
    const h = buildCaseHints({
      criteria: ['komunikacja', 'rzetelnosc', 'wspolpraca'],
      decisions: { rzetelnosc: 3, wspolpraca: 7 },
      observations: [
        obs({}),
        obs({ date: '2026-11-01' }),
        obs({ criterionId: 'wspolpraca', kind: 'STRENGTH' }),
      ],
      signals: [],
    });
    expect(h.disclaimer).toBe(DECISION_NOTE);
    expect(h.areas.map((a) => a.criterionId)).toEqual([
      'komunikacja',
      'rzetelnosc',
    ]);
    expect(h.strengths.map((a) => a.criterionId)).toEqual(['wspolpraca']);
    expect(h.development.map((d) => d.criterionId)).toEqual([
      'komunikacja',
      'rzetelnosc',
    ]);
    expect(h.development[0].forms.length).toBeGreaterThan(0);
    expect(h.feedback.map((f) => [f.criterionId, f.kind, f.date])).toEqual([
      ['wspolpraca', 'STRENGTH', '2026-10-01'],
      ['komunikacja', 'DEVELOPMENT', '2026-11-01'],
    ]);
    expect(h.management.length).toBeGreaterThan(0);
  });

  it('never returns a score suggestion', () => {
    const h = buildCaseHints({
      criteria: ['komunikacja'],
      decisions: {},
      observations: [],
      signals: [],
    });
    expect(JSON.stringify(h)).not.toMatch(
      /sugerowana ocena|proponowana ocena/i,
    );
    expect(h.areas).toEqual([]);
  });
});

describe('feedbackPhrase', () => {
  it('builds an SBI sentence from S-D-R', () => {
    expect(feedbackPhrase(obs({}))).toBe(
      'W sytuacji z 01.10.2026 (spotkanie z interesantami) zauważyłam/-em, że: odpowiadała językiem przepisów. Skutek: dwie osoby prosiły o ponowne wyjaśnienie. Jak to widzisz? Ustalmy, co następnym razem zrobimy inaczej w obszarze „Komunikacja”.',
    );
  });
});

describe('countObservations', () => {
  it('uses the Polish plural forms', () => {
    expect(countObservations(1)).toBe('1 obserwacja');
    expect(countObservations(3)).toBe('3 obserwacje');
    expect(countObservations(5)).toBe('5 obserwacji');
    expect(countObservations(12)).toBe('12 obserwacji');
    expect(countObservations(22)).toBe('22 obserwacje');
  });
});
