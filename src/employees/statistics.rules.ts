import { STAGES, type StageId } from '../cases/case.types.js';
import { STAGE_NAMES } from '../cases/case.rules.js';
import { previousLevelLabels } from '../cases/promotion.rules.js';

/** What the statistics need from one assessment case. */
export interface CaseFact {
  unit: string;
  stage: StageId;
  /** Assessment finished (acknowledged) or at least signed. */
  signedOn: string | null;
  finished: boolean;
  result: 'POSITIVE' | 'NEGATIVE' | null;
  level: string | null;
  /** Assessment due date (with absence extensions). */
  dueOn: string | null;
  /** Current deadline already passed (open cases). */
  overdue: boolean;
  promotionRequested: boolean;
}

export interface ImportedFact {
  unit: string;
  result: 'POSITIVE' | 'NEGATIVE';
  level: string | null;
}

export interface EmployeeFact {
  unit: string;
  obligatoryPromotion: boolean;
}

export interface UnitStatistics {
  unit: string;
  employees: number;
  openCases: number;
  positive: number;
  negative: number;
  overdue: number;
}

export interface Statistics {
  employees: number;
  cases: { total: number; open: number; finished: number };
  results: { positive: number; negative: number; negativePercent: number };
  levels: { label: string; count: number }[];
  timeliness: {
    signedOnTime: number;
    signedLate: number;
    openOverdue: number;
    openOnTrack: number;
  };
  stages: { stageId: StageId; name: string; count: number }[];
  promotions: { requested: number; obligatory: number };
  units: UnitStatistics[];
  sources: string;
}

const percent = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;

/**
 * Aggregates for HR and the head of the office. Results and levels count
 * signed assessments of the system and imported historical ones; timeliness
 * compares the signature with the due date (art. 81 ust. 4 and 7 ustawy).
 */
export function computeStatistics(
  cases: readonly CaseFact[],
  imported: readonly ImportedFact[],
  employees: readonly EmployeeFact[],
): Statistics {
  const assessed = [
    ...cases.filter((c) => c.signedOn && c.result),
    ...imported,
  ] as {
    unit: string;
    result: 'POSITIVE' | 'NEGATIVE';
    level: string | null;
  }[];
  const positive = assessed.filter((a) => a.result === 'POSITIVE').length;
  const negative = assessed.length - positive;

  const levelLabels = previousLevelLabels();
  const levels = levelLabels.map((label) => ({
    label,
    count: assessed.filter((a) => a.level?.toLocaleLowerCase('pl-PL') === label)
      .length,
  }));

  const open = cases.filter((c) => !c.finished);
  const signed = cases.filter((c) => c.signedOn);
  const signedOnTime = signed.filter(
    (c) => !c.dueOn || c.signedOn! <= c.dueOn,
  ).length;

  const units = [
    ...new Set([...employees.map((e) => e.unit), ...cases.map((c) => c.unit)]),
  ]
    .sort((a, b) => a.localeCompare(b, 'pl'))
    .map((unit) => {
      const inUnit = assessed.filter((a) => a.unit === unit);
      return {
        unit,
        employees: employees.filter((e) => e.unit === unit).length,
        openCases: open.filter((c) => c.unit === unit).length,
        positive: inUnit.filter((a) => a.result === 'POSITIVE').length,
        negative: inUnit.filter((a) => a.result === 'NEGATIVE').length,
        overdue: open.filter((c) => c.unit === unit && c.overdue).length,
      };
    });

  return {
    employees: employees.length,
    cases: {
      total: cases.length,
      open: open.length,
      finished: cases.length - open.length,
    },
    results: {
      positive,
      negative,
      negativePercent: percent(negative, assessed.length),
    },
    levels,
    timeliness: {
      signedOnTime,
      signedLate: signed.length - signedOnTime,
      openOverdue: open.filter((c) => c.overdue).length,
      openOnTrack: open.filter((c) => !c.overdue).length,
    },
    stages: STAGES.map((stageId) => ({
      stageId,
      name: STAGE_NAMES[stageId],
      count: open.filter((c) => c.stage === stageId).length,
    })),
    promotions: {
      requested: cases.filter((c) => c.promotionRequested).length,
      obligatory: employees.filter((e) => e.obligatoryPromotion).length,
    },
    units,
    sources:
      'Wyniki i poziomy: oceny podpisane w systemie i oceny historyczne z importu. Terminowość: data podpisu oceny wobec terminu sporządzenia oceny (art. 81 ust. 4 i 7 ustawy o służbie cywilnej).',
  };
}

function csvCell(value: string | number): string {
  // numbers with a decimal comma (11,1), as Polish spreadsheets expect
  const text =
    typeof value === 'number' ? String(value).replace('.', ',') : value;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV for Polish Excel/LibreOffice: `;` between fields, decimal comma in numbers, UTF-8 with BOM, CRLF lines.
 */
export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
  return `﻿${rows.map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`;
}

/** The statistics as a CSV report (pobieranie/archiwizacja danych). */
export function statisticsCsv(stats: Statistics, today: string): string {
  return toCsv([
    ['Statystyki ocen okresowych', today],
    [],
    ['Wskaźnik', 'Wartość'],
    ['Pracownicy w kartotece', stats.employees],
    ['Teczki ocen: wszystkie', stats.cases.total],
    ['Teczki ocen: w toku', stats.cases.open],
    ['Teczki ocen: zakończone', stats.cases.finished],
    ['Oceny pozytywne', stats.results.positive],
    ['Oceny negatywne', stats.results.negative],
    ['Odsetek ocen negatywnych (%)', stats.results.negativePercent],
    ['Podpisane w terminie', stats.timeliness.signedOnTime],
    ['Podpisane po terminie', stats.timeliness.signedLate],
    ['W toku po terminie', stats.timeliness.openOverdue],
    ['W toku w terminie', stats.timeliness.openOnTrack],
    ['Wnioski o kolejny stopień', stats.promotions.requested],
    [
      'Obowiązkowy kolejny stopień (art. 89 ust. 2)',
      stats.promotions.obligatory,
    ],
    [],
    ['Poziom', 'Liczba ocen'],
    ...stats.levels.map((l) => [l.label, l.count]),
    [],
    ['Etap', 'Teczki w toku'],
    ...stats.stages.map((s) => [s.name, s.count]),
    [],
    [
      'Komórka',
      'Pracownicy',
      'Teczki w toku',
      'Pozytywne',
      'Negatywne',
      'Po terminie',
    ],
    ...stats.units.map((u) => [
      u.unit,
      u.employees,
      u.openCases,
      u.positive,
      u.negative,
      u.overdue,
    ]),
  ]);
}
