import { GRADE_IDS } from '../civil-service-grades/data/grades.data.js';
import {
  caseCriteria,
  computeEvaluation,
  criterionName,
  findCriterion,
  sheetOf,
} from './case.rules.js';
import { CaseRuleError, CaseValidationError } from './case-rule.error.js';
import type { CaseRecord, StageId } from './case.types.js';
import { formatDatePl, isIsoDate } from './dates.js';
import { nextGrade, previousLevelLabels } from './promotion.rules.js';

/**
 * „Tryb korekty błędów przez administratora” (schemat pól formularza A/B/C:
 * a field locked after a confirmation can be changed „wyłącznie w trybie
 * korekty błędów przez administratora”). Pure rules: which fields can be
 * corrected, how a value is validated and how the change is audited.
 */

export type CorrectionKind =
  | 'DATE'
  | 'TEXT'
  | 'SCORE'
  | 'CRITERIA'
  | 'RESULT'
  | 'LEVEL'
  | 'ATTACHED'
  | 'GRADE'
  | 'YEAR';

export interface CorrectableField {
  /** Path in the case, e.g. `partI.assessmentDue`, `decisions.komunikacja`. */
  field: string;
  label: string;
  section: 'Część I' | 'Część II' | 'Część III';
  kind: CorrectionKind;
  /** Allowed values of a choice field (null = empty is allowed too). */
  options?: readonly (string | number)[];
  value: unknown;
  display: string;
}

/** One audited correction (who, when, old → new, why). */
export interface Correction {
  id: string;
  /** Real timestamp of the change (ISO 8601). */
  at: string;
  /** Demo „today” of the change (YYYY-MM-DD), as in the case history. */
  date: string;
  by: { userId: string; name: string };
  field: string;
  label: string;
  section: CorrectableField['section'];
  oldValue: string;
  newValue: string;
  reason: string;
}

export interface CorrectionInput {
  field: string;
  value: unknown;
  reason: string;
}

/** Shortest reason accepted: the reason is part of the audit trail. */
export const MIN_REASON_LENGTH = 10;
const TEXT_MAX = 10000;
/** Part III: the year of appointment (rok mianowania) is chosen from 2008 on. */
const FIRST_APPOINTMENT_YEAR = 2008;

interface FieldDef {
  label: string;
  section: CorrectableField['section'];
  kind: CorrectionKind;
  get(record: CaseRecord): unknown;
  set(record: CaseRecord, value: unknown): void;
  /** Stage completed on the same day as this date (kept in sync). */
  stage?: StageId;
  /** Only for an urzędnik służby cywilnej (items 10–11, part III). */
  urzednikOnly?: boolean;
}

