import { asc } from 'drizzle-orm';
import type { Database } from '../database/database.js';
import { CaseRepository } from './case.repository.js';
import type { CaseRecord } from './case.types.js';
import { cases } from './cases.tables.js';

const toRow = (record: CaseRecord) => ({
  id: record.id,
  personId: record.person.id,
  evaluatorId: record.evaluatorId,
  stage: record.stage,
  record,
  updatedAt: new Date(),
});

/** Used with DATABASE_URL: table cases. */
export class PostgresCaseRepository extends CaseRepository {
  constructor(private readonly db: Database) {
    super();
  }

  async loadAll() {
    const rows = await this.db
      .select({ record: cases.record })
      .from(cases)
      .orderBy(asc(cases.seq));
    return rows.map((r) => r.record);
  }

  async save(record: CaseRecord) {
    const { id: _id, ...changes } = toRow(record);
    await this.db
      .insert(cases)
      .values(toRow(record))
      .onConflictDoUpdate({ target: cases.id, set: changes });
  }

  async isEmpty() {
    const [row] = await this.db.select({ id: cases.id }).from(cases).limit(1);
    return !row;
  }

  async replaceAll(records: CaseRecord[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(cases);
      if (records.length) await tx.insert(cases).values(records.map(toRow));
    });
  }
}
