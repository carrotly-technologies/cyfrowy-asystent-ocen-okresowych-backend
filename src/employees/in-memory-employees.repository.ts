import {
  byAssessedDesc,
  byFrom,
  EmployeesRepository,
  type EmployeesSeed,
} from './employees.repository.js';
import type {
  Absence,
  Employee,
  HistoricalAssessment,
  Substitution,
} from './employees.types.js';

const copy = <T extends object>(v: T): T => ({ ...v });

/** Used without DATABASE_URL: data lives in this process only. */
export class InMemoryEmployeesRepository extends EmployeesRepository {
  private employees = new Map<string, Employee>();
  private absences = new Map<string, Absence>();
  private substitutions = new Map<string, Substitution>();
  private history = new Map<string, HistoricalAssessment>();

  async listEmployees() {
    return [...this.employees.values()].map(copy);
  }

  async findEmployee(id: string) {
    const e = this.employees.get(id);
    return e ? copy(e) : null;
  }

  async insertEmployee(employee: Employee) {
    this.employees.set(employee.id, copy(employee));
    return copy(employee);
  }

  async updateEmployee(employee: Employee) {
    this.employees.set(employee.id, copy(employee));
    return copy(employee);
  }

  async deleteEmployee(id: string) {
    if (!this.employees.delete(id)) return false;
    for (const [key, a] of this.absences)
      if (a.employeeId === id) this.absences.delete(key);
    for (const [key, h] of this.history)
      if (h.employeeId === id) this.history.delete(key);
    return true;
  }

  async listAbsences(employeeId?: string) {
    return [...this.absences.values()]
      .filter((a) => !employeeId || a.employeeId === employeeId)
      .sort(byFrom)
      .map(copy);
  }

  async insertAbsence(absence: Absence) {
    this.absences.set(absence.id, copy(absence));
    return copy(absence);
  }

  async deleteAbsence(employeeId: string, id: string) {
    const a = this.absences.get(id);
    if (!a || a.employeeId !== employeeId) return false;
    return this.absences.delete(id);
  }

  async listSubstitutions() {
    return [...this.substitutions.values()].sort(byFrom).map(copy);
  }

  async insertSubstitution(s: Substitution) {
    this.substitutions.set(s.id, copy(s));
    return copy(s);
  }

  async deleteSubstitution(id: string) {
    return this.substitutions.delete(id);
  }

  async listHistory(employeeId?: string) {
    return [...this.history.values()]
      .filter((h) => !employeeId || h.employeeId === employeeId)
      .sort(byAssessedDesc)
      .map(copy);
  }

  async insertHistory(rows: HistoricalAssessment[]) {
    for (const row of rows) this.history.set(row.id, copy(row));
  }

  async isEmpty() {
    return this.employees.size === 0;
  }

  async replaceAll(seed: EmployeesSeed) {
    this.employees = new Map(seed.employees.map((e) => [e.id, copy(e)]));
    this.absences = new Map(seed.absences.map((a) => [a.id, copy(a)]));
    this.substitutions = new Map(
      seed.substitutions.map((s) => [s.id, copy(s)]),
    );
    this.history = new Map(seed.history.map((h) => [h.id, copy(h)]));
  }
}