const FIELDS: Record<string, FieldDef> = {
  'partI.additionalCriteria': {
    label: 'Kryteria dodatkowe wybrane przez oceniającego',
    section: 'Część I',
    kind: 'CRITERIA',
    get: (r) => r.partI.additionalCriteria,
    set: (r, v) => (r.partI.additionalCriteria = v as string[]),
  },
  'partI.assessmentDue': {
    label: 'Termin sporządzenia oceny',
    section: 'Część I',
    kind: 'DATE',
    get: (r) => r.partI.assessmentDue,
    set: (r, v) => (r.partI.assessmentDue = v as string | null),
  },
  'partI.confirmedByEvaluatorOn': {
    label: 'Data potwierdzenia rozmowy przez oceniającego (część I)',
    section: 'Część I',
    kind: 'DATE',
    stage: 'OPENING_TALK',
    get: (r) => r.partI.confirmedByEvaluatorOn,
    set: (r, v) => (r.partI.confirmedByEvaluatorOn = v as string | null),
  },
  'partI.acknowledgedByEmployeeOn': {
    label: 'Data potwierdzenia części I przez ocenianego',
    section: 'Część I',
    kind: 'DATE',
    stage: 'PART_I_ACK',
    get: (r) => r.partI.acknowledgedByEmployeeOn,
    set: (r, v) => (r.partI.acknowledgedByEmployeeOn = v as string | null),
  },
  assessmentTalkOn: {
    label: 'Data przeprowadzenia rozmowy oceniającej',
    section: 'Część II',
    kind: 'DATE',
    stage: 'ASSESSMENT',
    get: (r) => r.assessmentTalkOn,
    set: (r, v) => (r.assessmentTalkOn = v as string | null),
  },
  justification: {
    label: 'Uzasadnienie przyznanej oceny okresowej',
    section: 'Część II',
    kind: 'TEXT',
    get: (r) => r.justification,
    set: (r, v) => (r.justification = v as string),
  },
  iprz: {
    label: 'Wnioski dotyczące indywidualnego programu rozwoju zawodowego',
    section: 'Część II',
    kind: 'TEXT',
    get: (r) => r.iprz,
    set: (r, v) => (r.iprz = v as string),
  },
  'previousAssessment.result': {
    label: 'Poprzednia ocena okresowa: ocena',
    section: 'Część II',
    kind: 'RESULT',
    urzednikOnly: true,
    get: (r) => r.previousAssessment?.result ?? null,
    set: (r, v) =>
      (r.previousAssessment = {
        level: null,
        date: null,
        ...r.previousAssessment,
        result: v as 'POSITIVE' | 'NEGATIVE' | null,
      }),
  },
  'previousAssessment.level': {
    label: 'Poprzednia ocena okresowa: poziom',
    section: 'Część II',
    kind: 'LEVEL',
    urzednikOnly: true,
    get: (r) => r.previousAssessment?.level ?? null,
    set: (r, v) =>
      (r.previousAssessment = {
        result: null,
        date: null,
        ...r.previousAssessment,
        level: v as string | null,
      }),
  },
  'previousAssessment.date': {
    label: 'Poprzednia ocena okresowa: data sporządzenia',
    section: 'Część II',
    kind: 'DATE',
    urzednikOnly: true,
    get: (r) => r.previousAssessment?.date ?? null,
    set: (r, v) =>
      (r.previousAssessment = {
        result: null,
        level: null,
        ...r.previousAssessment,
        date: v as string | null,
      }),
  },
  'promotionRequest.attached': {
    label: 'Czy dołączono wniosek o przyznanie kolejnego stopnia służbowego',
    section: 'Część II',
    kind: 'ATTACHED',
    urzednikOnly: true,
    get: (r) => r.promotionRequest.attached,
    set: (r, v) => (r.promotionRequest.attached = v as 'YES' | 'NO' | null),
  },
  'promotionRequest.appointedYear': {
    label: 'Rok mianowania',
    section: 'Część III',
    kind: 'YEAR',
    urzednikOnly: true,
    get: (r) => r.promotionRequest.appointedYear,
    set: (r, v) => (r.promotionRequest.appointedYear = v as number | null),
  },
  'promotionRequest.currentGrade': {
    label: 'Posiadany stopień służbowy',
    section: 'Część III',
    kind: 'GRADE',
    urzednikOnly: true,
    get: (r) => r.promotionRequest.currentGrade,
    set: (r, v) => {
      r.promotionRequest.currentGrade = v as string | null;
      // The requested grade is always the next one (art. 89 ust. 1 ustawy).
      r.promotionRequest.requestedGrade = v ? nextGrade(v as string) : null;
    },
  },
  'promotionRequest.gradeGrantedOn': {
    label: 'Data przyznania stopnia służbowego',
    section: 'Część III',
    kind: 'DATE',
    urzednikOnly: true,
    get: (r) => r.promotionRequest.gradeGrantedOn,
    set: (r, v) => (r.promotionRequest.gradeGrantedOn = v as string | null),
  },
  'promotionRequest.motivation': {
    label: 'Umotywowanie wniosku',
    section: 'Część III',
    kind: 'TEXT',
    urzednikOnly: true,
    get: (r) => r.promotionRequest.motivation,
    set: (r, v) => (r.promotionRequest.motivation = v as string),
  },
  signedByEvaluatorOn: {
    label: 'Data dokonania oceny (podpis oceniającego)',
    section: 'Część II',
    kind: 'DATE',
    get: (r) => r.signedByEvaluatorOn,
    set: (r, v) => (r.signedByEvaluatorOn = v as string | null),
  },
  acknowledgedOn: {
    label: 'Data zapoznania ocenianego z oceną',
    section: 'Część II',
    kind: 'DATE',
    stage: 'ACKNOWLEDGEMENT',
    get: (r) => r.acknowledgedOn,
    set: (r, v) => (r.acknowledgedOn = v as string | null),
  },
};

