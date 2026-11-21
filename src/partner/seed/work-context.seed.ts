import { addDays } from '../../cases/dates.js';
import type { WorkContext } from '../signals.rules.js';

const SOURCE =
  'Dane demonstracyjne. We wdrożeniu: system kadrowy i EZD urzędu przez API (opcjonalnie).';

/**
 * Demo work data per person (fictional): tasks, changes of duties and
 * absences (length only, never their reason). In an office this comes from
 * its HR system / EZD through a documented API.
 */
export function buildWorkContextSeed(
  today: string,
): Record<string, WorkContext> {
  const d = (days: number) => addDays(today, days);
  const ctx = (c: Omit<WorkContext, 'source'>): WorkContext => ({
    ...c,
    source: SOURCE,
  });
  return {
    'p-nowak': ctx({
      openTasks: 7,
      overdueTasks: 0,
      scopeChanges: [],
      absences: [],
    }),
    'p-wojcik': ctx({
      openTasks: 14,
      overdueTasks: 2,
      scopeChanges: [
        {
          date: d(-20),
          text: 'przejęcie spraw kolegi z wydziału na czas jego długiej nieobecności',
        },
      ],
      absences: [],
    }),
    'p-lewandowski': ctx({
      openTasks: 18,
      overdueTasks: 4,
      scopeChanges: [
        {
          date: d(-40),
          text: 'dodatkowo koordynacja projektu współpracy z partnerami unijnymi',
        },
      ],
      absences: [{ from: d(-30), to: d(-19) }],
    }),
    'p-mazur': ctx({
      openTasks: 5,
      overdueTasks: 0,
      scopeChanges: [],
      absences: [],
    }),
    'p-szymanski': ctx({
      openTasks: 9,
      overdueTasks: 1,
      scopeChanges: [],
      absences: [],
    }),
    'p-dabrowska': ctx({
      openTasks: 8,
      overdueTasks: 0,
      scopeChanges: [],
      absences: [],
    }),
    'p-zielinska': ctx({
      openTasks: 6,
      overdueTasks: 0,
      scopeChanges: [],
      absences: [],
    }),
    'p-kowalczyk': ctx({
      openTasks: 21,
      overdueTasks: 3,
      scopeChanges: [],
      absences: [],
    }),
    'p-wieczorek': ctx({
      openTasks: 6,
      overdueTasks: 0,
      scopeChanges: [],
      absences: [],
    }),
    'p-krawczyk': ctx({
      openTasks: 6,
      overdueTasks: 1,
      scopeChanges: [],
      absences: [],
    }),
  };
}
