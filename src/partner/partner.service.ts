import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthenticationContext } from '@nestjs/authentication';
import { isEvaluatorOf } from '../auth/case.policy.js';
import type { User } from '../auth/user.types.js';
import { LlmClient } from '../assistant/llm.client.js';
import { caseCriteria, fullName, STAGE_NAMES } from '../cases/case.rules.js';
import type { CaseRecord } from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import { daysBetween, formatDatePl } from '../cases/dates.js';
import { EVALUATORS, OFFICE_NAME } from '../cases/seed/seed.data.js';
import { DemoReset } from '../demo/demo-reset.service.js';
import { JournalRepository } from '../journal/journal.repository.js';
import { anonymize, deanonymize } from './anonymize.js';
import { personCaseLink } from './case-link.js';
import {
  MIN_GROUP_SIZE,
  PULSE_INTERVAL_DAYS,
  PULSE_MAX,
  PULSE_MIN,
  PULSE_PRIVACY,
  PULSE_QUESTIONS,
} from './data/pulse.data.js';
import {
  buildCaseHints,
  type CaseHints,
  DECISION_NOTE,
  type HintObservation,
} from './hints.rules.js';
import { PARTNER_SYSTEM_PROMPT, rulesAnswer } from './partner-answer.rules.js';
import type { PartnerAskInput, PulseSubmitInput } from './partner.schemas.js';
import {
  nextPulseDue,
  pulseIndex,
  teamAggregate,
  toSupervisorPoint,
  toSupervisorTrend,
} from './pulse.rules.js';
import { PulseRepository } from './pulse.repository.js';
import type { PulseResponse } from './pulse.types.js';
import { buildPulseSeed } from './seed/pulse.seed.js';
import { buildWorkContextSeed } from './seed/work-context.seed.js';
import {
  computeSignals,
  type SignalsResult,
  type WorkContext,
} from './signals.rules.js';

export const ANONYMIZATION_NOTE =
  'Dane zanonimizowane przed wysłaniem do modelu: imiona, nazwiska, PESEL, e-maile, telefony i nazwy jednostek zastąpiono znacznikami; serwer przywraca je w odpowiedzi.';

/**
 * Virtual HR partner: the employee's pulse survey, explainable risk signals
 * for the supervisor, hints for the assessment stage and "Zapytaj HR
 * partnera". Advisory only; nothing here changes a case or a score. No
 * pulse content and no personal data are logged.
 */
@Injectable()
export class PartnerService implements OnModuleInit {
  private work: Record<string, WorkContext> = {};

  constructor(
    @Inject(PulseRepository) private readonly pulses: PulseRepository,
    @Inject(JournalRepository) private readonly journal: JournalRepository,
    private readonly cases: CasesService,
    private readonly auth: AuthenticationContext,
    private readonly demoReset: DemoReset,
    private readonly llm: LlmClient,
  ) {}

  async onModuleInit(): Promise<void> {
    this.work = buildWorkContextSeed(this.cases.today);
    this.demoReset.register(() => this.reset());
    if (await this.pulses.isEmpty()) await this.reset();
  }

  async reset(): Promise<void> {
    await this.pulses.replaceAll(buildPulseSeed(this.cases.today));
  }

  questions() {
    return {
      questions: PULSE_QUESTIONS,
      scale: { min: PULSE_MIN, max: PULSE_MAX },
      intervalDays: PULSE_INTERVAL_DAYS,
      minGroupSize: MIN_GROUP_SIZE,
      privacy: PULSE_PRIVACY,
    };
  }

  // ------------------------------------------------------------ employee

  /** The employee's own pulse history, with comments. */
  async myPulse() {
    const personId = this.employeePersonId();
    const history = await this.pulses.listByPeople([personId]);
    const last = history.at(-1);
    const today = this.cases.today;
    return {
      ...this.questions(),
      history: history.map((r) => ({ ...r, index: pulseIndex(r.answers) })),
      nextDue: nextPulseDue(history, today),
      canSubmit: !last || daysBetween(last.date, today) >= PULSE_INTERVAL_DAYS,
    };
  }

  async submit(input: PulseSubmitInput): Promise<PulseResponse> {
    const personId = this.employeePersonId();
    const history = await this.pulses.listByPeople([personId]);
    const last = history.at(-1);
    const today = this.cases.today;
    if (last && daysBetween(last.date, today) < PULSE_INTERVAL_DAYS)
      throw new ConflictException(
        `Puls wypełniono ${formatDatePl(last.date)}. Puls wypełnia się co ${PULSE_INTERVAL_DAYS} dni, kolejny możesz wypełnić od ${formatDatePl(nextPulseDue(history, today))}.`,
      );
    return this.pulses.insert({
      id: randomUUID(),
      personId,
      date: today,
      answers: input.answers,
      comment: input.comment,
      shareComment: input.comment ? input.shareComment : false,
      createdAt: new Date().toISOString(),
    });
  }

