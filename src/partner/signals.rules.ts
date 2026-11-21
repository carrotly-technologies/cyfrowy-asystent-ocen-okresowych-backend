import { addDays, daysBetween, formatDatePl } from '../cases/dates.js';
import type { ObservationKind } from '../cases/case.types.js';
import { criterionName } from '../criteria/data/criteria.data.js';
import {
  PARTNER_ACTIONS,
  type PartnerAction,
  type PartnerActionId,
} from './data/partner-actions.data.js';
import { pulseIndex, pulseTrend, type TrendResult } from './pulse.rules.js';
import type { PulseResponse } from './pulse.types.js';

/**
 * Work data from the office's systems (HR system, EZD, task tracker) through
 * their API; in the demo a seed. No reasons of absences are processed (they
 * may be health data, art. 9 RODO), only their length.
 */
export interface WorkContext {
  openTasks: number;
  overdueTasks: number;
  scopeChanges: { date: string; text: string }[];
  absences: { from: string; to: string }[];
  /** Where the data comes from, shown in the UI. */
  source: string;
}

export interface SignalObservation {
  date: string;
  kind: ObservationKind;
  criterionId: string;
  /** Short text (situation), used in the "why". */
  summary: string;
}

export interface SignalInput {
  today: string;
  /** Oldest first. */
  pulses: readonly PulseResponse[];
  observations: readonly SignalObservation[];
  work: WorkContext | null;
}

export type SignalKind =
  'OVERLOAD' | 'MOTIVATION_DROP' | 'BURNOUT_RISK' | 'APPRECIATION';
export type SignalLevel = 'WATCH' | 'ALERT' | 'POSITIVE';
export type ReasonSource = 'PULSE' | 'JOURNAL' | 'TASKS' | 'SCOPE' | 'ABSENCE';

export interface SignalReason {
  source: ReasonSource;
  text: string;
}

export interface Signal {
  kind: SignalKind;
  level: SignalLevel;
  title: string;
  reasons: SignalReason[];
  actions: PartnerAction[];
}

export interface SignalsResult {
  signals: Signal[];
  trend: TrendResult;
  /** Remarks about the data itself (e.g. no recent pulse). */
  notes: string[];
}

/** Thresholds of the signal rules (product heuristics, not law). */
export const SIGNAL_RULES = {
  /** An answer at or below this (1–5) is low. */
  lowAnswer: 2,
  /** A pulse older than this is not used for flags. */
  pulseFreshDays: 28,
  overdueTasks: 3,
  scopeChangeDays: 90,
  observationDays: 90,
  appreciationDays: 60,
  appreciationStrengths: 2,
  stableHighIndex: 4.2,
  longAbsenceDays: 10,
} as const;

const TITLES: Record<SignalKind, string> = {
  OVERLOAD: 'Sygnał przeciążenia',
  MOTIVATION_DROP: 'Możliwy spadek motywacji',
  BURNOUT_RISK: 'Ryzyko wypalenia',
  APPRECIATION: 'Moment do docenienia',
};

const actions = (...ids: PartnerActionId[]) =>
  ids.map((id) => PARTNER_ACTIONS[id]);

/** Distinct sources make a flag stronger than many reasons of one source. */
function level(reasons: SignalReason[], alertSources = 2): SignalLevel {
  return new Set(reasons.map((r) => r.source)).size >= alertSources
    ? 'ALERT'
    : 'WATCH';
}

/**
 * Privacy (decision 7 of the UX review): the supervisor sees flags and one overall wellbeing index per person, never
 * the answer to a single pulse question. Reason texts therefore name the area of a flag but carry no answer values.
 *
 * Explainable flags about an employee's condition, from pulse trends,
 * journal and case observations and work data. Each flag lists the data
 * that triggered it and suggested actions. Advisory only: the supervisor
 * decides what to do; flags never affect the assessment.
 */
