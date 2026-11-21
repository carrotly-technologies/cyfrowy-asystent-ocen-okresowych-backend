import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { PulseAnswers } from './pulse.types.js';

export const pulseResponses = pgTable(
  'pulse_responses',
  {
    id: text().primaryKey(),
    personId: text('person_id').notNull(),
    date: date({ mode: 'string' }).notNull(),
    answers: jsonb().$type<PulseAnswers>().notNull(),
    comment: text(),
    shareComment: boolean('share_comment').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('pulse_responses_person_date_idx').on(t.personId, t.date)],
);