  async setShare(id: string, shareComment: boolean): Promise<PulseResponse> {
    const updated = await this.pulses.setShare(
      id,
      this.employeePersonId(),
      shareComment,
    );
    if (!updated) throw new NotFoundException('Nie znaleziono odpowiedzi.');
    return updated;
  }

  // ---------------------------------------------------------- supervisor

  /** "Dobrostan zespołu": current team of the supervisor. */
  async team() {
    const user = this.user();
    const records = this.cases
      .all()
      .filter((r) => isEvaluatorOf(user, r) && !r.nextCaseId);
    const people = [...new Map(records.map((r) => [r.person.id, r])).values()];
    const all = await this.pulses.listByPeople(people.map((r) => r.person.id));
    const members = await Promise.all(
      people.map(async (record) => {
        const own = all.filter((p) => p.personId === record.person.id);
        const result = await this.signalsFor(record.person.id, own);
        return {
          personId: record.person.id,
          name: fullName(record.person),
          position: record.person.position,
          caseId: record.id,
          stage: STAGE_NAMES[record.stage],
          lastPulse: own.at(-1)?.date ?? null,
          trend: result.trend.kind,
          series: own.map((p) => ({
            date: p.date,
            index: pulseIndex(p.answers),
          })),
          signals: result.signals.map((s) => ({
            kind: s.kind,
            level: s.level,
            title: s.title,
            // The "why" of each flag, as on the employee card (no answer values).
            reasons: s.reasons,
          })),
          notes: result.notes,
        };
      }),
    );
    const counts: Record<string, number> = {};
    for (const m of members)
      for (const s of m.signals) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
    return {
      members,
      signalCounts: counts,
      aggregate: teamAggregate(all, this.cases.today),
      questions: PULSE_QUESTIONS.map((q) => ({ id: q.id, label: q.label })),
      minGroupSize: MIN_GROUP_SIZE,
      privacy: PULSE_PRIVACY,
      disclaimer: DECISION_NOTE,
    };
  }

  /** Employee card: overall index and trend, flags with their reasons, work data; no answers to single questions. */
  async person(personId: string) {
    const record = this.assertSupervisorOf(personId);
    const own = await this.pulses.listByPeople([personId]);
    const result = await this.signalsFor(personId, own);
    return {
      personId,
      name: fullName(record.person),
      position: record.person.position,
      caseId: record.id,
      ...personCaseLink(this.cases.summary(record)),
      points: own.map(toSupervisorPoint),
      trend: toSupervisorTrend(result.trend),
      signals: result.signals,
      notes: result.notes,
      work: this.work[personId] ?? null,
      privacy: PULSE_PRIVACY,
      disclaimer: DECISION_NOTE,
    };
  }

  /** "Podpowiedzi wirtualnego asystenta HR" in the assessment stage of a case. */
  async hints(caseId: string): Promise<CaseHints & { personId: string }> {
    const record = this.cases.record(caseId);
    if (!isEvaluatorOf(this.user(), record))
      throw new ForbiddenException(
        'Podpowiedzi wirtualnego asystenta HR są dostępne tylko dla oceniającego w tej sprawie.',
      );
    return { personId: record.person.id, ...(await this.hintsFor(record)) };
  }

  async ask(input: PartnerAskInput) {
    let record: CaseRecord | null = null;
    if (input.caseId) {
      record = this.cases.record(input.caseId);
      if (!isEvaluatorOf(this.user(), record))
        throw new ForbiddenException(
          'Możesz pytać tylko o pracowników, których oceniasz.',
        );
    } else if (input.personId) {
      record = this.assertSupervisorOf(input.personId);
    }
    const personId = record?.person.id ?? null;
    const own = personId ? await this.pulses.listByPeople([personId]) : [];
    const result = personId ? await this.signalsFor(personId, own) : null;
    const hints = record ? await this.hintsFor(record) : null;
    const name = record ? fullName(record.person) : null;

    const context = this.contextText(name, result, hints);
    const prompt = `Kontekst:\n${context}\n\nPytanie przełożonego: ${input.question}`;
    const { text: anonymizedPrompt, mapping } = anonymize(
      prompt,
      this.entities(),
    );
    const fallback = rulesAnswer(
      input.question,
      name,
      result?.signals ?? [],
      hints,
    );

    const reply = await this.llm.chat([
      { role: 'system', content: PARTNER_SYSTEM_PROMPT },
      { role: 'user', content: anonymizedPrompt },
    ]);
    return {
      answer: reply ? deanonymize(reply, mapping) : fallback,
      mode: reply ? ('LLM' as const) : ('RULES' as const),
      llmConfigured: this.llm.configured,
      anonymizedPrompt,
      replacements: Object.keys(mapping).length,
      anonymizationNote: ANONYMIZATION_NOTE,
      disclaimer: DECISION_NOTE,
    };
  }

