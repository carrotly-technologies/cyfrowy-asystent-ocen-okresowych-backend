import { PARTNER_ACTIONS } from './data/partner-actions.data.js';
import { questionTopics, rulesAnswer } from './partner-answer.rules.js';
import type { Signal } from './signals.rules.js';

const signal = (kind: Signal['kind'], title: string): Signal => ({
  kind,
  level: kind === 'APPRECIATION' ? 'POSITIVE' : 'ALERT',
  title,
  reasons: [{ source: 'PULSE', text: `powód ${kind}` }],
  actions: [PARTNER_ACTIONS.SUPPORT_TALK],
});
const signals = [
  signal('BURNOUT_RISK', 'Ryzyko wypalenia'),
  signal('APPRECIATION', 'Moment do docenienia'),
];

describe('rulesAnswer', () => {
  it('maps keywords to topics', () => {
    expect(questionTopics('Jak przygotować rozmowę wspierającą?')).toEqual([
      'SUPPORT',
    ]);
    expect(questionTopics('Jak docenić tę osobę?')).toEqual(['APPRECIATION']);
    expect(questionTopics('Jak sformułować informację zwrotną?')).toEqual([
      'FEEDBACK',
    ]);
  });

  it('a supportive talk covers the risk flags, not appreciation', () => {
    const a = rulesAnswer(
      'Jak przygotować rozmowę wspierającą?',
      'X',
      signals,
      null,
    );
    expect(a).toContain('Ryzyko wypalenia');
    expect(a).not.toContain('Moment do docenienia');
    expect(a).toContain('Decyzja należy do przełożonego');
  });

  it('without a topic summarizes every flag; says when a topic has no flag', () => {
    expect(rulesAnswer('Co słychać?', 'X', signals, null)).toContain(
      'Moment do docenienia',
    );
    expect(rulesAnswer('Czy jest przeciążony?', 'X', [], null)).toContain(
      'nie pokazują teraz takiego sygnału',
    );
  });
});
