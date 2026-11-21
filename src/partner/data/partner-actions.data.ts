/**
 * Actions the HR partner suggests for a flag. The catalogue follows the
 * challenge description (sekcja 3 "Moduł wirtualnego HR partnera": zmiana
 * priorytetów, przerwa w projektach, rozmowa wspierająca, podział zadań,
 * wsparcie zespołu, mentoring, działania rozwojowe przeciw wypaleniu,
 * kultura doceniania) and the "Standardy ZZL w SC" (informacja zwrotna,
 * work-life balance). Suggestions only: the supervisor decides.
 */

export const PARTNER_ACTION_IDS = [
  'SUPPORT_TALK',
  'REPRIORITIZE',
  'PROJECT_BREAK',
  'SPLIT_TASKS',
  'TEAM_SUPPORT',
  'MENTORING',
  'ANTI_BURNOUT_DEVELOPMENT',
  'CLARIFY_GOALS',
  'CONCRETE_PRAISE',
  'SUCCESS_VISIBILITY',
  'GROWTH_OPPORTUNITY',
] as const;
export type PartnerActionId = (typeof PARTNER_ACTION_IDS)[number];

export interface PartnerAction {
  id: PartnerActionId;
  label: string;
  /** How to do it, in one or two sentences. */
  how: string;
}

export const PARTNER_ACTIONS: Record<PartnerActionId, PartnerAction> = {
  SUPPORT_TALK: {
    id: 'SUPPORT_TALK',
    label: 'Rozmowa wspierająca',
    how: 'Umów krótką rozmowę 1:1 poza kontekstem oceny. Zacznij od pytania otwartego („Jak się czujesz z obecną ilością pracy?”), słuchaj, nie oceniaj, ustalcie jeden konkretny krok.',
  },
  REPRIORITIZE: {
    id: 'REPRIORITIZE',
    label: 'Zmiana priorytetów',
    how: 'Przejrzyjcie razem listę zadań i terminów. Wskaż, co może poczekać, a co przekazać dalej; zapisz ustalenia, żeby obie strony je pamiętały.',
  },
  PROJECT_BREAK: {
    id: 'PROJECT_BREAK',
    label: 'Przerwa od projektu',
    how: 'Rozważ czasowe zdjęcie z najbardziej obciążającego projektu albo zaplanowanie urlopu wypoczynkowego po zamknięciu bieżącego etapu.',
  },
  SPLIT_TASKS: {
    id: 'SPLIT_TASKS',
    label: 'Podział zadań',
    how: 'Podziel duże zadanie na etapy z terminami cząstkowymi albo rozdziel część spraw między inne osoby z zespołu.',
  },
  TEAM_SUPPORT: {
    id: 'TEAM_SUPPORT',
    label: 'Wsparcie zespołu',
    how: 'Wyznacz osobę do zastępstwa lub wsparcia w najtrudniejszych sprawach; omów na spotkaniu zespołu, kto może pomóc.',
  },
  MENTORING: {
    id: 'MENTORING',
    label: 'Mentoring',
    how: 'Zaproponuj mentora (doświadczoną osobę spoza bezpośredniej linii zależności) na kilka spotkań, np. raz w miesiącu.',
  },
  ANTI_BURNOUT_DEVELOPMENT: {
    id: 'ANTI_BURNOUT_DEVELOPMENT',
    label: 'Działania rozwojowe przeciw wypaleniu',
    how: 'Zaproponuj nowe, rozwijające zadanie w obszarze zainteresowań, szkolenie z zarządzania sobą w czasie i radzenia sobie ze stresem albo udział w projekcie z innym zespołem.',
  },
  CLARIFY_GOALS: {
    id: 'CLARIFY_GOALS',
    label: 'Doprecyzowanie celów',
    how: 'Przypomnij cele i oczekiwania z części I arkusza; ustalcie, co jest najważniejsze w najbliższych tygodniach.',
  },
  CONCRETE_PRAISE: {
    id: 'CONCRETE_PRAISE',
    label: 'Konkretne docenienie',
    how: 'Doceń konkretne zachowanie i jego efekt (sytuacja – działanie – rezultat), najlepiej od razu i osobiście, np. „Dzięki temu, że…, udało się…”.',
  },
  SUCCESS_VISIBILITY: {
    id: 'SUCCESS_VISIBILITY',
    label: 'Widoczność sukcesu',
    how: 'Pokaż sukces szerzej: na spotkaniu zespołu, w informacji do dyrektora albo przez powierzenie prezentacji wyników.',
  },
  GROWTH_OPPORTUNITY: {
    id: 'GROWTH_OPPORTUNITY',
    label: 'Szansa rozwoju',
    how: 'Zaproponuj nowe wyzwanie: trudniejszą sprawę, rolę mentora dla nowej osoby lub udział w zespole zadaniowym; rozważ wnioski do IPRZ.',
  },
};
