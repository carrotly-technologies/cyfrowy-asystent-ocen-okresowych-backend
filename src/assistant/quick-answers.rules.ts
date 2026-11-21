import type { CaseDetail } from '../cases/case.types.js';
import { formatDatePl } from '../cases/dates.js';
import { reassessmentAfterNegativeDue } from '../cases/deadlines.rules.js';

/**
 * Short, rule-based answers to questions that plain retrieval answers badly (the right rule is spread over several
 * articles, or the answer depends on the case). Each rule gives the short answer and a query for the supporting
 * excerpts. Pure data + functions: when the law changes, edit the text here (legal basis in the text).
 */
export interface QuickAnswerRule {
  id: string;
  /** Every pattern must match the question. */
  patterns: RegExp[];
  /** Query used to retrieve the sources shown under the short answer. */
  sourceQuery: string;
  answer: (detail: CaseDetail | null) => string;
}

const USC = 'ustawy o służbie cywilnej';

/** Art. 81 ust. 4 and 9: the next assessment, every 24 months or 6 months after a negative one. */
const NEXT_ASSESSMENT: QuickAnswerRule = {
  id: 'NEXT_ASSESSMENT',
  patterns: [
    // what: the next cycle / assessment, or the one after a negative assessment
    /(kolejn|następn|nowy|nowego|ponown)\S*\s+(cykl|ocen)|negatywn/iu,
    // asks about time
    /kiedy|termin|od\s+kiedy|po\s+ilu|po\s+jakim\s+czasie|zaczyna|rozpoczyna/iu,
  ],
  sourceQuery:
    'ponowna ocena po upływie 6 miesięcy od dnia zapoznania się z negatywną oceną art. 81 ust. 9 oceny okresowe co 24 miesiące',
  answer: (detail) => {
    const lines = [
      `Ocenę okresową sporządza się co 24 miesiące (art. 81 ust. 4 ${USC}). Wyjątek: po ocenie negatywnej oceniany podlega ponownej ocenie po upływie 6 miesięcy od dnia zapoznania się z tą oceną (art. 81 ust. 9 ${USC}). Nowy okres oceny zaczyna się rozmową rozpoczynającą.`,
    ];
    const result = detail?.evaluation?.result;
    if (result === 'NEGATIVE') {
      const ack = detail?.acknowledgedOn;
      lines.push(
        ack
          ? `W tej sprawie ocena jest negatywna, a oceniany zapoznał się z nią ${formatDatePl(ack)}, więc ponowną ocenę sporządza się od ${formatDatePl(reassessmentAfterNegativeDue(ack))}.`
          : 'W tej sprawie ocena jest negatywna: 6 miesięcy do ponownej oceny liczy się od dnia, w którym oceniany zapozna się z oceną.',
      );
    } else if (result === 'POSITIVE') {
      lines.push(
        'W tej sprawie ocena jest pozytywna, więc kolejną ocenę sporządza się po 24 miesiącach.',
      );
    }
    return lines.join(' ');
  },
};

export const QUICK_ANSWER_RULES: readonly QuickAnswerRule[] = [NEXT_ASSESSMENT];

export function quickAnswer(
  question: string,
  detail: CaseDetail | null,
): { rule: QuickAnswerRule; text: string } | null {
  const rule = QUICK_ANSWER_RULES.find((r) =>
    r.patterns.every((p) => p.test(question)),
  );
  return rule ? { rule, text: rule.answer(detail) } : null;
}
