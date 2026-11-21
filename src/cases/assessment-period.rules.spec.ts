import {
  assessmentPeriodErrors,
  assessmentPeriodOf,
  defaultAssessmentPeriod,
} from './assessment-period.rules.js';
import { emptyPartI } from './seed/seed-helpers.js';

const record = (due: string | null, signed: string | null = null) => ({
  partI: {
    ...emptyPartI(),
    confirmedByEvaluatorOn: '2024-12-04',
    assessmentDue: due,
  },
  signedByEvaluatorOn: signed,
});

describe('okres, w którym oceniany podlegał ocenie (field schema A/B/C)', () => {
  it('defaults: from the criteria day to today, or to the due date when it passed', () => {
    expect(defaultAssessmentPeriod(record('2026-11-30'), '2026-11-21')).toEqual(
      {
        from: '2024-12-04',
        to: '2026-11-21',
      },
    );
    expect(defaultAssessmentPeriod(record('2026-11-09'), '2026-11-21').to).toBe(
      '2026-11-09',
    );
    expect(
      defaultAssessmentPeriod(record('2026-11-30', '2026-11-20'), '2026-11-25')
        .to,
    ).toBe('2026-11-20');
  });

  it('the evaluator overrides one side; the other keeps its default', () => {
    expect(
      assessmentPeriodOf(
        {
          ...record('2026-11-30'),
          assessmentPeriod: { from: '2024-12-10', to: null },
        },
        '2026-11-21',
      ),
    ).toEqual({ from: '2024-12-10', to: '2026-11-21' });
  });

  it('rejects from after to and a period ending in the future', () => {
    expect(
      assessmentPeriodErrors(
        { from: '2026-01-02', to: '2026-01-01' },
        '2026-11-21',
      ),
    ).toHaveLength(1);
    expect(
      assessmentPeriodErrors(
        { from: '2026-01-02', to: '2026-12-01' },
        '2026-11-21',
      )[0],
    ).toContain('przyszłości');
  });
});
