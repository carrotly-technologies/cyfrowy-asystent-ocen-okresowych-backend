import { addDays } from '../../cases/dates.js';
import { PULSE_INTERVAL_DAYS } from '../data/pulse.data.js';
import type { PulseAnswers, PulseResponse } from '../pulse.types.js';

type Row = [number, number, number, number, number];
const answers = ([
  workload,
  energy,
  support,
  clarity,
  satisfaction,
]: Row): PulseAnswers => ({
  workload,
  energy,
  support,
  clarity,
  satisfaction,
});

interface Pattern {
  personId: string;
  /** Days before today of the newest response. */
  offset: number;
  /** Oldest first: [obciążenie, energia, wsparcie, jasność, satysfakcja]. */
  rows: Row[];
  /** Comments by row index: [text, shared with the supervisor]. */
  comments?: Record<number, [string, boolean]>;
}

/**
 * Demo pulse history (fictional people of src/cases/seed/), 6 responses
 * every 2 weeks (~12 weeks), with different patterns: stable high (Nowak),
 * gradual decline (Wójcik), sudden drop (Lewandowski), improving (Mazur),
 * stable middle (Szymański, Zielińska), stopped answering (Dąbrowska),
 * workload pressure of a team leader (Kowalczyk). The other
 * supervisor's team has 2 people, so its team averages stay hidden.
 */
const PATTERNS: Pattern[] = [
  {
    personId: 'p-nowak',
    offset: 14,
    rows: [
      [4, 4, 5, 4, 5],
      [4, 5, 5, 4, 5],
      [4, 4, 5, 5, 5],
      [4, 4, 5, 4, 4],
      [4, 5, 5, 5, 5],
      [4, 4, 5, 5, 5],
    ],
    comments: {
      4: [
        'Praca nad stanowiskiem w sprawie AI daje mi dużo satysfakcji.',
        true,
      ],
    },
  },
  {
    personId: 'p-wojcik',
    offset: 14,
    rows: [
      [4, 4, 4, 4, 5],
      [4, 4, 4, 4, 4],
      [3, 4, 4, 3, 4],
      [3, 3, 4, 3, 3],
      [3, 3, 3, 3, 2],
      [2, 3, 3, 2, 2],
    ],
    comments: {
      3: ['Mam wrażenie, że ciągle gaszę pożary.', false],
      5: [
        'Od przejęcia spraw kolegi nie wyrabiam się z terminami i nie wiem, co jest teraz najważniejsze.',
        true,
      ],
    },
  },
  {
    personId: 'p-lewandowski',
    offset: 2,
    rows: [
      [4, 4, 4, 4, 4],
      [4, 4, 4, 4, 4],
      [4, 4, 4, 5, 4],
      [4, 4, 4, 4, 4],
      [3, 2, 3, 4, 3],
      [1, 1, 2, 3, 3],
    ],
    comments: {
      5: ['Jestem bardzo zmęczony, od miesiąca pracuję po godzinach.', false],
    },
  },
  {
    personId: 'p-mazur',
    offset: 2,
    rows: [
      [2, 3, 3, 2, 3],
      [3, 3, 3, 2, 3],
      [3, 3, 3, 3, 3],
      [3, 3, 4, 3, 3],
      [4, 4, 4, 4, 4],
      [4, 4, 4, 4, 4],
    ],
    comments: {
      5: [
        'Spotkania z mentorką bardzo pomogły mi wdrożyć się w zadania.',
        true,
      ],
    },
  },
  {
    personId: 'p-szymanski',
    offset: 2,
    rows: [
      [3, 3, 4, 3, 3],
      [3, 4, 4, 3, 3],
      [3, 3, 4, 4, 3],
      [3, 3, 4, 3, 4],
      [3, 4, 4, 3, 3],
      [3, 3, 4, 4, 3],
    ],
  },
  {
    personId: 'p-dabrowska',
    offset: 44,
    rows: [
      [4, 4, 4, 4, 4],
      [4, 3, 4, 4, 4],
      [4, 4, 4, 4, 4],
    ],
  },
  {
    personId: 'p-zielinska',
    offset: 5,
    rows: [
      [4, 4, 4, 4, 4],
      [4, 4, 4, 3, 4],
      [4, 4, 4, 4, 4],
      [4, 3, 4, 4, 4],
      [4, 4, 4, 4, 3],
      [4, 4, 4, 4, 4],
    ],
  },
  {
    personId: 'p-kowalczyk',
    offset: 5,
    rows: [
      [3, 4, 4, 4, 4],
      [3, 3, 4, 4, 4],
      [3, 4, 4, 4, 4],
      [3, 3, 4, 3, 4],
      [2, 3, 4, 3, 4],
      [2, 3, 4, 4, 4],
    ],
    comments: {
      5: ['Zespół ma dwa wakaty, część spraw robię sam.', true],
    },
  },
  {
    personId: 'p-wieczorek',
    offset: 3,
    rows: [
      [4, 4, 4, 4, 4],
      [4, 4, 4, 4, 4],
      [4, 4, 3, 4, 4],
      [4, 4, 4, 4, 4],
      [4, 4, 4, 4, 4],
      [4, 4, 4, 4, 4],
    ],
  },
  {
    personId: 'p-krawczyk',
    offset: 3,
    rows: [
      [3, 3, 3, 3, 3],
      [3, 3, 3, 3, 4],
      [3, 3, 3, 4, 4],
      [3, 4, 3, 4, 4],
      [4, 4, 3, 4, 4],
      [4, 4, 4, 4, 4],
    ],
  },
];

export function buildPulseSeed(today: string): PulseResponse[] {
  return PATTERNS.flatMap((p) =>
    p.rows.map((row, i) => {
      const date = addDays(
        today,
        -(p.offset + (p.rows.length - 1 - i) * PULSE_INTERVAL_DAYS),
      );
      const comment = p.comments?.[i];
      return {
        id: `pulse-seed-${p.personId}-${i + 1}`,
        personId: p.personId,
        date,
        answers: answers(row),
        comment: comment?.[0] ?? null,
        shareComment: comment?.[1] ?? false,
        createdAt: `${date}T09:00:00.000Z`,
      };
    }),
  );
}
