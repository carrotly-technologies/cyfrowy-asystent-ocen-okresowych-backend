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
import type { OfficeConfig } from '../config/office.js';
import { caseLocks } from './correction.rules.js';
import { dueDateRequestRule, dueDateRequestsView } from './due-date.rules.js';
import { dueChangeBlocker } from './due-date-change.rules.js';
import { formalCheck } from './formal-check.rules.js';
import { objectionNextStepsFor } from './objection-guide.rules.js';
import {
  objectionDecisionNotice,
  objectionRight,
  objectionViews,
} from './objection-terms.rules.js';
import { objectionAddressee } from './objection-addressee.rules.js';
import { promotionRequestOf } from './promotion.rules.js';
import { PART_II_STAGES } from './patch.rules.js';
import { assessmentPeriodOf } from './assessment-period.rules.js';
import { nextEvaluationDueOn } from './deadlines.rules.js';
import {
  buildStages,
  caseStatus,
  cycleLabel,
  nextDeadline,
  objectionDeadlineOf,
} from './stages.rules.js';

/**
 * `previous`: the person's case before this one (its `nextCaseId` is this
 * case), the source of the last signed assessment while this one is unsigned.
 */
export function toSummary(
  record: CaseRecord,
  today: string,
  previous: CaseRecord | null = null,
): CaseSummary {
  return {
    id: record.id,
    person: record.person,
    sheetId: record.sheetId,
    cycleLabel: cycleLabel(record),
    currentStage: record.stage,
    stages: buildStages(record, today),
    nextDeadline: nextDeadline(record, today),
    nextEvaluationDueOn: nextEvaluationDueOn(
      record.signedByEvaluatorOn ?? previous?.signedByEvaluatorOn ?? null,
    ),
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
  office: OfficeConfig,
  actor: Actor | null = 'EVALUATOR',
  previous: CaseRecord | null = null,
): CaseDetailView {
  const { id: _id, ...evaluatorView } = evaluator;
  const evaluation = computeEvaluation(record, today);
  const addressee = objectionAddressee(
    {
      sheetId: record.sheetId,
      assessedByDirectorGeneral: evaluator.directorGeneral === true,
    },
    office,
  );
  const detail: CaseDetailView = {
    ...toSummary(record, today, previous),
    evaluator: evaluatorView,
    officeName: office.name,
    office,
    sheetSuggestion: suggestSheet(record.person),
    partI: record.partI,
    observations: record.observations,
    decisions: record.decisions,
    deviationNotes: record.deviationNotes,
    justification: record.justification,
    iprz: record.iprz,
    previousAssessment: record.previousAssessment,
    promotionRequest: promotionRequestOf(record, evaluation),
    evaluation,
    formalCheck: formalCheck(record, today),
    assessmentTalkOn: record.assessmentTalkOn,
    signedByEvaluatorOn: record.signedByEvaluatorOn,
    sentForAckOn: record.sentForAckOn,
    acknowledgedOn: record.acknowledgedOn,
    objectionDeadline: objectionDeadlineOf(record, today, addressee),
    objectionAddressee: addressee,
    objectionNextSteps: objectionNextStepsFor(
      record,
      addressee.to,
      addressee.who,
    ),
    objectionRight: objectionRight(record),
    objectionDecisionNotice: objectionDecisionNotice(record, addressee.who),
    history: record.history,
    corrections: record.corrections ?? [],
    locks: caseLocks(record),
    ackFiction: record.ackFiction ?? null,
    objections: objectionViews(record, today),
    assessmentVersions: record.assessmentVersions ?? [],
    dueDateRequests: dueDateRequestsView(record),
    dueDateChanges: record.dueDateChanges ?? [],
    dueDateRequestRule: dueDateRequestRule(record, today),
    dueDateChangeBlocker: dueChangeBlocker(record, 'EVALUEE_REQUEST', today),
    talkInvitations: record.talkInvitations ?? [],
    positionChanges: record.positionChanges ?? [],
    absences: record.absences ?? [],
    workingNotes: record.workingNotes ?? '',
    assessmentPeriod: assessmentPeriodOf(record, today),
    partIIEditableFrom: PART_II_STAGES[0],
    availableActions: actor ? availableActions(record, today, actor) : [],
  };
  if (actor !== 'EMPLOYEE') return detail;
  const handedOver = record.sentForAckOn !== null;
  return {
    ...detail,
    observations: [],
    formalCheck: [],
    workingNotes: '',
    ...(handedOver
      ? {}
      : {
          decisions: {},
          deviationNotes: {},
          justification: '',
          iprz: '',
          evaluation: null,
          // Values of part II/III corrections stay hidden until the hand-over.
          corrections: detail.corrections.map((c) =>
            c.section === 'Część I'
              ? c
              : { ...c, oldValue: '(ukryte)', newValue: '(ukryte)' },
          ),
          promotionRequest: {
            ...detail.promotionRequest,
            motivation: '',
          },
        }),
  };
}
