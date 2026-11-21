import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../database/database.js';
import { PulseRepository } from './pulse.repository.js';
import { pulseResponses } from './pulse.tables.js';
import type { PulseResponse } from './pulse.types.js';

type Row = typeof pulseResponses.$inferSelect;

const toResponse = (row: Row): PulseResponse => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
});

const toRow = (r: PulseResponse) => ({
  ...r,
  createdAt: new Date(r.createdAt),
});

/** Used with DATABASE_URL: table pulse_responses. */
export class PostgresPulseRepository extends PulseRepository {
  constructor(private readonly db: Database) {
    super();
  }

  async listByPeople(personIds: string[]) {
    if (personIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(pulseResponses)
      .where(inArray(pulseResponses.personId, personIds))
      .orderBy(
        asc(pulseResponses.date),
        asc(pulseResponses.createdAt),
        asc(pulseResponses.id),
      );
    return rows.map(toResponse);
  }

  async insert(response: PulseResponse) {
    const [row] = await this.db
      .insert(pulseResponses)
      .values(toRow(response))
      .returning();
    return toResponse(row);
  }

  async setShare(id: string, personId: string, shareComment: boolean) {
    const [row] = await this.db
      .update(pulseResponses)
      .set({ shareComment })
      .where(
        and(eq(pulseResponses.id, id), eq(pulseResponses.personId, personId)),
      )
      .returning();
    return row ? toResponse(row) : null;
  }

  async isEmpty() {
    const [row] = await this.db
      .select({ id: pulseResponses.id })
      .from(pulseResponses)
      .limit(1);
    return !row;
  }

  async replaceAll(responses: PulseResponse[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(pulseResponses);
      if (responses.length)
        await tx.insert(pulseResponses).values(responses.map(toRow));
    });
  }
}