const RESULT_PL: Record<string, string> = {
  POSITIVE: 'pozytywna',
  NEGATIVE: 'negatywna',
};
const ATTACHED_PL: Record<string, string> = {
  YES: 'TAK',
  NO: 'NIE',
  NOT_APPLICABLE: 'NIE DOTYCZY',
};

function scoreField(criterionId: string): FieldDef {
  return {
    label: `Ocena cząstkowa: ${criterionName(criterionId)}`,
    section: 'Część II',
    kind: 'SCORE',
    get: (r) => r.decisions[criterionId] ?? null,
    set: (r, v) => {
      if (v === null) delete r.decisions[criterionId];
      else r.decisions[criterionId] = v as number;
    },
  };
}

function fieldDef(record: CaseRecord, field: string): FieldDef | null {
  if (field.startsWith('decisions.')) {
    const id = field.slice('decisions.'.length);
    return caseCriteria(record).includes(id) ? scoreField(id) : null;
  }
  const def = FIELDS[field];
  if (!def) return null;
  if (def.urzednikOnly && record.person.employment !== 'URZEDNIK') return null;
  return def;
}

function optionsOf(record: CaseRecord, kind: CorrectionKind) {
  switch (kind) {
    case 'SCORE':
      return sheetOf(record)?.scale ?? [];
    case 'RESULT':
      return ['POSITIVE', 'NEGATIVE'];
    case 'LEVEL':
      return previousLevelLabels();
    case 'ATTACHED':
      return ['YES', 'NO'];
    case 'GRADE':
      return GRADE_IDS;
    default:
      return undefined;
  }
}

/** A value as the sheet writes it, for the audit trail and the UI. */
export function displayValue(kind: CorrectionKind, value: unknown): string {
  if (value === null || value === undefined || value === '') return '(puste)';
  switch (kind) {
    case 'DATE':
      return formatDatePl(value as string);
    case 'SCORE':
      return `${value as number} pkt`;
    case 'CRITERIA': {
      const list = value as string[];
      return list.length ? list.map(criterionName).join(', ') : '(brak)';
    }
    case 'RESULT':
      return RESULT_PL[value as string] ?? (value as string);
    case 'ATTACHED':
      return ATTACHED_PL[value as string] ?? (value as string);
    case 'GRADE':
      return `${value as string} stopień służbowy`;
    case 'TEXT': {
      const text = value as string;
      return text.length > 120 ? `${text.slice(0, 117)}…` : text;
    }
    default:
      return typeof value === 'object'
        ? JSON.stringify(value)
        : String(value as string | number);
  }
}

/** Every field the administrator can correct in this case, with its value. */
export function correctableFields(record: CaseRecord): CorrectableField[] {
  const fields = [
    ...Object.keys(FIELDS),
    ...caseCriteria(record).map((id) => `decisions.${id}`),
  ];
  return fields.flatMap((field) => {
    const def = fieldDef(record, field);
    if (!def) return [];
    const value = def.get(record);
    const options = optionsOf(record, def.kind);
    return [
      {
        field,
        label: def.label,
        section: def.section,
        kind: def.kind,
        ...(options ? { options } : {}),
        value,
        display: displayValue(def.kind, value),
      },
    ];
  });
}

