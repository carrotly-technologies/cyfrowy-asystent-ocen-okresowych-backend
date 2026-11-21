import { RO_2016, RP_2015 } from '../assessments/assessment.format.js';
import type { CycleStart, Deadline } from './case.types.js';
import {
  addDays,
  addMonths,
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

/** Default "termin sporządzenia oceny" written in part I: 24 months. */
export function defaultAssessmentDue(partIConfirmedOn: string): string {
  return shiftToWorkingDay(monthsTermEnd(partIConfirmedOn, 24));
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

/** Objection: 7 days from acknowledging the assessment (art. 83 ust. 1). */
export function objectionDeadline(acknowledgedOn: string): DeadlineSpec {
  return termEnd(
    daysTermEnd(acknowledgedOn, 7),
    'Termin na wniesienie sprzeciwu do dyrektora generalnego urzędu',
    `art. 83 ust. 1 ${USC}: 7 dni od dnia zapoznania się z oceną`,
  );
}

/** First assessment: introductory talk within 21 days of hiring (§3). */
export function introTalkDeadline(hiredOn: string): DeadlineSpec {
  return termEnd(
    daysTermEnd(hiredOn, 21),
    'Rozmowa wstępna do',
    `§3 ${RP_2015}: 21 dni od nawiązania stosunku pracy`,
  );
}

/**
 * Default report due date set at the introductory talk. It has to fall after
 * 8 months of employment (§4 ust. 1); we propose 8 months + 14 days, which
 * leaves time for the talk and the assessment before the window closes.
 */
export function defaultReportDue(hiredOn: string): string {
  return shiftToWorkingDay(addDays(monthsTermEnd(hiredOn, 8), 14));
}

export function reportDeadline(reportDue: string | null): DeadlineSpec {
  return {
    date: reportDue,
    label: 'Sprawozdanie pracownika do',
    legalBasis: `§4 ust. 1 i §6 ${RP_2015}: termin wyznaczony na rozmowie wstępnej`,
  };
}

/**
 * Window of the first assessment (art. 38 ust. 1 ustawy): after 8 months of
 * employment and no later than 1 month before the 12-month contract ends.
 */
export function firstAssessmentWindow(hiredOn: string): {
  from: string;
  to: string;
} {
  const contractEnd = addDays(monthsTermEnd(hiredOn, 12), -1);
  return {
    from: addDays(monthsTermEnd(hiredOn, 8), 1),
    to: addMonths(contractEnd, -1),
  };
}

export function firstAssessmentDeadline(hiredOn: string): DeadlineSpec {
  const window = firstAssessmentWindow(hiredOn);
  return {
    date: window.to,
    label: 'Pierwsza ocena najpóźniej do',
    legalBasis: `art. 38 ust. 1 ${USC}: po upływie 8 miesięcy pracy (od ${formatDatePl(window.from)}) i nie później niż miesiąc przed końcem umowy`,
  };
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
