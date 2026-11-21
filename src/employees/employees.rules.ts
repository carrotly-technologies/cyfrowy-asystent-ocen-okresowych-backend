import type { CycleStart, PreviousAssessment } from '../cases/case.types.js';
import { addMonths, formatDatePl } from '../cases/dates.js';
import { USC } from '../cases/deadlines.rules.js';
import { previousLevelLabels } from '../cases/promotion.rules.js';
import type { Employee, Substitution } from './employees.types.js';

/** One past assessment of a person: from a finished case or the CSV import. */
export interface PastAssessment {
  source: 'SYSTEM' | 'IMPORT';
  caseId: string | null;
  assessedOn: string;
  acknowledgedOn: string | null;
  result: 'POSITIVE' | 'NEGATIVE';
  level: string | null;
}

/** Newest first (by the date the assessment was made in writing). */
export function byNewest(a: PastAssessment, b: PastAssessment): number {
  return b.assessedOn.localeCompare(a.assessedOn);
}

export type CycleStartResult =
  | {
      ok: true;
      cycleStart: CycleStart;
      previousAssessment: PreviousAssessment | null;
      reason: string;
    }
  | { ok: false; message: string };

/**
 * How a new assessment cycle starts ("wyznaczenie kryteriów oceny" boundary
 * conditions): after the last assessment made in writing, or, for a person
 * never assessed, on employment for an indefinite period / appointment. The
 * opening-talk deadline follows from it (§7 rozp. 2016: 30 days, 7 after a
 * negative assessment). An urzędnik gets "dane dotyczące poprzedniej oceny"
 * (part II, item 10) prefilled.
 */
export function newCycleStart(
  employee: Pick<Employee, 'employment' | 'indefiniteSince'>,
  history: readonly PastAssessment[],
): CycleStartResult {
  const last = [...history].sort(byNewest)[0];
  if (last) {
    const previousAssessment: PreviousAssessment | null =
      employee.employment === 'URZEDNIK'
        ? { result: last.result, level: last.level, date: last.assessedOn }
        : null;
    if (last.result === 'NEGATIVE') {
      return {
        ok: true,
        cycleStart: {
          kind: 'PREVIOUS_NEGATIVE',
          assessedOn: last.assessedOn,
          acknowledgedOn: last.acknowledgedOn ?? last.assessedOn,
        },
        previousAssessment,
        reason:
          'Poprzednia ocena była negatywna: rozmowa rozpoczynająca w 7 dni od jej sporządzenia, ponowna ocena po 6 miesiącach od zapoznania (art. 81 ust. 9 ustawy).',
      };
    }
    return {
      ok: true,
      cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: last.assessedOn },
      previousAssessment,
      reason:
        'Cykl liczony od sporządzenia poprzedniej oceny: rozmowa rozpoczynająca w 30 dni.',
    };
  }
  if (!employee.indefiniteSince) {
    return {
      ok: false,
      message:
        'Nie można rozpocząć oceny: brak daty zatrudnienia na czas nieokreślony (lub mianowania) i brak poprzedniej oceny. Uzupełnij dane w kartotece albo zaimportuj ocenę historyczną.',
    };
  }
  return {
    ok: true,
    cycleStart: { kind: 'HIRED', date: employee.indefiniteSince },
    previousAssessment: null,
    reason:
      'Pierwsza ocena: rozmowa rozpoczynająca w 30 dni od zatrudnienia na czas nieokreślony lub mianowania.',
  };
}

/** The two highest levels of the scale (art. 89 ust. 2 ustawy). */
export function topTwoLevels(): string[] {
  return previousLevelLabels().slice(-2);
}

export interface ObligatoryPromotion {
  due: boolean;
  reason: string;
  legalBasis: string;
}

/**
 * art. 89 ust. 2 ustawy: an urzędnik who, since the last grade, obtained two
 * consecutive positive periodic assessments at one of the two highest levels
 * of the scale gets the next grade (within 30 days of acknowledging the
 * assessment). Only assessments after `gradeGrantedOn` count, when known.
 */
export function obligatoryPromotion(
  employee: Pick<Employee, 'employment' | 'gradeGrantedOn'>,
  history: readonly PastAssessment[],
): ObligatoryPromotion {
  const legalBasis = `art. 89 ust. 2 ${USC}`;
  if (employee.employment !== 'URZEDNIK') {
    return {
      due: false,
      reason: 'Dotyczy tylko urzędników służby cywilnej.',
      legalBasis,
    };
  }
  const top = topTwoLevels();
  const since = employee.gradeGrantedOn;
  const [last, previous] = [...history]
    .filter((h) => !since || h.assessedOn > since)
    .sort(byNewest);
  const high = (h?: PastAssessment) =>
    !!h &&
    h.result === 'POSITIVE' &&
    !!h.level &&
    top.includes(h.level.toLocaleLowerCase('pl-PL'));
  if (high(last) && high(previous)) {
    return {
      due: true,
      reason:
        'Dwie kolejne oceny pozytywne na jednym z dwóch najwyższych poziomów od otrzymania ostatniego stopnia: kolejny stopień służbowy w 30 dni od zapoznania z oceną.',
      legalBasis,
    };
  }
  return {
    due: false,
    reason:
      'Brak dwóch kolejnych ocen na jednym z dwóch najwyższych poziomów od ostatniego stopnia.',
    legalBasis,
  };
}

