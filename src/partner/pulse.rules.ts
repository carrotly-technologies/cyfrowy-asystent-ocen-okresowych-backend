import { addDays } from '../cases/dates.js';
import {
  MIN_GROUP_SIZE,
  PULSE_INTERVAL_DAYS,
  PULSE_QUESTION_IDS,
  type PulseQuestionId,
} from './data/pulse.data.js';
import type { PulseAnswers, PulsePoint, PulseResponse } from './pulse.types.js';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Average of all answers of one response (1–5). */
export function pulseIndex(answers: PulseAnswers): number {
  const values = PULSE_QUESTION_IDS.map((q) => answers[q]);
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * The supervisor's view of a response: the comment only when the employee
 * chose to share it (privacy by design).
 */
export function toSupervisorPoint(r: PulseResponse): PulsePoint {
  const hasComment = !!r.comment?.trim();
  return {
    id: r.id,
    date: r.date,
    answers: { ...r.answers },
    index: pulseIndex(r.answers),
    sharedComment: hasComment && r.shareComment ? r.comment : null,
    hasPrivateComment: hasComment && !r.shareComment,
  };
}

/** The day the next pulse is due; today when there is none yet. */
export function nextPulseDue(
  responses: readonly PulseResponse[],
  today: string,
): string {
  const last = responses.at(-1);
  if (!last) return today;
  const due = addDays(last.date, PULSE_INTERVAL_DAYS);
  return due < today ? today : due;
}

export type TrendKind =
  'NO_DATA' | 'STABLE' | 'IMPROVING' | 'GRADUAL_DECLINE' | 'SUDDEN_DROP';

export interface TrendResult {
  kind: TrendKind;
  /** Latest index minus the baseline (average of up to 3 earlier responses). */
  delta: number;
  /** Questions whose latest answer is ≥ 2 points below their baseline. */
  droppedQuestions: PulseQuestionId[];
  /** Plain-language description for the "why" of a flag. */
  description: string;
}

/** Thresholds of the trend rules (product heuristics, documented in the README). */
export const TREND = {
  /** Points of the index; a drop this big from baseline to latest is sudden. */
  suddenDrop: 1,
  /** A single question falling this many points is a sudden drop too. */
  questionDrop: 2,
  /** Consecutive decreases of the index that make a gradual decline. */
  declineRun: 3,
  /** Total fall over that run. */
  declineTotal: 0.6,
  /** Rise from baseline to latest that counts as improving. */
  improving: 0.6,
} as const;

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Trend of an employee's responses, oldest first. */
export function pulseTrend(responses: readonly PulseResponse[]): TrendResult {
  if (responses.length < 2) {
    return {
      kind: 'NO_DATA',
      delta: 0,
      droppedQuestions: [],
      description:
        'Za mało odpowiedzi, by ocenić trend (potrzebne co najmniej 2).',
    };
  }
  const latest = responses.at(-1)!;
  const base = responses.slice(-4, -1);
  const indexes = responses.map((r) => pulseIndex(r.answers));
  const baseline = average(base.map((r) => pulseIndex(r.answers)));
  const delta = round1(pulseIndex(latest.answers) - baseline);
  const droppedQuestions = PULSE_QUESTION_IDS.filter(
    (q) =>
      average(base.map((r) => r.answers[q])) - latest.answers[q] >=
      TREND.questionDrop,
  );

  if (-delta >= TREND.suddenDrop || droppedQuestions.length > 0) {
    return {
      kind: 'SUDDEN_DROP',
      delta,
      droppedQuestions,
      description: `Nagły spadek w ostatnim pulsie: indeks ${pulseIndex(latest.answers)} wobec średnio ${round1(baseline)} wcześniej.`,
    };
  }

  const run = indexes.slice(-(TREND.declineRun + 1));
  const decreasing =
    run.length === TREND.declineRun + 1 &&
    run.every((v, i) => i === 0 || v < run[i - 1]);
  if (decreasing && run[0] - run.at(-1)! >= TREND.declineTotal) {
    return {
      kind: 'GRADUAL_DECLINE',
      delta,
      droppedQuestions,
      description: `Stopniowy spadek: indeks maleje ${TREND.declineRun} razy z rzędu (z ${run[0]} do ${run.at(-1)}).`,
    };
  }

  if (delta >= TREND.improving) {
    return {
      kind: 'IMPROVING',
      delta,
      droppedQuestions,
      description: `Poprawa: indeks ${pulseIndex(latest.answers)} wobec średnio ${round1(baseline)} wcześniej.`,
    };
  }
  return {
    kind: 'STABLE',
    delta,
    droppedQuestions,
    description: `Stabilnie: indeks ${pulseIndex(latest.answers)}.`,
  };
}

export interface TeamPeriod {
  /** First day of the period (YYYY-MM-DD). */
  from: string;
  to: string;
  respondents: number;
  /** Averages per question; null when fewer than MIN_GROUP_SIZE answered. */
  averages: PulseAnswers | null;
  index: number | null;
  hiddenReason: string | null;
}

/**
 * Team averages per PULSE_INTERVAL_DAYS period, counting back from today.
 * A period with fewer than `minGroup` respondents is hidden. Only the
 * latest response of each person in a period counts.
 */
export function teamAggregate(
  responses: readonly PulseResponse[],
  today: string,
  periods = 6,
  minGroup = MIN_GROUP_SIZE,
): TeamPeriod[] {
  const out: TeamPeriod[] = [];
  for (let i = periods - 1; i >= 0; i--) {
    const to = addDays(today, -i * PULSE_INTERVAL_DAYS);
    const from = addDays(to, -(PULSE_INTERVAL_DAYS - 1));
    const byPerson = new Map<string, PulseResponse>();
    for (const r of responses) {
      if (r.date >= from && r.date <= to) byPerson.set(r.personId, r);
    }
    const rows = [...byPerson.values()];
    if (rows.length < minGroup) {
      out.push({
        from,
        to,
        respondents: rows.length,
        averages: null,
        index: null,
        hiddenReason: `Ukryte: odpowiedzi mniej niż ${minGroup} osób (ochrona anonimowości).`,
      });
      continue;
    }
    const averages = Object.fromEntries(
      PULSE_QUESTION_IDS.map((q) => [
        q,
        round1(average(rows.map((r) => r.answers[q]))),
      ]),
    ) as PulseAnswers;
    out.push({
      from,
      to,
      respondents: rows.length,
      averages,
      index: pulseIndex(averages),
      hiddenReason: null,
    });
  }
  return out;
}
