import {
  GRADE_IDS,
  type GradeId,
} from '../civil-service-grades/data/grades.data.js';
import type { EmployeeFields } from './employees.types.js';
import {
  type ImportError,
  normalizeHeader,
  parseDate,
  splitLine,
} from './history-import.rules.js';
import { normalizeUnit } from './employees.rules.js';

/**
 * CSV import of the HR register (lista pracowników z systemu kadrowego).
 * Header required, `;` (or `,`), UTF-8. Columns, in any order:
 *   identyfikator (opcjonalnie) — the HR system id, kept as the register id;
 *   imie; nazwisko; komorka; stanowisko — required;
 *   kierownik_urzedu; kieruje_ludzmi; urzednik_mianowany — tak / nie;
 *   rok_mianowania; stopien (I–IX); data_nadania_stopnia (opcjonalnie);
 *   data_zatrudnienia_na_czas_nieokreslony — RRRR-MM-DD or DD.MM.RRRR;
 *   oceniajacy — login of the evaluator's account or "Imię Nazwisko".
 * Empty optional cells mean "nie" / no value. A bad row is reported with its
 * line number and does not stop the other rows.
 * Sample: docs/import/pracownicy-wzor.csv.
 */

export type ImportedEmployeeFields = Omit<
  EmployeeFields,
  'evaluatorId' | 'unit'
> & { unit: string; evaluatorId: string | null };

export interface ParsedEmployeeRow {
  line: number;
  /** identyfikator kadrowy, or null to match by name and unit. */
  externalId: string | null;
  fields: ImportedEmployeeFields;
}

export interface EmployeesCsvResult {
  rows: ParsedEmployeeRow[];
  errors: ImportError[];
  /** The whole file is unusable (no header, missing columns). */
  fatal: string | null;
}

export const EMPLOYEE_IMPORT_COLUMNS = [
  'identyfikator',
  'imie',
  'nazwisko',
  'komorka',
  'stanowisko',
  'kierownik_urzedu',
  'kieruje_ludzmi',
  'urzednik_mianowany',
  'rok_mianowania',
  'stopien',
  'data_nadania_stopnia',
  'data_zatrudnienia_na_czas_nieokreslony',
  'oceniajacy',
] as const;
type Column = (typeof EMPLOYEE_IMPORT_COLUMNS)[number];

const REQUIRED: readonly Column[] = [
  'imie',
  'nazwisko',
  'komorka',
  'stanowisko',
];

/** Other spellings HR systems use for the same column. */
const ALIASES: Record<string, Column> = {
  identyfikator_kadrowy: 'identyfikator',
  id: 'identyfikator',
  komorka_organizacyjna: 'komorka',
  kieruje_pracownikami: 'kieruje_ludzmi',
  stopien_sluzbowy: 'stopien',
  oceniajacy_login: 'oceniajacy',
};

const ROMAN: Record<string, GradeId> = Object.fromEntries(
  GRADE_IDS.map((id, i) => [String(i + 1), id]),
) as Record<string, GradeId>;

const EXTERNAL_ID = /^[\p{L}\d._-]{1,64}$/u;

function parseFlag(value: string): boolean | null {
  const v = value.trim().toLocaleLowerCase('pl-PL');
  if (['', 'nie', 'n', '0', 'false'].includes(v)) return false;
  if (['tak', 't', '1', 'x', 'true'].includes(v)) return true;
  return null;
}

function parseGrade(value: string): GradeId | null {
  const v = value
    .trim()
    .toUpperCase()
    .replace(/\s*STOPIE(Ń|N)( SŁUŻBOWY| SLUZBOWY)?$/u, '');
  if ((GRADE_IDS as readonly string[]).includes(v)) return v as GradeId;
  return ROMAN[v] ?? null;
}

/**
 * Parses and validates the file; `resolveEvaluator` maps the "oceniajacy"
 * cell to an evaluator id (or an error message). `today` bounds the dates.
 */
