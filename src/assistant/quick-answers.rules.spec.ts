import type { CaseDetail } from '../cases/case.types.js';
import { quickAnswer } from './quick-answers.rules.js';

const negative = (acknowledgedOn: string | null) =>
  ({
    evaluation: { result: 'NEGATIVE' },
    acknowledgedOn,
  }) as unknown as CaseDetail;

describe('quick answers', () => {
  it('answers when the next cycle starts, with the 6-month rule after a negative assessment', () => {
    const q = quickAnswer('Kiedy zaczyna się kolejny cykl oceny?', null);
    expect(q?.rule.id).toBe('NEXT_ASSESSMENT');
    expect(q?.text).toContain('co 24 miesiące');
    expect(q?.text).toContain('6 miesięcy od dnia zapoznania');
    expect(q?.text).toContain('art. 81 ust. 9');
  });

  it('uses the case: a negative assessment acknowledged gives the date of the re-assessment', () => {
    const q = quickAnswer(
      'Kiedy zaczyna się kolejny cykl oceny?',
      negative('2026-11-20'),
    );
    expect(q?.text).toMatch(/zapoznał się z nią 20\.11\.2026/);
    expect(q?.text).toMatch(
      /ponowną ocenę sporządza się od \d{2}\.\d{2}\.2027/,
    );
    expect(quickAnswer('Kiedy ponowna ocena?', negative(null))?.text).toContain(
      'zapozna się z oceną',
    );
  });

  it('leaves other questions to the knowledge base', () => {
    expect(
      quickAnswer('Jak często sporządza się ocenę okresową?', null),
    ).toBeNull();
    expect(
      quickAnswer(
        'Czy ponowna ocena po negatywnej może zawierać wniosek o stopień?',
        null,
      ),
    ).toBeNull();
  });
});
