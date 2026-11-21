import { RO_2016 } from '../assessments/assessment.format.js';
import type { CycleStart, Deadline } from './case.types.js';
import {
  addDays,
  daysBetween,
  daysTermEnd,
  formatDatePl,
  monthsTermEnd,
  shiftToWorkingDay,
} from './dates.js';

export const USC = 'ustawy o służbie cywilnej';
/** Days left at which a deadline turns from OK to SOON. */
export const SOON_DAYS = 14;

/** A deadline before it is related to "today". */
export interface DeadlineSpec {
  date: string | null;
  label: string;
  legalBasis: string;
}

/**
 * Applies R3 (non-working day -> next working day) and records it in the
 * legal basis, so the shift is never silent.
 */
function termEnd(
  rawEnd: string,
  label: string,
  legalBasis: string,
): DeadlineSpec {
  const date = shiftToWorkingDay(rawEnd);
  return {
    date,
    label,
    legalBasis:
      date === rawEnd
        ? legalBasis
        : `${legalBasis}; termin przypadał na dzień wolny od pracy (${formatDatePl(rawEnd)}), więc upływa w najbliższy dzień roboczy (art. 115 KC)`,
  };
}

/**
 * Opening talk (rozmowa rozpoczynająca, part I): 30 days from the indefinite
 * contract / previous assessment made in writing, 7 days after a negative one.
 */
export function openingTalkDeadline(cycle: CycleStart): DeadlineSpec {
  const label = 'Rozmowa rozpoczynająca (część I) do';
  switch (cycle.kind) {
    case 'HIRED':
      return termEnd(
        daysTermEnd(cycle.date, 30),
        label,
        `§7 pkt 1 ${RO_2016}: 30 dni od zatrudnienia na czas nieokreślony lub mianowania`,
      );
    case 'PREVIOUS_POSITIVE':
      return termEnd(
        daysTermEnd(cycle.assessedOn, 30),
        label,
        `§7 pkt 1 ${RO_2016}: 30 dni od sporządzenia na piśmie poprzedniej oceny`,
      );
    case 'PREVIOUS_NEGATIVE':
      return termEnd(
        daysTermEnd(cycle.assessedOn, 7),
        label,
        `§7 pkt 2 ${RO_2016}: 7 dni od sporządzenia na piśmie oceny negatywnej`,
      );
  }
}

/** Months between periodic assessments (art. 81 ust. 4 ustawy o służbie cywilnej). */
export const ASSESSMENT_CYCLE_MONTHS = 24;

/**
 * Start of the 24-month period of art. 81 ust. 4 (the anchor of the default
 * due date and of absences counted under ust. 7): the day of the indefinite
 * contract / appointment, or the day the previous assessment was made in
 * writing (Poradnik KPRM, p. 8; schema of the sheet: "24 miesiące od początku
 * cyklu"). Not the day part I was accepted.
 */
export function cycleAnchor(cycle: CycleStart): string {
  return cycle.kind === 'HIRED' ? cycle.date : cycle.assessedOn;
}

/** The 24-month term before R3 (art. 115 KC) is applied. */
export function rawAssessmentDue(anchor: string): string {
  return monthsTermEnd(anchor, ASSESSMENT_CYCLE_MONTHS);
}

/**
 * Predicted date of the person's next periodic assessment: 24 months from the
 * day the last one was made in writing (art. 81 ust. 1 i 4 ustawy o służbie
 * cywilnej), before R3. null while no assessment has been signed.
 */
export function nextEvaluationDueOn(
  lastSignedOn: string | null,
): string | null {
  return lastSignedOn ? rawAssessmentDue(lastSignedOn) : null;
}

/**
 * Default "termin sporządzenia oceny" written in part I: 24 months from
 * `anchor` (see cycleAnchor), moved to the next working day.
 */
export function defaultAssessmentDue(anchor: string): string {
  return shiftToWorkingDay(rawAssessmentDue(anchor));
}

/**
 * Re-assessment after a negative one: after 6 months from acknowledging it
 * (art. 81 ust. 9), i.e. on the next day (ack 15.02.2015 -> 16.08.2015 in the
 * poradnik). This term is not extended by absences (ust. 7) nor changed (ust. 8).
 */
export function reassessmentAfterNegativeDue(acknowledgedOn: string): string {
  return shiftToWorkingDay(addDays(monthsTermEnd(acknowledgedOn, 6), 1));
}

/** Assessment due date of the cycle as written in part I (or by law). */
export function assessmentDueDeadline(
  cycle: CycleStart,
  assessmentDue: string | null,
): DeadlineSpec {
  const label = 'Termin sporządzenia oceny';
  if (cycle.kind === 'PREVIOUS_NEGATIVE') {
    return {
      date: assessmentDue ?? reassessmentAfterNegativeDue(cycle.acknowledgedOn),
      label,
      legalBasis: `art. 81 ust. 9 ${USC}: ponowna ocena po upływie 6 miesięcy od zapoznania z oceną negatywną (${formatDatePl(cycle.acknowledgedOn)})`,
    };
  }
  return {
    date: assessmentDue,
    label,
    legalBasis: `art. 81 ust. 1 i 4 ${USC} (co 24 miesiące); termin wpisany w części I arkusza (§5 ust. 3 ${RO_2016})`,
  };
}

/**
 * Objection: 7 days from acknowledging the assessment (art. 83 ust. 1).
 * `to`: the addressee in the genitive (objection-addressee.rules.ts).
 */
export function objectionDeadline(
  acknowledgedOn: string,
  to = 'dyrektora generalnego urzędu',
): DeadlineSpec {
  return termEnd(
    daysTermEnd(acknowledgedOn, 7),
    `Termin na wniesienie sprzeciwu do ${to}`,
    `art. 83 ust. 1 ${USC}: 7 dni od dnia zapoznania się z oceną`,
  );
}

/** Relates a deadline to "today": days left and OK / SOON / OVERDUE / NONE. */
export function toDeadline(spec: DeadlineSpec, today: string): Deadline {
  if (!spec.date) {
    return { ...spec, date: null, daysLeft: null, state: 'NONE' };
  }
  const daysLeft = daysBetween(today, spec.date);
  return {
    date: spec.date,
    daysLeft,
    state: daysLeft < 0 ? 'OVERDUE' : daysLeft <= SOON_DAYS ? 'SOON' : 'OK',
    label: spec.label,
    legalBasis: spec.legalBasis,
  };
}

/** "za 13 dni" / "dziś" / "po terminie 3 dni" */
export function describeDaysLeft(daysLeft: number): string {
  if (daysLeft === 0) return 'upływa dziś';
  if (daysLeft === 1) return 'został 1 dzień';
  if (daysLeft > 0) {
    const few =
      [2, 3, 4].includes(daysLeft % 10) &&
      ![12, 13, 14].includes(daysLeft % 100);
    return few ? `zostały ${daysLeft} dni` : `zostało ${daysLeft} dni`;
  }
  return `po terminie ${-daysLeft} ${daysLeft === -1 ? 'dzień' : 'dni'}`;
}