export function computeSignals(input: SignalInput): SignalsResult {
  const { today, observations, work } = input;
  const R = SIGNAL_RULES;
  const notes: string[] = [];
  const fresh = input.pulses.filter(
    (p) => daysBetween(p.date, today) <= R.pulseFreshDays,
  );
  const pulses = fresh.length > 0 ? input.pulses : [];
  if (input.pulses.length === 0) {
    notes.push('Brak odpowiedzi w pulsie (puls jest dobrowolny).');
  } else if (fresh.length === 0) {
    notes.push(
      `Ostatni puls ${formatDatePl(input.pulses.at(-1)!.date)}, starszy niż ${R.pulseFreshDays} dni: nie jest brany pod uwagę w sygnałach.`,
    );
  }
  const trend = pulseTrend(pulses);
  const latest = pulses.at(-1);
  const previous = pulses.at(-2);
  const low = (q: keyof PulseResponse['answers'], p = latest) =>
    !!p && p.answers[q] <= R.lowAnswer;
  const pulseReason = (text: string): SignalReason => ({
    source: 'PULSE',
    text: `${formatDatePl(latest!.date)}: ${text}`,
  });

  const recentObs = observations.filter(
    (o) => daysBetween(o.date, today) <= R.observationDays,
  );
  const strengths = observations.filter(
    (o) =>
      o.kind === 'STRENGTH' && daysBetween(o.date, today) <= R.appreciationDays,
  );
  const developments = recentObs.filter((o) => o.kind === 'DEVELOPMENT');
  const scopeChanges = (work?.scopeChanges ?? []).filter(
    (s) => daysBetween(s.date, today) <= R.scopeChangeDays,
  );
  const absenceDays = (work?.absences ?? [])
    .filter((a) => a.to >= addDays(today, -R.observationDays))
    .reduce((sum, a) => sum + daysBetween(a.from, a.to) + 1, 0);

  const signals: Signal[] = [];

  // Overload: the pulse or the task list says so; a recent change of duties adds to it.
  const overload: SignalReason[] = [];
  if (low('workload'))
    overload.push(pulseReason('pracownik sygnalizuje zbyt duże obciążenie.'));
  else if (trend.droppedQuestions.includes('workload'))
    overload.push(pulseReason('wyraźny spadek w obszarze obciążenia.'));
  if (work && work.overdueTasks >= R.overdueTasks)
    overload.push({
      source: 'TASKS',
      text: `${work.overdueTasks} zadania po terminie (z ${work.openTasks} otwartych).`,
    });
  const overloadFires = overload.length > 0;
  for (const s of scopeChanges)
    overload.push({
      source: 'SCOPE',
      text: `Zmiana zakresu obowiązków ${formatDatePl(s.date)}: ${s.text}`,
    });
  if (overloadFires) {
    signals.push({
      kind: 'OVERLOAD',
      level: level(overload),
      title: TITLES.OVERLOAD,
      reasons: overload,
      actions: actions(
        'REPRIORITIZE',
        'SPLIT_TASKS',
        'TEAM_SUPPORT',
        'SUPPORT_TALK',
      ),
    });
  }

  // Motivation drop: falling pulse, low satisfaction or unclear priorities.
  const motivation: SignalReason[] = [];
  if (trend.kind === 'GRADUAL_DECLINE')
    motivation.push({ source: 'PULSE', text: trend.description });
  if (low('satisfaction'))
    motivation.push(pulseReason('niska satysfakcja z pracy.'));
  if (low('clarity')) motivation.push(pulseReason('niejasne priorytety.'));
  const motivationFires = motivation.length > 0;
  if (
    developments.length >= 2 &&
    !recentObs.some((o) => o.kind === 'STRENGTH')
  ) {
    motivation.push({
      source: 'JOURNAL',
      text: `${developments.length} obserwacje „do rozwoju” w ostatnich ${R.observationDays} dniach i żadnej mocnej strony.`,
    });
  } else if (developments.length > 0 && motivationFires) {
    const o = developments[0];
    motivation.push({
      source: 'JOURNAL',
      text: `Obserwacja ${formatDatePl(o.date)} (${criterionName(o.criterionId)}): ${o.summary}`,
    });
  }
  if (motivationFires) {
    signals.push({
      kind: 'MOTIVATION_DROP',
      level: level(motivation),
      title: TITLES.MOTIVATION_DROP,
      reasons: motivation,
      actions: actions(
        'SUPPORT_TALK',
        ...(low('clarity') ? (['CLARIFY_GOALS'] as const) : []),
        'GROWTH_OPPORTUNITY',
        'MENTORING',
      ),
    });
  }

  // Burnout risk: exhaustion that lasts, or a sudden fall under pressure.
  const burnout: SignalReason[] = [];
  const lowEnergyTwice = low('energy') && low('energy', previous);
  if (lowEnergyTwice)
    burnout.push({
      source: 'PULSE',
      text: 'Niska energia w dwóch kolejnych pulsach.',
    });
  if (trend.kind === 'SUDDEN_DROP') {
    burnout.push({ source: 'PULSE', text: trend.description });
  }
  if (low('support')) burnout.push(pulseReason('niskie poczucie wsparcia.'));
  const burnoutFires =
    lowEnergyTwice ||
    (trend.kind === 'SUDDEN_DROP' && (overloadFires || low('energy')));
  if (burnoutFires) {
    if (overloadFires)
      burnout.push(...overload.filter((r) => r.source !== 'PULSE'));
    if (absenceDays >= R.longAbsenceDays)
      burnout.push({
        source: 'ABSENCE',
        text: `${absenceDays} dni nieobecności w ostatnich ${R.observationDays} dniach (bez przyczyn: nie przetwarzamy danych o zdrowiu).`,
      });
    signals.push({
      kind: 'BURNOUT_RISK',
      level: burnout.length >= 3 ? 'ALERT' : 'WATCH',
      title: TITLES.BURNOUT_RISK,
      reasons: burnout,
      actions: actions(
        'SUPPORT_TALK',
        'PROJECT_BREAK',
        'TEAM_SUPPORT',
        'ANTI_BURNOUT_DEVELOPMENT',
        'MENTORING',
      ),
    });
  }

  // Appreciation: good observations, a rising or steadily high pulse.
  const appreciation: SignalReason[] = [];
  if (strengths.length >= R.appreciationStrengths) {
    for (const o of strengths.slice(0, 3))
      appreciation.push({
        source: 'JOURNAL',
        text: `Mocna strona ${formatDatePl(o.date)} (${criterionName(o.criterionId)}): ${o.summary}`,
      });
  }
  if (trend.kind === 'IMPROVING')
    appreciation.push({ source: 'PULSE', text: trend.description });
  const last3 = pulses.slice(-3).map((p) => pulseIndex(p.answers));
  const stableHigh =
    last3.length === 3 && last3.every((i) => i >= R.stableHighIndex);
  if (stableHigh)
    appreciation.push({
      source: 'PULSE',
      text: `Wysoki, stabilny puls w trzech ostatnich odpowiedziach (${last3.join(', ')}).`,
    });
  if (appreciation.length > 0) {
    signals.push({
      kind: 'APPRECIATION',
      level: 'POSITIVE',
      title: TITLES.APPRECIATION,
      reasons: appreciation,
      actions: actions(
        'CONCRETE_PRAISE',
        'SUCCESS_VISIBILITY',
        ...(stableHigh || strengths.length >= R.appreciationStrengths
          ? (['GROWTH_OPPORTUNITY'] as const)
          : []),
      ),
    });
  }

  return { signals, trend, notes };
}
