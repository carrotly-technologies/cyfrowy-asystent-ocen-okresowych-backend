import type { Employment } from '../cases/case.types.js';
import type { GradeId } from '../civil-service-grades/data/grades.data.js';
import type { AbsenceTypeId } from './data/absence-types.data.js';

/**
 * A member of the civil service corps in the HR register (kartoteka). Only
 * the fields the periodic assessment needs (RODO: data minimisation).
 */
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  unit: string;
  position: string;
  employment: Employment;
  /** The position is "kierownik urzędu" (sheet A). */
  officeHead: boolean;
  /** Directly manages employees (sheet B). */
  managesPeople: boolean;
  /** Urzędnik mianowany: year of appointment, grade and when it was granted. */
  appointedYear: number | null;
  grade: GradeId | null;
  gradeGrantedOn: string | null;
  /** Employed for an indefinite period (or appointed) since. */
  indefiniteSince: string | null;
  /** Who assesses this person (podległość służbowa), an EVALUATORS id. */
  evaluatorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeFields = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;

export interface Absence {
  id: string;
  employeeId: string;
  type: AbsenceTypeId;
  from: string;
  to: string;
  justified: boolean;
  note: string;
  createdAt: string;
}

/** An evaluator temporarily replaced by another evaluator (zastępstwo). */
export interface Substitution {
  id: string;
  evaluatorId: string;
  substituteId: string;
  from: string;
  to: string;
  note: string;
  createdAt: string;
}

/** A past assessment from before the system (CSV import). */
export interface HistoricalAssessment {
  id: string;
  employeeId: string;
  assessedOn: string;
  acknowledgedOn: string | null;
  result: 'POSITIVE' | 'NEGATIVE';
  /** Overall level as the sheet writes it ("na poziomie oczekiwań"). */
  level: string | null;
  createdAt: string;
}
