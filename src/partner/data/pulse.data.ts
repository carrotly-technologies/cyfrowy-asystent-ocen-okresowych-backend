/**
 * Pulse survey ("puls dobrostanu"): a short check-in the employee fills
 * every few weeks. These are product settings, not legal rules: the civil
 * service regulations do not require it. Grounding: "Standardy zarządzania
 * zasobami ludzkimi w służbie cywilnej" (work-life balance, system informacji
 * zwrotnej: informacja cykliczna) and the challenge description (dobrostan,
 * sygnały przeciążenia, ryzyko wypalenia).
 */

export const PULSE_QUESTION_IDS = [
  'workload',
  'energy',
  'support',
  'clarity',
  'satisfaction',
] as const;
export type PulseQuestionId = (typeof PULSE_QUESTION_IDS)[number];

export interface PulseQuestion {
  id: PulseQuestionId;
  /** Short name used in charts and flags. */
  label: string;
  /** The statement the employee rates. */
  statement: string;
  /** Meaning of 1 and 5. Every question: 5 = best. */
  low: string;
  high: string;
}

export const PULSE_QUESTIONS: readonly PulseQuestion[] = [
  {
    id: 'workload',
    label: 'Obciążenie',
    statement:
      'Moje obciążenie pracą w ostatnich tygodniach jest do udźwignięcia.',
    low: 'zdecydowanie za duże',
    high: 'w sam raz',
  },
  {
    id: 'energy',
    label: 'Energia',
    statement: 'Mam energię do pracy i regeneruję się po pracy.',
    low: 'jestem wyczerpany/-a',
    high: 'pełen/pełna energii',
  },
  {
    id: 'support',
    label: 'Wsparcie',
    statement: 'Czuję wsparcie przełożonego i zespołu, gdy go potrzebuję.',
    low: 'brak wsparcia',
    high: 'pełne wsparcie',
  },
  {
    id: 'clarity',
    label: 'Jasność priorytetów',
    statement: 'Wiem, co jest teraz najważniejsze w mojej pracy.',
    low: 'zupełnie niejasne',
    high: 'w pełni jasne',
  },
  {
    id: 'satisfaction',
    label: 'Satysfakcja',
    statement: 'Moja praca daje mi satysfakcję.',
    low: 'żadnej',
    high: 'dużą',
  },
];

/** Answers on a 1–5 scale. */
export const PULSE_MIN = 1;
export const PULSE_MAX = 5;

/**
 * How often the employee fills the pulse (product setting). It is also the
 * shortest gap between two responses, so the trend stays comparable and the
 * screen text ("co 14 dni") matches what the API accepts.
 */
export const PULSE_INTERVAL_DAYS = 14;

/**
 * Team aggregates are shown only when at least this many people answered in
 * a period, so that one person's answers cannot be read from the average
 * (minimalizacja danych, RODO art. 5 ust. 1 lit. c).
 */
export const MIN_GROUP_SIZE = 3;

/** Longest optional comment. */
export const PULSE_COMMENT_MAX = 1000;

/** Privacy rules shown on the pulse screens (the same text for both roles). */
export const PULSE_PRIVACY: readonly string[] = [
  'Puls jest dobrowolny i nie jest częścią oceny okresowej. Nie wpływa na oceny cząstkowe.',
  'Przełożony widzi tylko sygnały (np. możliwe przeciążenie) i Twój ogólny wskaźnik dobrostanu z trendem. Nie widzi odpowiedzi na poszczególne pytania ani Twojego komentarza, chyba że sam(-a) go udostępnisz.',
  `Średnie dla poszczególnych pytań przełożony widzi tylko dla całego zespołu i tylko gdy odpowiedziały co najmniej ${MIN_GROUP_SIZE} osoby.`,
  'Kadry (HR) nie mają wglądu w indywidualne odpowiedzi.',
  'Możesz w każdej chwili cofnąć udostępnienie komentarza.',
];
