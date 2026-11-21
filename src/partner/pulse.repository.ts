import type { PulseResponse } from './pulse.types.js';

/**
 * Storage of pulse responses. Lists are oldest first (by date, then
 * createdAt), the order of a trend chart.
 */
export abstract class PulseRepository {
  abstract listByPeople(personIds: string[]): Promise<PulseResponse[]>;
  abstract insert(response: PulseResponse): Promise<PulseResponse>;
  /** Changes the share flag of the person's own response; null when not found. */
  abstract setShare(
    id: string,
    personId: string,
    shareComment: boolean,
  ): Promise<PulseResponse | null>;
  abstract isEmpty(): Promise<boolean>;
  /** Replaces everything (demo reset). */
  abstract replaceAll(responses: PulseResponse[]): Promise<void>;
}

export function oldestFirst(a: PulseResponse, b: PulseResponse): number {
  return (
    a.date.localeCompare(b.date) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

/** Used without DATABASE_URL: data lives in this process only. */
export class InMemoryPulseRepository extends PulseRepository {
  private rows = new Map<string, PulseResponse>();

  async listByPeople(personIds: string[]) {
    const ids = new Set(personIds);
    return [...this.rows.values()]
      .filter((r) => ids.has(r.personId))
      .sort(oldestFirst)
      .map((r) => structuredClone(r));
  }

  async insert(response: PulseResponse) {
    this.rows.set(response.id, structuredClone(response));
    return structuredClone(response);
  }

  async setShare(id: string, personId: string, shareComment: boolean) {
    const row = this.rows.get(id);
    if (!row || row.personId !== personId) return null;
    const next = { ...row, shareComment };
    this.rows.set(id, next);
    return structuredClone(next);
  }

  async isEmpty() {
    return this.rows.size === 0;
  }

  async replaceAll(responses: PulseResponse[]) {
    this.rows = new Map(responses.map((r) => [r.id, structuredClone(r)]));
  }
}
