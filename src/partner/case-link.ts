import { STAGE_NAMES } from '../cases/case.rules.js';
import type { CaseStatus, CaseSummary, Deadline } from '../cases/case.types.js';

/** What the case button on the wellbeing card leads to: status, stage and its term. */
export interface PersonCaseLink {
  caseStatus: CaseStatus;
  stageName: string;
  nextDeadline: Deadline | null;
  /** `YYYY-MM-DD` the assessment ended; only for ZAKONCZONA, otherwise null. */
  completedOn: string | null;
}

/**
 * Case context for the "Prowadź ocenę" / "Zobacz ocenę" button on the
 * employee wellbeing card. A closed case reports the date it ended (the last
 * completed stage) instead of a term.
 */
export function personCaseLink(summary: CaseSummary): PersonCaseLink {
  const closed = summary.status === 'ZAKONCZONA';
  return {
    caseStatus: summary.status,
    stageName: STAGE_NAMES[summary.currentStage],
    nextDeadline: closed ? null : summary.nextDeadline,
    completedOn: closed
      ? (summary.stages.findLast((s) => s.completedOn)?.completedOn ?? null)
      : null,
  };
}
