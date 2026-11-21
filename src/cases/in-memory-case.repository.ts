import { CaseRepository } from './case.repository.js';
import type { CaseRecord } from './case.types.js';

/** Used without DATABASE_URL: data lives in this process only. */
export class InMemoryCaseRepository extends CaseRepository {
  private rows = new Map<string, CaseRecord>();

  async loadAll() {
    return [...this.rows.values()].map((r) => structuredClone(r));
  }

  async save(record: CaseRecord) {
    this.rows.set(record.id, structuredClone(record));
  }

  async isEmpty() {
    return this.rows.size === 0;
  }

  async replaceAll(records: CaseRecord[]) {
    this.rows = new Map(records.map((r) => [r.id, structuredClone(r)]));
  }
}