  // ------------------------------------------------------------- helpers

  private contextText(
    name: string | null,
    result: SignalsResult | null,
    hints: CaseHints | null,
  ): string {
    const lines: string[] = [];
    if (name) lines.push(`Pracownik: ${name}.`);
    if (result) {
      lines.push(`Trend pulsu: ${result.trend.description}`);
      for (const s of result.signals)
        lines.push(
          `Sygnał: ${s.title}. Powody: ${s.reasons.map((r) => r.text).join(' ')} Sugerowane działania: ${s.actions.map((a) => a.label).join(', ')}.`,
        );
      if (result.signals.length === 0) lines.push('Brak sygnałów ryzyka.');
    }
    if (hints) {
      if (hints.strengths.length)
        lines.push(
          `Mocne strony: ${hints.strengths.map((s) => s.name).join(', ')}.`,
        );
      if (hints.areas.length)
        lines.push(
          `Obszary do rozwoju: ${hints.areas.map((s) => s.name).join(', ')}.`,
        );
    }
    if (lines.length === 0)
      lines.push('Brak danych o konkretnym pracowniku; pytanie ogólne.');
    return lines.join('\n');
  }

  /** Everyone whose name may appear in a prompt, plus unit names. */
  private entities() {
    const user = this.user();
    const people = [
      ...this.cases.all().map((r) => r.person),
      ...EVALUATORS,
      { firstName: user.firstName, lastName: user.lastName },
    ];
    const units = [
      ...this.cases.all().map((r) => r.person.unit),
      ...EVALUATORS.map((e) => e.unit),
      user.unit,
      OFFICE_NAME,
    ];
    return { people, units };
  }

  private async observationsFor(personId: string): Promise<HintObservation[]> {
    const caseObs = this.cases
      .all()
      .filter((r) => r.person.id === personId && isEvaluatorOf(this.user(), r))
      .flatMap((r) => r.observations);
    const journalObs = await this.journal.listObservations(
      personId,
      this.user().id,
    );
    return [...caseObs, ...journalObs].map((o) => ({
      date: o.date,
      criterionId: o.criterionId,
      kind: o.kind,
      situation: o.situation,
      action: o.action,
      result: o.result,
    }));
  }

  private async signalsFor(
    personId: string,
    pulses: PulseResponse[],
  ): Promise<SignalsResult> {
    const observations = await this.observationsFor(personId);
    return computeSignals({
      today: this.cases.today,
      pulses,
      observations: observations.map((o) => ({
        date: o.date,
        kind: o.kind,
        criterionId: o.criterionId,
        summary: o.situation,
      })),
      work: this.work[personId] ?? null,
    });
  }

  private async hintsFor(record: CaseRecord): Promise<CaseHints> {
    const own = await this.pulses.listByPeople([record.person.id]);
    const [observations, signals] = await Promise.all([
      this.observationsFor(record.person.id),
      this.signalsFor(record.person.id, own),
    ]);
    return buildCaseHints({
      criteria: caseCriteria(record),
      decisions: record.decisions,
      observations,
      signals: signals.signals,
    });
  }

  private user(): User {
    return this.auth.requireUser();
  }

  private employeePersonId(): string {
    const { personId } = this.user();
    if (!personId)
      throw new ForbiddenException(
        'Puls wypełnia tylko pracownik ze swojego konta.',
      );
    return personId;
  }

  /** 404 unknown person, 403 someone the supervisor does not evaluate. */
  private assertSupervisorOf(personId: string): CaseRecord {
    const records = this.cases.all().filter((r) => r.person.id === personId);
    if (records.length === 0)
      throw new NotFoundException(`Nie znaleziono pracownika „${personId}”.`);
    const user = this.user();
    const own = records.filter((r) => isEvaluatorOf(user, r));
    if (own.length === 0)
      throw new ForbiddenException(
        'Dane wirtualnego asystenta HR widzisz tylko o pracownikach, których oceniasz.',
      );
    return own.find((r) => !r.nextCaseId) ?? own[0];
  }
}
