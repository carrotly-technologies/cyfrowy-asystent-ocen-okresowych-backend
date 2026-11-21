import { RO_2016 } from '../assessments/assessment.format.js';
import { CaseRuleError, CaseValidationError } from './case-rule.error.js';
import type {
  ActorRef,
  CaseRecord,
  DueChangeReason,
  DueDateChange,
  PositionChange,
  StageId,
} from './case.types.js';
import {
  addDays,
  addMonths,
  daysTermEnd,
  formatDatePl,
  isIsoDate,
  shiftToWorkingDay,
} from './dates.js';
import { type DeadlineSpec, USC } from './deadlines.rules.js';

/**
 * Changes of the assessment due date (termin sporządzenia oceny):
 * - art. 81 ust. 7 ustawy: extended by a justified continuous absence longer
 *   than a month (derived on read in absences.rules.ts, not stored here);
 * - art. 81 ust. 8 ustawy: changed by the evaluator for one of four reasons,
 *   only when more than 6 months passed since the last assessment (or, for a
 *   first assessment, the assessed period is longer than 6 months);
 * - §8 rozp. 2016: the evaluator notifies the assessed person in writing
 *   without delay; a copy of the notice goes with the sheet;
 * - art. 81 ust. 9: the re-assessment after a negative one (after 6 months
 *   from acknowledging it) is neither extended nor changed.
 */

/** Who changes the due date automatically (art. 81 ust. 7). */
export const SYSTEM_ACTOR: ActorRef = {
  name: 'System (harmonogram terminów)',
  role: 'SYSTEM',
};

/** art. 81 ust. 8 ustawy: "upłynęło więcej niż 6 miesięcy". */
export const DUE_CHANGE_MIN_MONTHS = 6;
/** §9 ust. 1 rozp. 2016: window after the setting of criteria / last assessment. */
export const POSITION_CHANGE_WINDOW_MONTHS = 6;
/** §9 ust. 1: part I again within 30 days of the change of position. */
export const POSITION_CHANGE_REDO_DAYS = 30;
/** §9 ust. 2: the assessment not earlier than 7 days before the change... */
export const POSITION_CHANGE_EARLIEST_DAYS = 7;
/** ...and not later than 30 days after it. */
export const POSITION_CHANGE_LATEST_DAYS = 30;

export interface DueChangeReasonInfo {
  id: DueChangeReason;
  label: string;
  legalBasis: string;
  /** The evaluator may pick it (the others are set by the system). */
  selectable: boolean;
}

export const DUE_CHANGE_REASONS: readonly DueChangeReasonInfo[] = [
  {
    id: 'EVALUATOR_CHANGE',
    label: 'Zmiana na stanowisku oceniającego w trakcie okresu oceny',
    legalBasis: `art. 81 ust. 8 pkt 1 ${USC}`,
    selectable: true,
  },
  {
    id: 'EVALUEE_ABSENCE_EXPECTED',
    label:
      'Przewidywana dłuższa, usprawiedliwiona nieobecność ocenianego, która może uniemożliwić przeprowadzenie oceny',
    legalBasis: `art. 81 ust. 8 pkt 2 ${USC}`,
    selectable: true,
  },
  {
    id: 'EVALUATOR_ABSENCE_EXPECTED',
    label:
      'Przewidywana dłuższa, usprawiedliwiona nieobecność oceniającego, która może utrudnić przeprowadzenie oceny',
    legalBasis: `art. 81 ust. 8 pkt 3 ${USC}`,
    selectable: true,
  },
  {
    id: 'EVALUEE_REQUEST',
    label: 'Wniosek ocenianego o zmianę terminu przeprowadzenia oceny',
    legalBasis: `art. 81 ust. 8 pkt 4 ${USC}`,
    selectable: true,
  },
  {
    id: 'ABSENCE_EXTENSION',
    label:
      'Przedłużenie o czas usprawiedliwionej nieobecności ocenianego trwającej dłużej niż miesiąc',
    legalBasis: `art. 81 ust. 7 ${USC}`,
    selectable: false,
  },
  {
    id: 'POSITION_CHANGE',
    label:
      'Zmiana stanowiska pracy wiążąca się z istotną zmianą zakresu obowiązków',
    legalBasis: `art. 81 ust. 6 ${USC}; §9 ust. 2 ${RO_2016}`,
    selectable: false,
  },
];

