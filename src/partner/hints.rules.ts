import type { ObservationKind } from '../cases/case.types.js';
import { formatDatePl } from '../cases/dates.js';
import { criterionName } from '../criteria/data/criteria.data.js';
import {
  DEVELOPMENT_CATALOGUE,
  type DevelopmentForm,
  EXPECTED_LEVEL_POINTS,
} from './data/development.data.js';
import type { Signal } from './signals.rules.js';

export const DECISION_NOTE =
  'Podpowiedzi wirtualnego asystenta HR są wyłącznie pomocą. Nie ustalają ocen cząstkowych ani oceny ogólnej: decyzja należy do przełożonego.';

/** An S-D-R observation from the case or the supervisor's journal. */
export interface HintObservation {
  date: string;
  criterionId: string;
  kind: ObservationKind;
  situation: string;
  action: string;
  result: string;
}

export interface HintsInput {
  /** Criteria assessed in this case (sheet + additional). */
  criteria: string[];
  /** Partial scores entered so far (draft or final), 1–9. */
  decisions: Record<string, number>;
  observations: HintObservation[];
  signals: Signal[];
}

export interface CriterionSummary {
  criterionId: string;
  name: string;
  strengths: number;
  developments: number;
  score: number | null;
  /** Why it is listed here, in plain words. */
  basis: string[];
}

export interface FeedbackHint {
  criterionId: string;
  name: string;
  kind: ObservationKind;
  date: string;
  /** Ready phrasing (sytuacja – zachowanie – rezultat, SBI). */
  text: string;
}

export interface DevelopmentHint {
  criterionId: string;
  name: string;
  forms: DevelopmentForm[];
  dailyManagement: string;
}

export interface CaseHints {
  disclaimer: string;
  strengths: CriterionSummary[];
  areas: CriterionSummary[];
  feedback: FeedbackHint[];
  feedbackTips: string[];
  development: DevelopmentHint[];
  management: string[];
}

/** How to give constructive feedback (Poradnik KPRM rozdz. 6.2.5.3; Standardy ZZL: informacja zwrotna konkretna i dostosowana do odbiorcy). */
export const FEEDBACK_TIPS: readonly string[] = [
  'Opisuj konkretną sytuację i zachowanie, nie cechy osoby („w piśmie z 3 marca…”, a nie „jesteś niedokładny”).',
  'Pokaż skutek zachowania (rezultat) i zapytaj o perspektywę pracownika.',
  'Przy obszarze do rozwoju zakończ wspólnym ustaleniem: co konkretnie robimy inaczej i jak to sprawdzimy.',
  'Zacznij i zakończ tym, co działa dobrze; informacja zwrotna ma charakter rozwojowy, nie karzący.',
  'Odnoś się do kryteriów i oczekiwań ustalonych w części I arkusza.',
];

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const trimDot = (s: string) => s.trim().replace(/[.\s]+$/, '');

/** SBI phrasing of one S-D-R observation, addressed to the employee. */
export function feedbackPhrase(o: HintObservation): string {
  const when = `W sytuacji z ${formatDatePl(o.date)} (${lowerFirst(trimDot(o.situation))})`;
  const what = `${lowerFirst(trimDot(o.action))}`;
  const effect = `${lowerFirst(trimDot(o.result))}`;
  return o.kind === 'STRENGTH'
    ? `${when} zauważyłam/-em, że: ${what}. Efekt: ${effect}. Dziękuję – właśnie tego oczekuję w kryterium „${criterionName(o.criterionId)}”.`
    : `${when} zauważyłam/-em, że: ${what}. Skutek: ${effect}. Jak to widzisz? Ustalmy, co następnym razem zrobimy inaczej w obszarze „${criterionName(o.criterionId)}”.`;
}

/**
 * Hints for the assessment stage: strengths and areas to develop from
 * observations and partial scores, feedback phrasing, development forms
 * for weaker criteria and how to use the results in managing the team.
 * A score below EXPECTED_LEVEL_POINTS marks an area to develop (Poradnik
 * KPRM 6.2.5.4: każde kryterium ocenione poniżej poziomu oczekiwań stanowi
 * obszar rozwojowy).
 */
