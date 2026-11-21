import type { CycleStart, PartI } from './case.types.js';
import type { DeadlineSpec } from './deadlines.rules.js';
import { USC } from './deadlines.rules.js';
import {
  addDays,
  addMonths,
  daysBetween,
  formatDatePl,
  isNonWorkingDay,
  shiftToWorkingDay,
} from './dates.js';

/**
 * Absences of the assessed person and the extension of the assessment term
 * (art. 81 ust. 7 ustawy o służbie cywilnej: "W razie usprawiedliwionej
 * nieobecności ocenianego w pracy, trwającej dłużej niż miesiąc, termin, o
 * którym mowa w ust. 4, ulega przedłużeniu o czas tej nieobecności").
 * Counting rules from "liczenie terminów" of the challenge:
 * - a continuous absence runs from the first day of the first justified
 *   absence to the last day of the last one that follow each other;
 * - days off work (Saturdays, Sundays, public holidays) between periods of
 *   justified absence do not break the continuity;
 * - "longer than a month" uses the month of art. 112 KC (the continuity is
 *   required, so the 30-day month of art. 114 KC does not apply).
 */

/** One absence period, both days included. */
export interface AbsenceSpan {
  from: string;
  to: string;
  /** Unjustified absences never count (default: justified). */
  justified?: boolean;
}

export interface ContinuousAbsence {
  from: string;
  to: string;
  /** Calendar days, both ends included. */
  days: number;
  longerThanMonth: boolean;
}

/** True when every day strictly between `lastTo` and `nextFrom` is a day off work. */
function bridgedByDaysOff(lastTo: string, nextFrom: string): boolean {
  for (let d = addDays(lastTo, 1); d < nextFrom; d = addDays(d, 1)) {
    if (!isNonWorkingDay(d)) return false;
  }
  return true;
}

/**
 * Merges justified absences into continuous ones: overlapping, adjacent and
 * separated only by days off work. Sorted by start date.
 */
export function continuousAbsences(
  absences: readonly AbsenceSpan[],
): ContinuousAbsence[] {
  const sorted = absences
    .filter((a) => a.justified !== false && a.from <= a.to)
    .map((a) => ({ from: a.from, to: a.to }))
    .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  const merged: { from: string; to: string }[] = [];
  for (const absence of sorted) {
    const last = merged.at(-1);
    if (last && bridgedByDaysOff(last.to, absence.from)) {
      if (absence.to > last.to) last.to = absence.to;
    } else {
      merged.push({ ...absence });
    }
  }
  return merged.map((p) => ({
    ...p,
    days: daysBetween(p.from, p.to) + 1,
    longerThanMonth: isLongerThanMonth(p),
  }));
}

/**
 * Last day of a one-month period that starts on `from` (art. 112 KC): the
 * day before the same date of the next month (5.10 -> 4.11); when the next
 * month has no such date, its last day (31.01 -> 28.02).
 */
export function oneMonthPeriodEnd(from: string): string {
  const sameDate = addMonths(from, 1);
  return sameDate.slice(8) === from.slice(8) ? addDays(sameDate, -1) : sameDate;
}

/** The absence (both days included) lasts longer than a month. */
export function isLongerThanMonth(period: {
  from: string;
  to: string;
}): boolean {
  return period.to > oneMonthPeriodEnd(period.from);
}

export interface AbsenceExtension {
  /** The due date after the extension (shifted to a working day). */
  date: string;
  days: number;
  periods: ContinuousAbsence[];
}

/**
 * art. 81 ust. 7: the assessment due date is extended by the duration of
 * every continuous justified absence longer than a month that falls in the
 * assessment period (from `periodStart` until the due date, which moves with
 * each extension). Only days from `periodStart` on are counted.
 */
export function extendAssessmentDue(
  due: string,
  periodStart: string,
  absences: readonly AbsenceSpan[],
): AbsenceExtension {
  let end = due;
  let days = 0;
  const periods: ContinuousAbsence[] = [];
  for (const period of continuousAbsences(absences)) {
    if (!period.longerThanMonth) continue;
    if (period.to < periodStart || period.from > end) continue;
    const from = period.from < periodStart ? periodStart : period.from;
    const counted = daysBetween(from, period.to) + 1;
    end = addDays(end, counted);
    days += counted;
    periods.push(period);
  }
  return { date: days > 0 ? shiftToWorkingDay(end) : due, days, periods };
}

/** What the extension needs from a case. */
export interface AbsenceCaseFacts {
  cycleStart: CycleStart;
  partI: Pick<PartI, 'confirmedByEvaluatorOn'>;
  absences?: readonly AbsenceSpan[];
}

/**
 * The assessment-due deadline of a case with absences applied. After a
 * negative assessment the re-assessment term (art. 81 ust. 9) is not
 * extended: ust. 7 refers to the term of ust. 4 only.
 */
export function withAbsenceExtension(
  facts: AbsenceCaseFacts,
  spec: DeadlineSpec,
): DeadlineSpec {
  if (!spec.date || !facts.absences?.length) return spec;
  if (facts.cycleStart.kind === 'PREVIOUS_NEGATIVE') return spec;
  const periodStart =
    facts.partI.confirmedByEvaluatorOn ??
    (facts.cycleStart.kind === 'HIRED'
      ? facts.cycleStart.date
      : facts.cycleStart.assessedOn);
  const extension = extendAssessmentDue(spec.date, periodStart, facts.absences);
  if (extension.days === 0) return spec;
  const list = extension.periods
    .map((p) => `${formatDatePl(p.from)}–${formatDatePl(p.to)}`)
    .join(', ');
  return {
    ...spec,
    date: extension.date,
    legalBasis: `${spec.legalBasis}; przedłużony o ${extension.days} dni usprawiedliwionej nieobecności trwającej dłużej niż miesiąc (${list}; art. 81 ust. 7 ${USC})`,
  };
}