export function reasonInfo(reason: DueChangeReason): DueChangeReasonInfo {
  return DUE_CHANGE_REASONS.find((r) => r.id === reason)!;
}

/** Start of the 6-month count: last assessment, or employment for a first one. */
export function lastAssessmentAnchor(record: CaseRecord): string {
  return record.cycleStart.kind === 'HIRED'
    ? record.cycleStart.date
    : record.cycleStart.assessedOn;
}

/**
 * art. 81 ust. 8 (closing words): null when more than 6 months passed since
 * the last assessment (first assessment: the assessed period is longer than 6
 * months), otherwise the Polish reason why the date cannot be changed yet.
 */
export function sixMonthsBlocker(
  record: CaseRecord,
  today: string,
): string | null {
  const anchor = lastAssessmentAnchor(record);
  const limit = addMonths(anchor, DUE_CHANGE_MIN_MONTHS);
  if (today > limit) return null;
  return record.cycleStart.kind === 'HIRED'
    ? `Termin oceny można zmienić, gdy okres podlegający ocenie jest dłuższy niż 6 miesięcy (od ${formatDatePl(anchor)} – po ${formatDatePl(limit)}; art. 81 ust. 8 ${USC}).`
    : `Termin oceny można zmienić, gdy od sporządzenia ostatniej oceny (${formatDatePl(anchor)}) upłynęło więcej niż 6 miesięcy – po ${formatDatePl(limit)} (art. 81 ust. 8 ${USC}).`;
}

/** Why the due date cannot be changed at all now; null when it can. */
export function dueChangeBlocker(
  record: CaseRecord,
  reason: DueChangeReason,
  today: string,
): string | null {
  if (record.signedByEvaluatorOn) {
    return `Ocena została już sporządzona (${formatDatePl(record.signedByEvaluatorOn)}), więc jej termin nie może się zmienić.`;
  }
  if (!record.partI.assessmentDue) {
    return 'Termin oceny nie jest jeszcze ustalony: najpierw zatwierdź arkusz i termin oceny.';
  }
  if (record.cycleStart.kind === 'PREVIOUS_NEGATIVE') {
    return `Ponowna ocena po ocenie negatywnej odbywa się po upływie 6 miesięcy od zapoznania się z nią (art. 81 ust. 9 ${USC}); tego terminu nie przedłuża się ani nie zmienia.`;
  }
  if (reason === 'ABSENCE_EXTENSION' || reason === 'POSITION_CHANGE') {
    return null;
  }
  return sixMonthsBlocker(record, today);
}

export interface ChangeDueDateInput {
  newDate: string;
  reason: DueChangeReason;
  /** Who changes it (the system for automatic extensions). */
  by: ActorRef;
  note?: string;
  absence?: { from: string; to: string; days: number };
}

