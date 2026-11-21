import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaseRepository } from './case.repository.js';
import type { CaseRecord, Evaluator } from './case.types.js';
import { isIsoDate } from './dates.js';
import { buildSeed, EVALUATORS } from './seed/seed.data.js';

export const DEFAULT_DEMO_TODAY = '2026-11-21';

/**
 * The cases, read from memory and written through CaseRepository (PostgreSQL
 * with DATABASE_URL). Loaded at startup; the seed goes only into empty
 * storage, and POST /api/demo/reset restores it. "Today" is DEMO_TODAY
 * (config), so every deadline is computed against a fixed date.
 *
 * Reads stay synchronous on purpose (rules and services call them a lot), so
 * one instance owns the cases: run a single backend instance per database.
 */
@Injectable()
export class CaseStore implements OnModuleInit {
  readonly today: string;
  private cases = new Map<string, CaseRecord>();
  private readonly saveListeners: ((record: CaseRecord) => void)[] = [];

  constructor(
    config: ConfigService,
    @Inject(CaseRepository) private readonly repo: CaseRepository,
  ) {
    const today = config.get<string>('DEMO_TODAY', DEFAULT_DEMO_TODAY);
    if (!isIsoDate(today)) {
      throw new Error(`DEMO_TODAY must be YYYY-MM-DD (got "${today}").`);
    }
    this.today = today;
  }

  async onModuleInit(): Promise<void> {
    if (await this.repo.isEmpty()) await this.reset();
    else
      this.cases = new Map((await this.repo.loadAll()).map((c) => [c.id, c]));
  }

  async reset(): Promise<void> {
    const seed = buildSeed(this.today);
    await this.repo.replaceAll(seed);
    this.cases = new Map(seed.map((c) => [c.id, c]));
  }

  all(): CaseRecord[] {
    return [...this.cases.values()];
  }

  find(id: string): CaseRecord | undefined {
    return this.cases.get(id);
  }

  /** Stored before it is visible, so a failed write changes nothing. */
  async save(record: CaseRecord): Promise<void> {
    await this.repo.save(record);
    this.cases.set(record.id, record);
    for (const listener of this.saveListeners) listener(record);
  }

  /** Called after every save (e.g. notifications about the change). */
  onSave(listener: (record: CaseRecord) => void): void {
    this.saveListeners.push(listener);
  }

  evaluator(id: string): Evaluator {
    const evaluator = EVALUATORS.find((e) => e.id === id);
    if (!evaluator) throw new Error(`Unknown evaluator ${id}`);
    return evaluator;
  }

  /** Unique within the case, also after a restart (derived from stored ids). */
  nextObservationId(caseId: string): string {
    const prefix = `${caseId}-obs-new-`;
    const taken = (this.cases.get(caseId)?.observations ?? [])
      .map((o) => o.id)
      .filter((id) => id.startsWith(prefix))
      .map((id) => Number(id.slice(prefix.length)))
      .filter(Number.isInteger);
    return `${prefix}${Math.max(0, ...taken) + 1}`;
  }
}
