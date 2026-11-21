import type { CaseRecord } from './case.types.js';

/**
 * „Okres, w którym oceniany podlegał ocenie” (part II of sheets A/B/C). Field
 * schema: by default from the day the criteria were set (part I confirmed by
 * the evaluator) to the day the assessment is made: today, or the due date
 * when the sheet is filled after it. Editable by the evaluator at the
 * assessment stage until signing (patch.rules.ts); once signed the stored
 * value (or the signature date) is final.
 */
export interface AssessmentPeriod {
  from: string | null;
  to: string | null;
}

export function defaultAssessmentPeriod(
  record: Pick<CaseRecord, 'partI' | 'signedByEvaluatorOn'>,
  today: string,
): AssessmentPeriod {
  const from = record.partI.confirmedByEvaluatorOn;
  const due = record.partI.assessmentDue;
  const made = record.signedByEvaluatorOn ?? today;
  const to = due && made > due ? due : made;
  return { from, to };
}

/** The stored period over the default, field by field. */
export function assessmentPeriodOf(
  record: Pick<
    CaseRecord,
    'partI' | 'signedByEvaluatorOn' | 'assessmentPeriod'
  >,
  today: string,
): AssessmentPeriod {
  const fallback = defaultAssessmentPeriod(record, today);
  return {
    from: record.assessmentPeriod?.from ?? fallback.from,
    to: record.assessmentPeriod?.to ?? fallback.to,
  };
}

/** Polish messages for an invalid period; empty = valid. */
export function assessmentPeriodErrors(
  period: AssessmentPeriod,
  today: string,
): string[] {
  const errors: string[] = [];
  if (period.from && period.to && period.from > period.to) {
    errors.push(
      'Okres, w którym oceniany podlegał ocenie: data „od” nie może być późniejsza niż data „do”.',
    );
  }
  if (period.to && period.to > today) {
    errors.push(
      'Okres, w którym oceniany podlegał ocenie, nie może kończyć się w przyszłości.',
    );
  }
  return errors;
}