/** §8 rozp. 2016: text of the written notice to the assessed person. */
export function dueChangeNotice(
  record: CaseRecord,
  change: Omit<DueDateChange, 'notice' | 'id'>,
): string {
  const who = `${record.person.firstName} ${record.person.lastName}`;
  const why =
    change.reasonCode === 'ABSENCE_EXTENSION' && change.absence
      ? `${change.reason} (od ${formatDatePl(change.absence.from)} do ${formatDatePl(change.absence.to)}, ${change.absence.days} dni)`
      : change.reason;
  return [
    `Zawiadomienie o zmianie terminu sporządzenia oceny okresowej`,
    `Pani/Pan ${who}, ${record.person.position}.`,
    `Zawiadamiam, że termin sporządzenia oceny okresowej zmienia się z ${change.from ? formatDatePl(change.from) : '—'} na ${formatDatePl(change.to)}.`,
    `Przyczyna: ${why} (${change.legalBasis}).`,
    change.note ? `Uzasadnienie: ${change.note}` : '',
    `Kopię niniejszego pisma dołącza się do arkusza oceny (§8 ${RO_2016}).`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * The one way to change the due date (evaluator, employee's request, the
 * scheduler). Validates the rules, writes part I, the change log, the §8
 * notice and the history. Pure: returns the updated copy and the change.
 * Throws CaseRuleError (409) with a Polish explanation when the date is
 * invalid or the law does not allow the change now.
 */
export function changeDueDate(
  record: CaseRecord,
  input: ChangeDueDateInput,
  today: string,
): { record: CaseRecord; change: DueDateChange } {
  if (!isIsoDate(input.newDate)) {
    throw new CaseRuleError(
      'Nowy termin oceny musi być datą w formacie RRRR-MM-DD.',
    );
  }
  const blocker = dueChangeBlocker(record, input.reason, today);
  if (blocker)
    throw new CaseRuleError(`Nie można zmienić terminu oceny. ${blocker}`);
  if (input.newDate < today) {
    throw new CaseRuleError(
      `Nowy termin oceny (${formatDatePl(input.newDate)}) nie może być wcześniejszy niż dziś (${formatDatePl(today)}).`,
    );
  }
  const to = shiftToWorkingDay(input.newDate);
  const from = record.partI.assessmentDue;
  if (to === from) {
    throw new CaseRuleError(
      `Nowy termin jest taki sam jak obecny (${formatDatePl(to)}).`,
    );
  }
  const info = reasonInfo(input.reason);
  const next = structuredClone(record);
  const changes = next.dueDateChanges ?? [];
  const base: Omit<DueDateChange, 'notice' | 'id'> = {
    changedOn: today,
    from,
    to,
    reason: info.label,
    reasonCode: input.reason,
    legalBasis: info.legalBasis,
    by: input.by,
    note: input.note?.trim() ?? '',
    ...(input.absence ? { absence: input.absence } : {}),
  };
  const change: DueDateChange = {
    ...base,
    id: `${record.id}-due-${changes.length + 1}`,
    notice: { sentOn: today, text: dueChangeNotice(record, base) },
  };
  next.partI.assessmentDue = to;
  next.dueDateChanges = [...changes, change];
  next.history.push({
    date: today,
    text: `Zmieniono termin sporządzenia oceny z ${from ? formatDatePl(from) : '—'} na ${formatDatePl(to)}${to !== input.newDate ? ` (${formatDatePl(input.newDate)} to dzień wolny od pracy)` : ''} (${input.by.name}). Przyczyna: ${info.label}${base.note ? `; ${base.note}` : ''} (${info.legalBasis}). Ocenianego zawiadomiono pisemnie; kopia pisma jest dołączona do arkusza (§8 ${RO_2016}).`,
    event: {
      type: 'DUE_DATE_CHANGED',
      notify: ['EMPLOYEE', 'EVALUATOR', 'HR'],
    },
  });
  return { record: next, change };
}

/**
 * Change of position with a significant change of duties (§9 rozp. 2016):
 * - within 6 months of setting the criteria of a first assessment or of the
 *   last assessment: part I again within 30 days, due date unchanged (ust. 1);
 * - later: an assessment (art. 81 ust. 6), not earlier than 7 days before and
 *   not later than 30 days after the change (ust. 2).
 */
export function positionChangeEffect(
  record: CaseRecord,
  changeDate: string,
): Omit<PositionChange, 'id' | 'recordedOn'> {
  const anchor =
    record.cycleStart.kind === 'HIRED'
      ? (record.partI.confirmedByEvaluatorOn ?? record.cycleStart.date)
      : record.cycleStart.assessedOn;
  if (changeDate <= addMonths(anchor, POSITION_CHANGE_WINDOW_MONTHS)) {
    const deadline = shiftToWorkingDay(
      daysTermEnd(changeDate, POSITION_CHANGE_REDO_DAYS),
    );
    return {
      date: changeDate,
      effect: 'REDO_PART_I',
      deadline,
      earliest: null,
      message: `Zmiana stanowiska w ciągu 6 miesięcy od ${record.cycleStart.kind === 'HIRED' ? 'ustalenia kryteriów' : 'ostatniej oceny'} (${formatDatePl(anchor)}): ponownie przeprowadź rozmowę rozpoczynającą i ustal kryteria (część I) do ${formatDatePl(deadline)}. Termin sporządzenia oceny się nie zmienia.`,
      legalBasis: `§9 ust. 1 ${RO_2016}`,
    };
  }
  const earliest = addDays(changeDate, -POSITION_CHANGE_EARLIEST_DAYS);
  const deadline = shiftToWorkingDay(
    daysTermEnd(changeDate, POSITION_CHANGE_LATEST_DAYS),
  );
  return {
    date: changeDate,
    effect: 'ASSESSMENT',
    deadline,
    earliest,
    message: `Od ${record.cycleStart.kind === 'HIRED' ? 'początku okresu oceny' : 'ostatniej oceny'} (${formatDatePl(anchor)}) upłynęło więcej niż 6 miesięcy: sporządź ocenę okresową nie wcześniej niż ${formatDatePl(earliest)} i nie później niż ${formatDatePl(deadline)}.`,
    legalBasis: `art. 81 ust. 6 ${USC}; §9 ust. 2 ${RO_2016}`,
  };
}

/** Stages from which §9 ust. 1 sends the case back to the opening talk. */
const REOPENABLE_STAGES: readonly StageId[] = [
  'PART_I_ACK',
  'OBSERVATION',
  'ASSESSMENT',
  'SIGNATURE',
];

/**
 * §9 ust. 1 rozp. 2016: after a change of position within 6 months the
 * activities of §5 and §6 are made again within 30 days (part I: talk,
 * criteria, confirmations); "termin sporządzenia oceny nie ulega zmianie".
 * Moves the case back to OPENING_TALK keeping the due date and the criteria
 * chosen so far (the evaluator may change them). No-op before part I is
 * confirmed or once the assessment is signed.
 */
export function reopenPartI(
  record: CaseRecord,
  change: Pick<PositionChange, 'deadline'>,
  today: string,
): CaseRecord {
  if (record.signedByEvaluatorOn || !REOPENABLE_STAGES.includes(record.stage)) {
    return record;
  }
  const next = structuredClone(record);
  next.stage = 'OPENING_TALK';
  next.partI.confirmedByEvaluatorOn = null;
  next.partI.acknowledgedByEmployeeOn = null;
  next.assessmentTalkOn = null;
  for (const stage of [
    'OPENING_TALK',
    'PART_I_ACK',
    'OBSERVATION',
    'ASSESSMENT',
  ] as const) {
    delete next.completedOn[stage];
  }
  next.history.push({
    date: today,
    text: `Sprawa wróciła do etapu rozmowy rozpoczynającej: część I (obowiązki, kryteria, oczekiwania) ustala się ponownie do ${formatDatePl(change.deadline)}, a oceniany ponownie ją potwierdza (§9 ust. 1, §5–§6 ${RO_2016}). Termin sporządzenia oceny bez zmian${next.partI.assessmentDue ? ` (${formatDatePl(next.partI.assessmentDue)})` : ''}.`,
  });
  return next;
}

/**
 * The 30-day term of §9 ust. 1 while part I waits to be made again; null
 * when no such change is pending.
 */
export function redoPartIDeadline(record: CaseRecord): DeadlineSpec | null {
  if (record.partI.acknowledgedByEmployeeOn) return null;
  const change = (record.positionChanges ?? [])
    .filter((c) => c.effect === 'REDO_PART_I')
    .at(-1);
  if (!change) return null;
  return {
    date: change.deadline,
    label: 'Ponowna rozmowa rozpoczynająca (część I) po zmianie stanowiska do',
    legalBasis: `§9 ust. 1 ${RO_2016}: 30 dni od zmiany stanowiska (${formatDatePl(change.date)})`,
  };
}

/**
 * Change of the evaluator during the period (§9 ust. 3 rozp. 2016): the new
 * evaluator assesses on the criteria chosen earlier; part I is kept as is.
 */
export function reassignEvaluator(
  record: CaseRecord,
  evaluatorId: string,
  evaluatorName: string,
  today: string,
): CaseRecord {
  if (record.signedByEvaluatorOn) {
    throw new CaseRuleError(
      'Ocena została już podpisana: oceniającego nie można zmienić.',
    );
  }
  if (record.evaluatorId === evaluatorId) {
    throw new CaseValidationError(['To jest obecny oceniający w tej sprawie.']);
  }
  const next = structuredClone(record);
  next.evaluatorId = evaluatorId;
  next.history.push({
    date: today,
    text: `Zmiana oceniającego w trakcie okresu oceny: ocenę sporządzi ${evaluatorName}, na podstawie wybranych wcześniej kryteriów (§9 ust. 3 ${RO_2016}). Nowy oceniający może zmienić termin oceny (art. 81 ust. 8 pkt 1 ${USC}).`,
  });
  return next;
}
