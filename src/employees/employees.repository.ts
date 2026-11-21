import type {
  Absence,
  Employee,
  HistoricalAssessment,
  Substitution,
} from './employees.types.js';

export interface EmployeesSeed {
  employees: Employee[];
  absences: Absence[];
  substitutions: Substitution[];
  history: HistoricalAssessment[];
}

/**
 * Storage of the HR register: employees, their absences, imported past
 * assessments, and evaluator substitutions. Deleting an employee removes
 * their absences and imported history too.
 */
export abstract class EmployeesRepository {
  abstract listEmployees(): Promise<Employee[]>;
  abstract findEmployee(id: string): Promise<Employee | null>;
  abstract insertEmployee(employee: Employee): Promise<Employee>;
  abstract updateEmployee(employee: Employee): Promise<Employee>;
  abstract deleteEmployee(id: string): Promise<boolean>;

  /** All absences, or of one employee; sorted by start date. */
  abstract listAbsences(employeeId?: string): Promise<Absence[]>;
  abstract insertAbsence(absence: Absence): Promise<Absence>;
  abstract deleteAbsence(employeeId: string, id: string): Promise<boolean>;

  abstract listSubstitutions(): Promise<Substitution[]>;
  abstract insertSubstitution(s: Substitution): Promise<Substitution>;
  abstract deleteSubstitution(id: string): Promise<boolean>;

  /** All imported assessments, or of one employee; newest first. */
  abstract listHistory(employeeId?: string): Promise<HistoricalAssessment[]>;
  abstract insertHistory(rows: HistoricalAssessment[]): Promise<void>;

  abstract isEmpty(): Promise<boolean>;
  abstract replaceAll(seed: EmployeesSeed): Promise<void>;
}

export const byFrom = (
  a: { from: string; id: string },
  b: { from: string; id: string },
) => a.from.localeCompare(b.from) || a.id.localeCompare(b.id);

export const byAssessedDesc = (
  a: HistoricalAssessment,
  b: HistoricalAssessment,
) => b.assessedOn.localeCompare(a.assessedOn) || a.id.localeCompare(b.id);
