import { pulse } from './pulse.rules.spec.js';
import {
  computeSignals,
  type SignalInput,
  type WorkContext,
} from './signals.rules.js';

const today = '2026-11-21';
const work = (over: Partial<WorkContext> = {}): WorkContext => ({
  openTasks: 5,
  overdueTasks: 0,
  scopeChanges: [],
  absences: [],
  source: 'test',
  ...over,
});
const input = (over: Partial<SignalInput>): SignalInput => ({
  today,
  pulses: [],
  observations: [],
  work: null,
  ...over,
});
const kinds = (r: ReturnType<typeof computeSignals>) =>
  r.signals.map((s) => s.kind);

describe('computeSignals', () => {
  it('no data: no flags, a note that the pulse is voluntary', () => {
    const r = computeSignals(input({}));
    expect(r.signals).toEqual([]);
    expect(r.notes[0]).toContain('dobrowolny');
  });

  it('ignores a stale pulse', () => {
    const r = computeSignals(
      input({
        pulses: [
          pulse('2026-09-01', [1, 1, 1, 1, 1]),
          pulse('2026-09-15', [1, 1, 1, 1, 1]),
        ],
      }),
    );
    expect(r.signals).toEqual([]);
    expect(r.notes[0]).toContain('starszy niż 28 dni');
  });

  it('overload from low workload + overdue tasks + scope change is an ALERT with reasons', () => {
    const r = computeSignals(
      input({
        pulses: [
          pulse('2026-11-01', [3, 3, 3, 3, 3]),
          pulse('2026-11-15', [2, 3, 3, 3, 3]),
        ],
        work: work({
          overdueTasks: 4,
          openTasks: 12,
          scopeChanges: [{ date: '2026-11-01', text: 'nowy projekt' }],
        }),
      }),
    );
    const overload = r.signals.find((s) => s.kind === 'OVERLOAD')!;
    expect(overload.level).toBe('ALERT');
    expect(overload.reasons.map((x) => x.source)).toEqual([
      'PULSE',
      'TASKS',
      'SCOPE',
    ]);
    expect(overload.actions.map((a) => a.id)).toContain('REPRIORITIZE');
  });

  it('a scope change alone does not raise a flag', () => {
    const r = computeSignals(
      input({
        work: work({ scopeChanges: [{ date: '2026-11-01', text: 'x' }] }),
      }),
    );
    expect(r.signals).toEqual([]);
  });

  it('gradual decline and low satisfaction: motivation drop', () => {
    const r = computeSignals(
      input({
        pulses: [
          pulse('2026-09-12', [4, 4, 4, 4, 5]),
          pulse('2026-09-26', [4, 4, 4, 4, 4]),
          pulse('2026-10-10', [3, 4, 4, 3, 4]),
          pulse('2026-10-24', [3, 3, 4, 3, 3]),
          pulse('2026-11-07', [3, 3, 3, 3, 2]),
          pulse('2026-11-13', [3, 3, 3, 2, 2]),
        ],
      }),
    );
    const m = r.signals.find((s) => s.kind === 'MOTIVATION_DROP')!;
    expect(r.trend.kind).toBe('GRADUAL_DECLINE');
    expect(m.reasons.map((x) => x.text).join(' ')).toContain('satysfakcja 2/5');
    expect(m.actions.map((a) => a.id)).toContain('CLARIFY_GOALS');
  });

  it('sudden drop with exhaustion and overload: burnout risk ALERT, absence counted without reason', () => {
    const r = computeSignals(
      input({
        pulses: [
          pulse('2026-10-05', [4, 4, 4, 4, 4]),
          pulse('2026-10-19', [4, 4, 4, 4, 4]),
          pulse('2026-11-05', [3, 2, 3, 4, 3]),
          pulse('2026-11-19', [1, 1, 2, 3, 3]),
        ],
        work: work({
          overdueTasks: 4,
          absences: [{ from: '2026-10-20', to: '2026-10-31' }],
        }),
      }),
    );
    expect(kinds(r)).toEqual(['OVERLOAD', 'BURNOUT_RISK']);
    const b = r.signals[1];
    expect(b.level).toBe('ALERT');
    expect(
      b.reasons.some(
        (x) => x.source === 'ABSENCE' && x.text.includes('12 dni'),
      ),
    ).toBe(true);
    expect(b.actions.map((a) => a.id)).toEqual(
      expect.arrayContaining(['PROJECT_BREAK', 'ANTI_BURNOUT_DEVELOPMENT']),
    );
  });

  it('two recent strengths and a stable high pulse: moment to appreciate', () => {
    const r = computeSignals(
      input({
        pulses: [
          pulse('2026-10-20', [4, 4, 5, 4, 5]),
          pulse('2026-11-01', [4, 5, 5, 4, 5]),
          pulse('2026-11-13', [4, 4, 5, 5, 5]),
        ],
        observations: [
          {
            date: '2026-10-28',
            kind: 'STRENGTH',
            criterionId: 'komunikacja',
            summary: 'Spotkanie',
          },
          {
            date: '2026-11-10',
            kind: 'STRENGTH',
            criterionId: 'rzetelnosc',
            summary: 'Raport',
          },
        ],
      }),
    );
    expect(kinds(r)).toEqual(['APPRECIATION']);
    expect(r.signals[0].level).toBe('POSITIVE');
    expect(r.signals[0].reasons).toHaveLength(3);
    expect(r.signals[0].actions.map((a) => a.id)).toEqual([
      'CONCRETE_PRAISE',
      'SUCCESS_VISIBILITY',
      'GROWTH_OPPORTUNITY',
    ]);
  });
});
