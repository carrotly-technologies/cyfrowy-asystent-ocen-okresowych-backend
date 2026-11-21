import { displayName } from '../assessments/assessment.format.js';
import type { ScaleLevel } from '../criteria/criteria.types.js';
import { CRITERIA_CATALOGUE } from '../criteria/data/criteria.data.js';
import { computeEvaluation } from './case.rules.js';
import type { CaseRecord, Employment } from './case.types.js';
import { daysTermEnd, formatDatePl, shiftToWorkingDay } from './dates.js';
import { USC } from './deadlines.rules.js';

/**
 * Obligatory next civil-service grade (art. 89 ust. 2 ustawy): an urzędnik
 * who, since the last grade, obtained two consecutive positive periodic
 * assessments at one of the two highest levels of the scale gets the next
 * grade within 30 days of being acknowledged with the (second) assessment.
 */

/** art. 89 ust. 2: "na jednym z dwóch najwyższych poziomów". */
export const OBLIGATORY_GRADE_TOP_LEVELS = 2;
/** art. 89 ust. 2: "w terminie 30 dni od dnia zapoznania". */
export const OBLIGATORY_GRADE_DAYS = 30;
/** art. 89 ust. 2: two consecutive assessments. */
export const OBLIGATORY_GRADE_ASSESSMENTS = 2;

export const OBLIGATORY_GRADE_BASIS = `art. 89 ust. 2 ${USC}`;

export interface AssessmentOutcome {
  /** Date the assessment was made (or acknowledged). */
  date: string;
  result: 'POSITIVE' | 'NEGATIVE' | null;
  /** Overall level, any case ("Powyżej oczekiwań" / "powyżej oczekiwań"). */
  level: string | null;
}

const norm = (s: string) => displayName(s.trim()).toLocaleLowerCase('pl-PL');

/** The two highest levels of the scale, lower-case ("powyżej oczekiwań", ...). */
export function topLevels(
  scale: readonly ScaleLevel[] = CRITERIA_CATALOGUE.scale,
): string[] {
  return [...scale]
    .sort((a, b) => b.points - a.points)
    .slice(0, OBLIGATORY_GRADE_TOP_LEVELS)
    .map((s) => norm(s.label));
}

export function isTopLevelPositive(
  outcome: AssessmentOutcome,
  scale?: readonly ScaleLevel[],
): boolean {
  return (
    outcome.result === 'POSITIVE' &&
    outcome.level !== null &&
    topLevels(scale).includes(norm(outcome.level))
  );
}

/**
 * The pure rule. `assessments` in any order; only those after the last grade
 * count, and the latest two must both be positive at a top level.
 */
export function obligatoryNextGrade(input: {
  employment: Employment;
  lastGradeGrantedOn: string | null;
  assessments: readonly AssessmentOutcome[];
  scale?: readonly ScaleLevel[];
}): boolean {
  if (input.employment !== 'URZEDNIK') return false;
  const since = input.assessments
    .filter(
      (a) => !input.lastGradeGrantedOn || a.date > input.lastGradeGrantedOn,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  if (since.length < OBLIGATORY_GRADE_ASSESSMENTS) return false;
  return since
    .slice(-OBLIGATORY_GRADE_ASSESSMENTS)
    .every((a) => isTopLevelPositive(a, input.scale));
}

export interface ObligatoryGrade {
  personId: string;
  caseId: string;
  /** Last day to grant the grade (30 days from acknowledging the assessment). */
  deadline: string;
  message: string;
  legalBasis: string;
}

/**
 * Applies the rule to a finished case (acknowledged by the assessed person):
 * this assessment plus the previous one (the earlier case of the same person
 * when known, else part II item 10 "poprzednia ocena").
 */
export function obligatoryGradeFor(
  record: CaseRecord,
  previousCase: CaseRecord | null,
): ObligatoryGrade | null {
  if (!record.acknowledgedOn || !record.signedByEvaluatorOn) return null;
  const current = computeEvaluation(record);
  if (!current) return null;
  const outcomes: AssessmentOutcome[] = [
    {
      date: record.signedByEvaluatorOn,
      result: current.result,
      level: current.level?.label ?? null,
    },
  ];
  const prevEval = previousCase ? computeEvaluation(previousCase) : null;
  if (previousCase?.signedByEvaluatorOn && prevEval) {
    outcomes.push({
      date: previousCase.signedByEvaluatorOn,
      result: prevEval.result,
      level: prevEval.level?.label ?? null,
    });
  } else if (record.previousAssessment?.date) {
    const { result, level, date } = record.previousAssessment;
    outcomes.push({ result, level, date });
  }
  // The latest known date of the last grade: the HR record (employees
  // module), part III of this or of the previous assessment.
  const lastGrade =
    [
      record.person.lastGradeGrantedOn,
      record.promotionRequest.gradeGrantedOn,
      previousCase?.promotionRequest.gradeGrantedOn,
    ]
      .filter((d): d is string => !!d)
      .sort()
      .at(-1) ?? null;
  if (
    !obligatoryNextGrade({
      employment: record.person.employment,
      lastGradeGrantedOn: lastGrade,
      assessments: outcomes,
    })
  ) {
    return null;
  }
  const deadline = shiftToWorkingDay(
    daysTermEnd(record.acknowledgedOn, OBLIGATORY_GRADE_DAYS),
  );
  return {
    personId: record.person.id,
    caseId: record.id,
    deadline,
    message: `${record.person.firstName} ${record.person.lastName} ma dwie kolejne pozytywne oceny okresowe na jednym z dwóch najwyższych poziomów: obowiązek przyznania kolejnego stopnia służbowego do ${formatDatePl(deadline)}.`,
    legalBasis: OBLIGATORY_GRADE_BASIS,
  };
}