export function buildCaseHints(input: HintsInput): CaseHints {
  const ids = [
    ...new Set([
      ...input.criteria,
      ...input.observations.map((o) => o.criterionId),
    ]),
  ];
  const summaries: CriterionSummary[] = ids.map((id) => {
    const obs = input.observations.filter((o) => o.criterionId === id);
    const strengths = obs.filter((o) => o.kind === 'STRENGTH').length;
    const developments = obs.length - strengths;
    const score = input.decisions[id] ?? null;
    const basis: string[] = [];
    if (strengths) basis.push(`${countObservations(strengths)} mocnych stron`);
    if (developments)
      basis.push(`${countObservations(developments)} do rozwoju`);
    if (score != null) basis.push(`ocena cząstkowa (wersja robocza): ${score}`);
    return {
      criterionId: id,
      name: criterionName(id),
      strengths,
      developments,
      score,
      basis,
    };
  });

  const isArea = (s: CriterionSummary) =>
    (s.score != null && s.score < EXPECTED_LEVEL_POINTS) ||
    (s.score == null && s.developments > s.strengths) ||
    (s.developments >= 2 && s.developments >= s.strengths);
  const isStrength = (s: CriterionSummary) =>
    (s.score != null && s.score > EXPECTED_LEVEL_POINTS) ||
    (s.score == null && s.strengths > s.developments) ||
    (s.strengths >= 2 && s.strengths > s.developments);

  const areas = summaries.filter(isArea);
  const strengths = summaries.filter((s) => !isArea(s) && isStrength(s));

  const newestFirst = [...input.observations].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const feedback: FeedbackHint[] = [];
  for (const s of [...strengths, ...areas]) {
    const kind: ObservationKind = areas.includes(s)
      ? 'DEVELOPMENT'
      : 'STRENGTH';
    const o =
      newestFirst.find(
        (x) => x.criterionId === s.criterionId && x.kind === kind,
      ) ?? newestFirst.find((x) => x.criterionId === s.criterionId);
    if (o)
      feedback.push({
        criterionId: o.criterionId,
        name: s.name,
        kind: o.kind,
        date: o.date,
        text: feedbackPhrase(o),
      });
  }

  const development: DevelopmentHint[] = areas.flatMap((s) => {
    const entry = DEVELOPMENT_CATALOGUE[s.criterionId];
    return entry
      ? [{ criterionId: s.criterionId, name: s.name, ...entry }]
      : [];
  });

  const management: string[] = [];
  for (const d of development)
    management.push(`${d.name}: ${d.dailyManagement}`);
  for (const s of strengths.slice(0, 2))
    management.push(
      `${s.name}: wykorzystaj tę mocną stronę w zespole (np. wsparcie nowych osób, trudniejsze sprawy w tym obszarze).`,
    );
  for (const sig of input.signals) {
    if (sig.kind === 'APPRECIATION')
      management.push(
        'Moment do docenienia: powiedz o konkretnym sukcesie przy rozmowie oceniającej i na forum zespołu.',
      );
    else
      management.push(
        `${sig.title}: przy planowaniu zadań po ocenie uwzględnij ${sig.actions
          .slice(0, 2)
          .map((a) => a.label.toLowerCase())
          .join(' i ')}. Ustalenia z rozmowy nie wpływają na ocenę.`,
      );
  }
  if (management.length === 0)
    management.push(
      'Wróćcie do celów z części I co kwartał i dawaj bieżącą informację zwrotną, nie tylko przy ocenie.',
    );

  return {
    disclaimer: DECISION_NOTE,
    strengths,
    areas,
    feedback,
    feedbackTips: [...FEEDBACK_TIPS],
    development,
    management,
  };
}

/** „1 obserwacja”, „2 obserwacje”, „5 obserwacji” (Polish plural). */
export function countObservations(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  const word =
    n === 1
      ? 'obserwacja'
      : last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
        ? 'obserwacje'
        : 'obserwacji';
  return `${n} ${word}`;
}
