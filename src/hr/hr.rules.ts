import type { CaseStatus } from '../cases/case.types.js';

/**
 * Statuses with nothing for the evaluator to do: a finished assessment and an
 * objection under review by the director general (art. 83 ust. 2 ustawy). A
 * reminder to the evaluator makes no sense there.
 */
export const NO_REMINDER_STATUSES: readonly CaseStatus[] = [
  'ZAKONCZONA',
  'SPRZECIW_W_ROZPATRZENIU',
];

export function canRemind(status: CaseStatus): boolean {
  return !NO_REMINDER_STATUSES.includes(status);
}

const STATUS_TEXT: Record<CaseStatus, string> = {
  W_TOKU: 'ocena w toku',
  DO_ZAPOZNANIA: 'do zapoznania',
  OKRES_SPRZECIWU: 'okres sprzeciwu',
  SPRZECIW_W_ROZPATRZENIU: 'sprzeciw w rozpatrzeniu',
  ZAKONCZONA: 'ocena zakończona',
};

export function statusText(status: CaseStatus): string {
  return STATUS_TEXT[status];
}
