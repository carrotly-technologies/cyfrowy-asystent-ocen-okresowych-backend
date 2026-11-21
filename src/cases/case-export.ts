import { findCriterion, sheetOf } from './case.rules.js';
import {
  CASE_EXPORT_FORMAT,
  CASE_EXPORT_SCHEMA_VERSION,
  type CaseExport,
} from './case-export.schema.js';
import type { CaseDetail } from './case.types.js';

/**
 * GET /api/cases/:id/export: the sheet's fields (parts I, II and III) from the
 * case as the caller sees it, so the role filtering of toDetail() (e.g. the
 * assessed person sees no part II before the hand-over) holds for exports too.
 * Only the fields of the sheet: no observations, history or internal flags.
 */
export function toExport(detail: CaseDetail, exportedAt: Date): CaseExport {
  const sheet = sheetOf(detail);
  const mandatory = new Set(sheet?.mandatoryCriteria ?? []);
  const criteria = [
    ...(sheet?.mandatoryCriteria ?? []),
    ...detail.partI.additionalCriteria,
  ].map((id) => {
    const c = findCriterion(id);
    return {
      id,
      number: c?.number ?? null,
      name: c?.name ?? id,
      mandatory: mandatory.has(id),
    };
  });
  const { person, evaluator, partI, promotionRequest: p } = detail;
  const objection = detail.objectionDeadline;

  return {
    schemaVersion: CASE_EXPORT_SCHEMA_VERSION,
    format: CASE_EXPORT_FORMAT,
    exportedAt: exportedAt.toISOString(),
    case: {
      id: detail.id,
      cycleLabel: detail.cycleLabel,
      status: detail.status,
      currentStage: detail.currentStage,
    },
    office: { name: detail.office.name, city: detail.office.city },
    sheet: sheet
      ? {
          id: sheet.id,
          name: sheet.name,
          annex: sheet.template.annex,
          legalBasis: sheet.legalBasis,
        }
      : null,
    assessed: {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      position: person.position,
      unit: person.unit,
      employment: person.employment,
    },
    evaluator: {
      firstName: evaluator.firstName,
      lastName: evaluator.lastName,
      position: evaluator.position,
      unit: evaluator.unit,
    },
    partI: {
      criteria,
      assessmentDue: partI.assessmentDue,
      topics: { ...partI.topics },
      expectations: Object.entries(partI.expectations)
        .filter(([, text]) => text !== '')
        .map(([criterionId, text]) => ({ criterionId, text })),
      confirmedByEvaluatorOn: partI.confirmedByEvaluatorOn,
      acknowledgedByEmployeeOn: partI.acknowledgedByEmployeeOn,
    },
    partII: {
      previousAssessment: detail.previousAssessment
        ? { ...detail.previousAssessment }
        : null,
      assessmentTalkOn: detail.assessmentTalkOn,
      scores: criteria.map((c) => ({
        ...c,
        points: detail.decisions[c.id] ?? null,
        deviationNote: detail.deviationNotes[c.id] ?? '',
      })),
      evaluation: detail.evaluation,
      justification: detail.justification,
      iprz: detail.iprz,
      signedByEvaluatorOn: detail.signedByEvaluatorOn,
      sentForAckOn: detail.sentForAckOn,
      acknowledgedOn: detail.acknowledgedOn,
      objectionDeadline: objection
        ? {
            date: objection.date,
            label: objection.label,
            legalBasis: objection.legalBasis,
          }
        : null,
    },
    partIII: {
      attached: p.attached,
      appointedYear: p.appointedYear,
      currentGrade: p.currentGrade,
      gradeGrantedOn: p.gradeGrantedOn,
      requestedGrade: p.requestedGrade,
      motivation: p.motivation,
    },
  };
}