/** Validates the new value of `def`; returns it normalised (pushes errors). */
function validateValue(
  record: CaseRecord,
  def: FieldDef,
  raw: unknown,
  today: string,
  errors: string[],
): unknown {
  const value = raw === '' && def.kind !== 'TEXT' ? null : raw;
  const options = optionsOf(record, def.kind);
  switch (def.kind) {
    case 'DATE': {
      if (value === null) return null;
      if (typeof value !== 'string' || !isIsoDate(value)) {
        errors.push('Data musi mieć format RRRR-MM-DD.');
        return null;
      }
      if (value > today && def !== FIELDS['partI.assessmentDue']) {
        errors.push(`„${def.label}” nie może być datą z przyszłości.`);
      }
      return value;
    }
    case 'TEXT':
      if (typeof value !== 'string') {
        errors.push(`„${def.label}” musi być tekstem.`);
        return '';
      }
      if (value.length > TEXT_MAX) {
        errors.push(`„${def.label}” może mieć najwyżej ${TEXT_MAX} znaków.`);
      }
      return value;
    case 'YEAR': {
      if (value === null) return null;
      const year = Number(value);
      const max = Number(today.slice(0, 4));
      if (
        !Number.isInteger(year) ||
        year < FIRST_APPOINTMENT_YEAR ||
        year > max
      ) {
        errors.push(
          `Rok mianowania musi być rokiem od ${FIRST_APPOINTMENT_YEAR} do ${max}.`,
        );
      }
      return year;
    }
    case 'CRITERIA': {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        errors.push('Kryteria dodatkowe podaj jako listę identyfikatorów.');
        return [];
      }
      const list = value as string[];
      if (list.length > 3) {
        errors.push(
          'Można wybrać najwyżej 3 kryteria dodatkowe (§2 ust. 2 rozp. 2016).',
        );
      }
      const mandatory = sheetOf(record)?.mandatoryCriteria ?? [];
      const seen = new Set<string>();
      for (const id of list) {
        if (!findCriterion(id)) errors.push(`Nieznane kryterium „${id}”.`);
        else if (seen.has(id))
          errors.push(
            `Kryterium „${criterionName(id)}” podano więcej niż raz.`,
          );
        else if (mandatory.includes(id))
          errors.push(
            `Kryterium „${criterionName(id)}” jest obowiązkowe w tym arkuszu, więc nie może być kryterium dodatkowym.`,
          );
        seen.add(id);
      }
      return list;
    }
    default: {
      if (value === null) return null;
      if (!options?.includes(value as never)) {
        errors.push(
          `„${def.label}” musi mieć jedną z wartości: ${(options ?? []).join(', ')}.`,
        );
      }
      if (
        def.kind === 'ATTACHED' &&
        value === 'YES' &&
        computeEvaluation(record)?.result === 'NEGATIVE'
      ) {
        errors.push(
          'Wniosku o kolejny stopień nie dołącza się do oceny negatywnej (§11 ust. 5 rozp. 2016).',
        );
      }
      return value;
    }
  }
}

/**
 * Applies one administrator correction: validates the field and value, sets
 * it, keeps derived data in sync (stage completion dates, criteria scores,
 * the requested grade) and appends the audit entry and a history line.
 * Unknown field / bad value -> CaseValidationError (400); a field that is not
 * locked yet -> CaseRuleError (409): the evaluator edits it in the normal way.
 */
