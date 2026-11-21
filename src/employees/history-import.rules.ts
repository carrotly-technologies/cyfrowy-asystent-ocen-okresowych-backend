import { isIsoDate } from '../cases/dates.js';
import { previousLevelLabels } from '../cases/promotion.rules.js';

/**
 * CSV import of assessments made before the system ("wprowadza oceny
 * historyczne"). Columns (header required, `;` or `,`, UTF-8):
 *   pracownik;data_sporzadzenia;ocena;poziom[;data_zapoznania]
 * - pracownik: employee id from the register or "Imię Nazwisko" (unique);
 * - data_sporzadzenia, data_zapoznania: RRRR-MM-DD or DD.MM.RRRR;
 * - ocena: pozytywna / negatywna;
 * - poziom: a level of the scale ("powyżej oczekiwań"), may be empty.
 * Sample: docs/import/oceny-historyczne-przyklad.csv.
 */

export interface ParsedHistoryRow {
  line: number;
  employeeId: string;
  assessedOn: string;
  acknowledgedOn: string | null;
  result: 'POSITIVE' | 'NEGATIVE';
  level: string | null;
}

export interface ImportError {
  line: number;
  message: string;
}

const REQUIRED = ['pracownik', 'data_sporzadzenia', 'ocena', 'poziom'] as const;

export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLocaleLowerCase('pl-PL')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/\s+/g, '_');
}

/** Splits one CSV line; supports "quoted; values" and "" escapes. */
export function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

export function parseDate(value: string): string | null {
  const pl = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  const iso = pl ? `${pl[3]}-${pl[2]}-${pl[1]}` : value;
  return isIsoDate(iso) ? iso : null;
}

/**
 * Parses and validates the whole file; `resolve` maps the "pracownik" cell
 * to an employee id (or an error message). Returns rows and errors per line.
 */
export function parseHistoryCsv(
  text: string,
  resolve: (cell: string) => { id: string } | { error: string },
  today: string,
): { rows: ParsedHistoryRow[]; errors: ImportError[] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => l.trim() !== '');
  if (headerIndex < 0) {
    return { rows: [], errors: [{ line: 1, message: 'Plik jest pusty.' }] };
  }
  const headerLine = lines[headerIndex];
  const sep = headerLine.includes(';') ? ';' : ',';
  const header = splitLine(headerLine, sep).map(normalizeHeader);
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: headerIndex + 1,
          message: `Brak kolumn: ${missing.join(', ')}. Wymagany nagłówek: pracownik;data_sporzadzenia;ocena;poziom (opcjonalnie ;data_zapoznania).`,
        },
      ],
    };
  }
  const col = (cells: string[], name: string) =>
    cells[header.indexOf(name)] ?? '';
  const levels = previousLevelLabels();
  const rows: ParsedHistoryRow[] = [];
  const errors: ImportError[] = [];

  lines.slice(headerIndex + 1).forEach((raw, i) => {
    const line = headerIndex + 2 + i;
    if (raw.trim() === '') return;
    const cells = splitLine(raw, sep);
    const problems: string[] = [];

    const who = resolve(col(cells, 'pracownik'));
    if ('error' in who) problems.push(who.error);

    const assessedOn = parseDate(col(cells, 'data_sporzadzenia'));
    if (!assessedOn)
      problems.push(
        'data sporządzenia musi mieć format RRRR-MM-DD lub DD.MM.RRRR',
      );
    else if (assessedOn > today)
      problems.push('data sporządzenia nie może być z przyszłości');

    const ackCell = header.includes('data_zapoznania')
      ? col(cells, 'data_zapoznania')
      : '';
    const acknowledgedOn = ackCell ? parseDate(ackCell) : null;
    if (ackCell && !acknowledgedOn)
      problems.push(
        'data zapoznania musi mieć format RRRR-MM-DD lub DD.MM.RRRR',
      );
    if (acknowledgedOn && assessedOn && acknowledgedOn < assessedOn)
      problems.push('data zapoznania jest wcześniejsza niż data sporządzenia');

    const resultCell = col(cells, 'ocena').toLocaleLowerCase('pl-PL');
    const result =
      resultCell === 'pozytywna'
        ? 'POSITIVE'
        : resultCell === 'negatywna'
          ? 'NEGATIVE'
          : null;
    if (!result)
      problems.push('ocena musi mieć wartość „pozytywna” albo „negatywna”');

    const levelCell = col(cells, 'poziom').toLocaleLowerCase('pl-PL');
    const level = levelCell === '' ? null : levelCell;
    if (level && !levels.includes(level))
      problems.push(
        `poziom wybierz ze skali: ${levels.map((l) => `„${l}”`).join(', ')}`,
      );

    if (problems.length > 0) {
      errors.push({ line, message: `Wiersz ${line}: ${problems.join('; ')}.` });
      return;
    }
    rows.push({
      line,
      employeeId: (who as { id: string }).id,
      assessedOn: assessedOn!,
      acknowledgedOn,
      result: result!,
      level,
    });
  });
  if (rows.length === 0 && errors.length === 0) {
    errors.push({
      line: headerIndex + 2,
      message: 'Plik nie zawiera żadnych ocen.',
    });
  }
  return { rows, errors };
}