export function parseEmployeesCsv(
  text: string,
  resolveEvaluator: (cell: string) => { id: string } | { error: string },
  today: string,
): EmployeesCsvResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => l.trim() !== '');
  if (headerIndex < 0)
    return { rows: [], errors: [], fatal: 'Plik CSV jest pusty.' };
  const headerLine = lines[headerIndex];
  const sep = headerLine.includes(';') ? ';' : ',';
  const header = splitLine(headerLine, sep)
    .map(normalizeHeader)
    .map((h) => ALIASES[h] ?? h);
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0)
    return {
      rows: [],
      errors: [],
      fatal: `Wiersz ${headerIndex + 1}: brak kolumn ${missing.join(', ')}. Pobierz wzór CSV i zachowaj jego nagłówek.`,
    };
  const col = (cells: string[], name: Column) => {
    const i = header.indexOf(name);
    return i < 0 ? '' : (cells[i] ?? '').trim();
  };

  const rows: ParsedEmployeeRow[] = [];
  const errors: ImportError[] = [];
  lines.slice(headerIndex + 1).forEach((raw, i) => {
    const line = headerIndex + 2 + i;
    if (raw.trim() === '' || /^[;,\s]*$/.test(raw)) return;
    const cells = splitLine(raw, sep);
    const problems: string[] = [];

    const textCell = (name: Column, label: string, max: number) => {
      const v = col(cells, name).replace(/\s+/g, ' ');
      if (!v) problems.push(`brak pola „${label}”`);
      else if (v.length > max)
        problems.push(`pole „${label}” może mieć najwyżej ${max} znaków`);
      return v;
    };
    const firstName = textCell('imie', 'imię', 100);
    const lastName = textCell('nazwisko', 'nazwisko', 100);
    const unit = normalizeUnit(textCell('komorka', 'komórka', 200));
    const position = textCell('stanowisko', 'stanowisko', 200);

    const flag = (name: Column, label: string) => {
      const v = parseFlag(col(cells, name));
      if (v === null) problems.push(`„${label}”: wpisz tak albo nie`);
      return v ?? false;
    };
    const officeHead = flag('kierownik_urzedu', 'kierownik urzędu');
    const managesPeople = flag('kieruje_ludzmi', 'kieruje ludźmi');
    const appointed = flag('urzednik_mianowany', 'urzędnik mianowany');

    const yearCell = col(cells, 'rok_mianowania');
    let appointedYear: number | null = null;
    if (yearCell) {
      appointedYear = /^\d{4}$/.test(yearCell) ? Number(yearCell) : NaN;
      if (
        Number.isNaN(appointedYear) ||
        appointedYear < 1990 ||
        appointedYear > Number(today.slice(0, 4))
      ) {
        problems.push(
          `rok mianowania musi być rokiem od 1990 do ${today.slice(0, 4)}`,
        );
        appointedYear = null;
      }
    }

    const gradeCell = col(cells, 'stopien');
    const grade = gradeCell ? parseGrade(gradeCell) : null;
    if (gradeCell && !grade)
      problems.push('stopień służbowy wpisz jako I–IX (np. II)');

    const date = (name: Column, label: string) => {
      const cell = col(cells, name);
      if (!cell) return null;
      const d = parseDate(cell);
      if (!d)
        problems.push(`${label} musi mieć format RRRR-MM-DD lub DD.MM.RRRR`);
      else if (d > today) problems.push(`${label} nie może być z przyszłości`);
      return d;
    };
    const gradeGrantedOn = date('data_nadania_stopnia', 'data nadania stopnia');
    const indefiniteSince = date(
      'data_zatrudnienia_na_czas_nieokreslony',
      'data zatrudnienia na czas nieokreślony',
    );

    if (!appointed && (yearCell || gradeCell || gradeGrantedOn))
      problems.push(
        'rok mianowania i stopień wpisuje się tylko urzędnikowi mianowanemu (kolumna „urzędnik mianowany”: tak)',
      );

    const evaluatorCell = col(cells, 'oceniajacy');
    let evaluatorId: string | null = null;
    if (evaluatorCell) {
      const who = resolveEvaluator(evaluatorCell);
      if ('error' in who) problems.push(who.error);
      else evaluatorId = who.id;
    }

    const idCell = col(cells, 'identyfikator');
    if (idCell && !EXTERNAL_ID.test(idCell))
      problems.push(
        'identyfikator może mieć do 64 znaków: litery, cyfry, kropka, myślnik, podkreślnik',
      );

    if (problems.length > 0) {
      errors.push({ line, message: `Wiersz ${line}: ${problems.join('; ')}.` });
      return;
    }
    rows.push({
      line,
      externalId: idCell || null,
      fields: {
        firstName,
        lastName,
        unit,
        position,
        employment: appointed ? 'URZEDNIK' : 'PRACOWNIK',
        officeHead,
        managesPeople,
        appointedYear,
        grade,
        gradeGrantedOn,
        indefiniteSince,
        evaluatorId,
      },
    });
  });
  if (rows.length === 0 && errors.length === 0)
    return {
      rows,
      errors,
      fatal: 'Plik nie zawiera żadnych pracowników (tylko nagłówek).',
    };
  return { rows, errors, fatal: null };
}

/** Key of a person without an identyfikator: first and last name and unit. */
export function employeeKey(e: {
  firstName: string;
  lastName: string;
  unit: string;
}): string {
  return [e.firstName, e.lastName, normalizeUnit(e.unit)]
    .map((v) => v.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl-PL'))
    .join('|');
}
