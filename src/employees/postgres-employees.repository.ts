import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database } from '../database/database.js';
import {
  EmployeesRepository,
  type EmployeesSeed,
} from './employees.repository.js';
import {
  assessmentHistory,
  employeeAbsences,
  employees,
  evaluatorSubstitutions,
} from './employees.tables.js';
import type {
  Absence,
  Employee,
  HistoricalAssessment,
  Substitution,
} from './employees.types.js';

type Timestamps = { createdAt: Date; updatedAt?: Date };

/** Row -> domain: timestamps as ISO strings. */
function fromRow<T extends Timestamps>(
  row: T,
): Omit<T, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt?: string;
} {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    ...(row.updatedAt ? { updatedAt: row.updatedAt.toISOString() } : {}),
  };
}

const employeeRow = (e: Employee) => ({
  ...e,
  createdAt: new Date(e.createdAt),
  updatedAt: new Date(e.updatedAt),
});
const withCreated = <T extends { createdAt: string }>(v: T) => ({
  ...v,
  createdAt: new Date(v.createdAt),
});

/** Used with DATABASE_URL: tables employees, employee_absences, evaluator_substitutions, assessment_history. */
export class PostgresEmployeesRepository extends EmployeesRepository {
  constructor(private readonly db: Database) {
    super();
  }

  async listEmployees() {
    const rows = await this.db.select().from(employees);
    return rows.map((r) => fromRow(r) as Employee);
  }

  async findEmployee(id: string) {
    const [row] = await this.db
      .select()
      .from(employees)
      .where(eq(employees.id, id));
    return row ? (fromRow(row) as Employee) : null;
  }

  async insertEmployee(employee: Employee) {
    await this.db.insert(employees).values(employeeRow(employee));
    return employee;
  }

  async updateEmployee(employee: Employee) {
    const { id, ...rest } = employeeRow(employee);
    await this.db.update(employees).set(rest).where(eq(employees.id, id));
    return employee;
  }

  async deleteEmployee(id: string) {
    const rows = await this.db
      .delete(employees)
      .where(eq(employees.id, id))
      .returning({ id: employees.id });
    return rows.length > 0;
  }

  async listAbsences(employeeId?: string) {
    const rows = await this.db
      .select()
      .from(employeeAbsences)
      .where(
        employeeId ? eq(employeeAbsences.employeeId, employeeId) : undefined,
      )
      .orderBy(asc(employeeAbsences.from), asc(employeeAbsences.id));
    return rows.map((r) => fromRow(r) as Absence);
  }

  async insertAbsence(absence: Absence) {
    await this.db.insert(employeeAbsences).values(withCreated(absence));
    return absence;
  }

  async deleteAbsence(employeeId: string, id: string) {
    const rows = await this.db
      .delete(employeeAbsences)
      .where(
        and(
          eq(employeeAbsences.id, id),
          eq(employeeAbsences.employeeId, employeeId),
        ),
      )
      .returning({ id: employeeAbsences.id });
    return rows.length > 0;
  }

  async listSubstitutions() {
    const rows = await this.db
      .select()
      .from(evaluatorSubstitutions)
      .orderBy(
        asc(evaluatorSubstitutions.from),
        asc(evaluatorSubstitutions.id),
      );
    return rows.map((r) => fromRow(r) as Substitution);
  }

  async insertSubstitution(s: Substitution) {
    await this.db.insert(evaluatorSubstitutions).values(withCreated(s));
    return s;
  }

  async deleteSubstitution(id: string) {
    const rows = await this.db
      .delete(evaluatorSubstitutions)
      .where(eq(evaluatorSubstitutions.id, id))
      .returning({ id: evaluatorSubstitutions.id });
    return rows.length > 0;
  }

  async listHistory(employeeId?: string) {
    const rows = await this.db
      .select()
      .from(assessmentHistory)
      .where(
        employeeId ? eq(assessmentHistory.employeeId, employeeId) : undefined,
      )
      .orderBy(desc(assessmentHistory.assessedOn), asc(assessmentHistory.id));
    return rows.map((r) => fromRow(r) as HistoricalAssessment);
  }

  async insertHistory(rows: HistoricalAssessment[]) {
    if (rows.length === 0) return;
    await this.db.insert(assessmentHistory).values(rows.map(withCreated));
  }

  async isEmpty() {
    const [row] = await this.db
      .select({ id: employees.id })
      .from(employees)
      .limit(1);
    return !row;
  }

  async replaceAll(seed: EmployeesSeed) {
    await this.db.transaction(async (tx) => {
      await tx.delete(assessmentHistory);
      await tx.delete(employeeAbsences);
      await tx.delete(evaluatorSubstitutions);
      await tx.delete(employees);
      if (seed.employees.length)
        await tx.insert(employees).values(seed.employees.map(employeeRow));
      if (seed.absences.length)
        await tx
          .insert(employeeAbsences)
          .values(seed.absences.map(withCreated));
      if (seed.substitutions.length)
        await tx
          .insert(evaluatorSubstitutions)
          .values(seed.substitutions.map(withCreated));
      if (seed.history.length)
        await tx
          .insert(assessmentHistory)
          .values(seed.history.map(withCreated));
    });
  }
}