/**
 * The evaluator who assesses now: the substitute while a substitution of
 * the regular evaluator is active on `today` (both days included).
 */
export function effectiveEvaluator(
  evaluatorId: string | null,
  substitutions: readonly Substitution[],
  today: string,
): { evaluatorId: string | null; substitution: Substitution | null } {
  if (!evaluatorId) return { evaluatorId: null, substitution: null };
  const active = substitutions.find(
    (s) => s.evaluatorId === evaluatorId && s.from <= today && today <= s.to,
  );
  return active
    ? { evaluatorId: active.substituteId, substitution: active }
    : { evaluatorId, substitution: null };
}

/**
 * Next step of HR when the next grade is obligatory (art. 89 ust. 2): the
 * director general grants it within 30 days of the acknowledgement.
 */
export function obligatoryPromotionNextStep(
  deadline: string | null,
  today: string,
  formatDate: (iso: string) => string,
): string {
  const act =
    'Przygotuj dla dyrektora generalnego urzędu akt przyznania kolejnego stopnia służbowego';
  if (!deadline)
    return `${act}; termin (30 dni od zapoznania z oceną) wylicz po uzupełnieniu daty zapoznania.`;
  return deadline < today
    ? `${act} niezwłocznie: termin upłynął ${formatDate(deadline)}.`
    : `${act} do ${formatDate(deadline)}.`;
}

/** Org unit names compared without case and extra spaces. */
export function normalizeUnit(unit: string): string {
  return unit.trim().replace(/\s+/g, ' ');
}

const unitKey = (unit: string) =>
  normalizeUnit(unit).toLocaleLowerCase('pl-PL');
const firstSegment = (unit: string) => unitKey(unit).split(',')[0].trim();

/**
 * A new organisational unit must not duplicate an existing one: the same
 * name written differently ("wydział legislacji") or only its first part
 * ("Wydział Legislacji" for "Wydział Legislacji, Departament Prawny"), or
 * an existing short name with a part added.
 * Returns the existing unit it collides with, or null when the name is new
 * or exactly an existing one.
 */
export function conflictingUnit(
  unit: string,
  existing: readonly string[],
): string | null {
  const name = normalizeUnit(unit);
  if (existing.includes(name)) return null;
  const key = unitKey(name);
  return (
    existing.find(
      (e) =>
        unitKey(e) === key ||
        firstSegment(e) === key ||
        firstSegment(name) === unitKey(e),
    ) ?? null
  );
}

/**
 * Retention of the personnel file (akta osobowe), which holds the periodic
 * assessments (§6 ust. 3, §12 ust. 2 rozp. 2016): 10 years (art. 94 pkt 9b
 * KP). The application counts it, conservatively, from the latest assessment
 * of the person; before it ends the data is only archived/anonymised on an
 * administrator's documented decision.
 */
export const PERSONNEL_FILE_RETENTION_YEARS = 10;
export const RETENTION_BASIS =
  'art. 94 pkt 9b Kodeksu pracy (akta osobowe: 10 lat)';

/** The day the retention ends (null: no assessment on record). */
export function retentionUntil(assessedOn: readonly string[]): string | null {
  const latest = [...assessedOn].sort().at(-1);
  return latest ? addMonths(latest, PERSONNEL_FILE_RETENTION_YEARS * 12) : null;
}

/**
 * Why archiving (anonymisation) of a person's data is refused now, or null.
 * Before the retention ends only an ADMIN may do it, with a reason.
 */
export function archiveBlocker(input: {
  assessedOn: readonly string[];
  today: string;
  role: string;
  reason?: string | null;
}): string | null {
  const until = retentionUntil(input.assessedOn);
  if (!until || input.today >= until) return null;
  if (input.role === 'ADMIN' && input.reason?.trim()) return null;
  return `Oceny okresowe tej osoby są częścią akt osobowych i podlegają przechowywaniu do ${formatDatePl(until)} (${RETENTION_BASIS}). Przed upływem tego okresu dane może zarchiwizować i zanonimizować wyłącznie administrator, podając powód.`;
}
