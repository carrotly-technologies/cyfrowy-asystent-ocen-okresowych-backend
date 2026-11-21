/**
 * Calendar arithmetic on ISO dates (`YYYY-MM-DD`), in UTC so that time zones
 * never move a date. Term rules follow art. 110–115 KC, which apply to the
 * civil service through art. 9 ust. 1 ustawy and art. 300 KP
 * (notatki/procedury-i-terminy.md, section 2).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && toIso(date) === value;
}

function toDate(iso: string): Date {
  if (!isIsoDate(iso)) throw new Error(`Invalid ISO date: ${iso}`);
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/**
 * R2: a term in months ends on the day whose date matches the start day; when
 * the month has no such day, on its last day (31.01 + 1 month = 29.02 in 2024).
 */
export function addMonths(iso: string, months: number): string {
  const date = toDate(iso);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toIso(new Date(Date.UTC(year, month, Math.min(day, lastDay))));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}

/** "2026-12-04" -> "04.12.2026" */
export function formatDatePl(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Easter Sunday (anonymous Gregorian algorithm). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Public holidays in Poland (ustawa o dniach wolnych od pracy). */
export function polishHolidays(year: number): Set<string> {
  const fixed = [
    '01-01',
    '01-06',
    '05-01',
    '05-03',
    '08-15',
    '11-01',
    '11-11',
    '12-25',
    '12-26',
  ];
  // Wigilia is a public holiday since 2025.
  if (year >= 2025) fixed.push('12-24');
  const easter = easterSunday(year);
  return new Set([
    ...fixed.map((md) => `${year}-${md}`),
    easter,
    addDays(easter, 1), // Poniedziałek Wielkanocny
    addDays(easter, 49), // Zielone Świątki
    addDays(easter, 60), // Boże Ciało
  ]);
}

export function isNonWorkingDay(iso: string): boolean {
  const weekday = toDate(iso).getUTCDay();
  if (weekday === 0 || weekday === 6) return true;
  return polishHolidays(Number(iso.slice(0, 4))).has(iso);
}

/**
 * R3: a term ending on a Sunday, a public holiday or a Saturday ends on the
 * next working day (art. 115 KC; Saturday as in "liczenie terminów.docx").
 */
export function shiftToWorkingDay(iso: string): string {
  let date = iso;
  while (isNonWorkingDay(date)) date = addDays(date, 1);
  return date;
}

/** R1: a term of `days` days; the day of the event is not counted. */
export function daysTermEnd(start: string, days: number): string {
  return addDays(start, days);
}

/** R2: a term of `months` months. */
export function monthsTermEnd(start: string, months: number): string {
  return addMonths(start, months);
}
