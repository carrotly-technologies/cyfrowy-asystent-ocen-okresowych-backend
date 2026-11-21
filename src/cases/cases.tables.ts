import {
  index,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { CaseRecord } from './case.types.js';

/**
 * Cases (teczki ocen). The whole record, its history included, is one JSONB
 * document: the case model changes often and needs no migration for a new
 * optional field. The columns beside it are for lookups only.
 */
export const cases = pgTable(
  'cases',
  {
    id: text().primaryKey(),
    /** Insertion order, so the list keeps the order it had before a restart. */
    seq: serial().notNull(),
    personId: text('person_id').notNull(),
    evaluatorId: text('evaluator_id').notNull(),
    stage: text().notNull(),
    record: jsonb().$type<CaseRecord>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('cases_person_idx').on(t.personId),
    index('cases_evaluator_idx').on(t.evaluatorId),
  ],
);
