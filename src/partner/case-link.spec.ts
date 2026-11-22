import type { CaseSummary, Deadline } from '../cases/case.types.js';
import { personCaseLink } from './case-link.js';

const deadline: Deadline = {
  date: '2026-12-01',
  daysLeft: 9,
  state: 'SOON',
  label: 'Rozmowa oceniająca do',
  legalBasis: 'art. 81 ust. 1',
};

const summary = (s: Partial<CaseSummary>): CaseSummary =>
  ({
    id: 'c-1',
    currentStage: 'ASSESSMENT',
    stages: [],
    nextDeadline: deadline,
    status: 'W_TOKU',
    ...s,
  }) as CaseSummary;

describe('personCaseLink', () => {
  it('a case in progress: status, current stage name and its term', () => {
    expect(personCaseLink(summary({}))).toEqual({
      caseStatus: 'W_TOKU',
      stageName: 'Rozmowa oceniająca i ocena',
      nextDeadline: deadline,
      completedOn: null,
    });
  });

  it('a closed case: the date of the last completed stage, no term', () => {
    const link = personCaseLink(
      summary({
        status: 'ZAKONCZONA',
        currentStage: 'ACKNOWLEDGEMENT',
        stages: [
          { completedOn: '2026-03-01' },
          { completedOn: '2026-03-10' },
          { completedOn: null },
        ] as CaseSummary['stages'],
      }),
    );
    expect(link).toMatchObject({
      caseStatus: 'ZAKONCZONA',
      stageName: 'Zapoznanie z oceną',
      nextDeadline: null,
      completedOn: '2026-03-10',
    });
  });
});
