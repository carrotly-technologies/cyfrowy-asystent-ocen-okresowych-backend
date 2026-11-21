import { suggestSheet } from '../sheets/sheet-suggestion.rules.js';
import { availableActions } from './actions.rules.js';
import { computeEvaluation } from './case.rules.js';
import type {
  Actor,
  CaseAction,
  CaseDetail,
  CaseRecord,
  CaseSummary,
  Evaluator,
} from './case.types.js';
import { formalCheck } from './formal-check.rules.js';
import { promotionRequestOf } from './promotion.rules.js';
import {
  buildStages,
  caseStatus,
  cycleLabel,
  nextDeadline,
  objectionDeadlineOf,
} from './stages.rules.js';

export function toSummary(record: CaseRecord, today: string): CaseSummary {
  return {
    id: record.id,
    person: record.person,
    sheetId: record.sheetId,
    cycleLabel: cycleLabel(record),
    currentStage: record.stage,
    stages: buildStages(record, today),
    nextDeadline: nextDeadline(record, today),
    status: caseStatus(record, today),
  };
}

export type CaseDetailView = CaseDetail & { availableActions: CaseAction[] };

/**
 * The case as the viewer sees it. `actor` limits `availableActions` to what
 * this viewer may do (null: nobody acts, e.g. HR). The assessed person
 * (EMPLOYEE) never sees the evaluator's observations, and sees part II only
 * once the signed assessment was handed over (§12 ust. 1 rozp. 2016).
 */
export function toDetail(
  record: CaseRecord,
  today: string,
  evaluator: Evaluator,
  officeName: string,
  actor: Actor | null = 'EVALUATOR',
): CaseDetailView {
  const { id: _id, ...evaluatorView } = evaluator;
  const detail: CaseDetailView = {
    ...toSummary(record, today),
    evaluator: evaluatorView,
    officeName,
    sheetSuggestion: suggestSheet(record.person),
    partI: record.partI,
    observations: record.observations,
    decisions: record.decisions,
    deviationNotes: record.deviationNotes,
    justification: record.justification,
    iprz: record.iprz,
    previousAssessment: record.previousAssessment,
    promotionRequest: promotionRequestOf(record),
    evaluation: computeEvaluation(record, today),
    formalCheck: formalCheck(record, today),
    assessmentTalkOn: record.assessmentTalkOn,
    signedByEvaluatorOn: record.signedByEvaluatorOn,
    sentForAckOn: record.sentForAckOn,
    acknowledgedOn: record.acknowledgedOn,
    objectionDeadline: objectionDeadlineOf(record, today),
    history: record.history,
    availableActions: actor ? availableActions(record, today, actor) : [],
  };
  if (actor !== 'EMPLOYEE') return detail;
  const handedOver = record.sentForAckOn !== null;
  return {
    ...detail,
    observations: [],
    formalCheck: [],
    ...(handedOver
      ? {}
      : {
          decisions: {},
          deviationNotes: {},
          justification: '',
          iprz: '',
          evaluation: null,
          promotionRequest: {
            ...detail.promotionRequest,
            motivation: '',
          },
        }),
  };
}
