import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { Employment } from '../cases/case.types.js';
import type { GradeId } from '../civil-service-grades/data/grades.data.js';
import type { AbsenceTypeId } from './data/absence-types.data.js';

const createdAt = timestamp('created_at', { withTimezone: true }).notNull();

export const employees = pgTable('employees', {
  id: text().primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  unit: text().notNull(),
  position: text().notNull(),
  employment: text().$type<Employment>().notNull(),
  officeHead: boolean('office_head').notNull(),
  managesPeople: boolean('manages_people').notNull(),
  appointedYear: integer('appointed_year'),
  grade: text().$type<GradeId>(),
  gradeGrantedOn: date('grade_granted_on', { mode: 'string' }),
  indefiniteSince: date('indefinite_since', { mode: 'string' }),
  evaluatorId: text('evaluator_id'),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
});

export const employeeAbsences = pgTable(
  'employee_absences',
  {
    id: text().primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    type: text().$type<AbsenceTypeId>().notNull(),
    from: date('date_from', { mode: 'string' }).notNull(),
    to: date('date_to', { mode: 'string' }).notNull(),
    justified: boolean().notNull(),
    note: text().notNull(),
    createdAt,
  },
  (t) => [index('employee_absences_employee_idx').on(t.employeeId)],
);

export const evaluatorSubstitutions = pgTable('evaluator_substitutions', {
  id: text().primaryKey(),
  evaluatorId: text('evaluator_id').notNull(),
  substituteId: text('substitute_id').notNull(),
  from: date('date_from', { mode: 'string' }).notNull(),
  to: date('date_to', { mode: 'string' }).notNull(),
  note: text().notNull(),
  createdAt,
});

export const assessmentHistory = pgTable(
  'assessment_history',
  {
    id: text().primaryKey(),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    assessedOn: date('assessed_on', { mode: 'string' }).notNull(),
    acknowledgedOn: date('acknowledged_on', { mode: 'string' }),
    result: text().$type<'POSITIVE' | 'NEGATIVE'>().notNull(),
    level: text(),
    createdAt,
  },
  (t) => [index('assessment_history_employee_idx').on(t.employeeId)],
);