export function applyCorrection(
  record: CaseRecord,
  input: CorrectionInput,
  meta: { id: string; at: string; today: string; by: Correction['by'] },
): { record: CaseRecord; correction: Correction } {
  const errors: string[] = [];
  const reason = input.reason.trim();
  if (reason.length < MIN_REASON_LENGTH) {
    errors.push(
      `Podaj powód korekty (co najmniej ${MIN_REASON_LENGTH} znaków): trafia do historii sprawy.`,
    );
  }
  const def = fieldDef(record, input.field);
  if (!def) {
    throw new CaseValidationError([
      `Pola „${input.field}” nie można korygować w tej sprawie. Dostępne pola: ${correctableFields(
        record,
      )
        .map((f) => f.field)
        .join(', ')}.`,
    ]);
  }
  if (!isLocked(record, def)) {
    throw new CaseRuleError(
      `Pole „${def.label}” nie jest jeszcze zablokowane: zmienia je oceniający w teczce. Tryb korekty dotyczy pól zablokowanych po potwierdzeniu.`,
    );
  }
  const value = validateValue(record, def, input.value, meta.today, errors);
  if (errors.length > 0) throw new CaseValidationError(errors);

  const oldValue = displayValue(def.kind, def.get(record));
  const newValue = displayValue(def.kind, value);
  if (
    oldValue === newValue &&
    JSON.stringify(def.get(record)) === JSON.stringify(value)
  ) {
    throw new CaseValidationError([
      `Nowa wartość pola „${def.label}” jest taka sama jak obecna.`,
    ]);
  }

  const next = structuredClone(record);
  def.set(next, value);
  if (def.stage && next.completedOn[def.stage] && typeof value === 'string') {
    next.completedOn[def.stage] = value;
  }
  if (def.kind === 'CRITERIA') {
    const criteria = new Set(caseCriteria(next));
    for (const map of [next.decisions, next.deviationNotes]) {
      for (const id of Object.keys(map)) if (!criteria.has(id)) delete map[id];
    }
  }

  const correction: Correction = {
    id: meta.id,
    at: meta.at,
    date: meta.today,
    by: meta.by,
    field: input.field,
    label: def.label,
    section: def.section,
    oldValue,
    newValue,
    reason,
  };
  next.corrections = [...(record.corrections ?? []), correction];
  next.history.push({
    date: meta.today,
    text: `Korekta błędu przez administratora (${meta.by.name}): ${sectionInSentence(def.section)}, pole „${def.label}”. Powód: ${reason}`,
  });
  return { record: next, correction };
}

/** "Część II" inside a sentence: "część II" (the Roman numeral stays upper case). */
export function sectionInSentence(section: string): string {
  return section.charAt(0).toLocaleLowerCase('pl-PL') + section.slice(1);
}

/**
 * Whether the field is locked for the evaluator (schemat pól formularza):
 * part I after the evaluator confirms the opening talk, part II and III after
 * the evaluator signs the assessment, every date once it was set by a
 * confirmation.
 */
function isLocked(record: CaseRecord, def: FieldDef): boolean {
  if (def.kind === 'DATE' && def.get(record) && def.stage) return true;
  if (def === FIELDS.signedByEvaluatorOn) return !!record.signedByEvaluatorOn;
  if (def.section === 'Część I') return !!record.partI.confirmedByEvaluatorOn;
  return !!record.signedByEvaluatorOn || !!record.acknowledgedOn;
}

/** Why each part is locked now (Polish), or null when it is still editable. */
export function caseLocks(record: CaseRecord): {
  partI: string | null;
  partII: string | null;
} {
  const note =
    'Zmiana możliwa wyłącznie w trybie korekty błędów przez administratora.';
  return {
    partI: record.partI.confirmedByEvaluatorOn
      ? `Część I zablokowana po potwierdzeniu rozmowy rozpoczynającej ${formatDatePl(record.partI.confirmedByEvaluatorOn)}. ${note}`
      : null,
    partII: record.signedByEvaluatorOn
      ? `Część II i III zablokowane po podpisaniu oceny ${formatDatePl(record.signedByEvaluatorOn)}. ${note}`
      : null,
  };
}
