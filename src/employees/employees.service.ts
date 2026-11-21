import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthenticationContext } from '@nestjs/authentication';
import { displayName } from '../assessments/assessment.format.js';
import { continuousAbsences } from '../cases/absences.rules.js';
import {
  computeEvaluation,
  fullName,
  STAGE_NAMES,
} from '../cases/case.rules.js';
import type { CaseRecord, Person } from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import {
  daysTermEnd,
  formatDatePl,
  shiftToWorkingDay,
} from '../cases/dates.js';
import {
  assessmentDueDeadline,
  openingTalkDeadline,
  toDeadline,
} from '../cases/deadlines.rules.js';
import {
  OBLIGATORY_GRADE_DAYS,
  obligatoryGradeFor,
} from '../cases/obligatory-grade.rules.js';
import { stageDeadline } from '../cases/stages.rules.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { emptyPromotionRequest } from '../cases/promotion.rules.js';
import { caseRecord } from '../cases/seed/seed-helpers.js';
import { EVALUATORS } from '../cases/seed/seed.data.js';
import { DemoReset } from '../demo/demo-reset.service.js';
import { suggestSheet } from '../sheets/sheet-suggestion.rules.js';
import { ABSENCE_TYPES } from './data/absence-types.data.js';
import {
  byNewest,
  conflictingUnit,
  effectiveEvaluator,
  newCycleStart,
  normalizeUnit,
  obligatoryPromotion,
  obligatoryPromotionNextStep,
  type PastAssessment,
} from './employees.rules.js';
import { EmployeesRepository } from './employees.repository.js';
import type {
  AbsenceInput,
  EmployeeInput,
  EmployeePatch,
  HistoryImportInput,
  SubstitutionInput,
} from './employees.schemas.js';
import { buildEmployeesSeed } from './employees.seed.js';
import type { Absence, Employee, Substitution } from './employees.types.js';
import { parseHistoryCsv } from './history-import.rules.js';
import {
  type CaseFact,
  computeStatistics,
  statisticsCsv,
  toCsv,
} from './statistics.rules.js';

const NOT_FOUND = 'Nie znaleziono pracownika w kartotece.';
const ANONYMIZED = { firstName: 'Dane', lastName: 'usunięte' };

export interface ListQuery {
  q?: string;
  unit?: string;
  employment?: string;
  sheet?: string;
  evaluatorId?: string;
  sort?: string;
}

/**
 * HR register (kartoteka): employees, podległość (who assesses whom),
 * substitutions, absences, history and statistics. HR and ADMIN edit; a
 * supervisor reads only the people they assess (also as a substitute).
 * Assessment cases stay in CasesService; this module only starts them and
 * keeps their person data, evaluator and absences in step.
 */
@Injectable()
export class EmployeesService implements OnModuleInit, OnApplicationBootstrap {
  constructor(
    @Inject(EmployeesRepository) private readonly repo: EmployeesRepository,
    private readonly cases: CasesService,
    private readonly auth: AuthenticationContext,
    private readonly demoReset: DemoReset,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.demoReset.register(() => this.reset());
    if (await this.repo.isEmpty()) await this.reset();
    else await this.syncAbsences();
  }

  /** After the reminders module (it clears the inbox on a demo reset). */
  async onApplicationBootstrap(): Promise<void> {
    this.demoReset.register(() => this.notifyObligatoryPromotions());
    await this.notifyObligatoryPromotions();
  }

  async reset(): Promise<void> {
    await this.repo.replaceAll(buildEmployeesSeed(this.cases.today));
    await this.syncAbsences();
  }

  private get today() {
    return this.cases.today;
  }

  // ---- reads -------------------------------------------------------------

  evaluators() {
    return EVALUATORS.map((e) => ({
      id: e.id,
      name: fullName(e),
      position: e.position,
      unit: e.unit,
    }));
  }

  absenceTypes() {
    return ABSENCE_TYPES;
  }

  async list(query: ListQuery = {}) {
    const substitutions = await this.repo.listSubstitutions();
    const history = await this.repo.listHistory();
    const all = await this.repo.listEmployees();
    const views = all
      .map((e) =>
        this.view(
          e,
          substitutions,
          history.filter((h) => h.employeeId === e.id),
        ),
      )
      .filter((v) => this.canRead(v));
    const q = query.q?.trim().toLocaleLowerCase('pl-PL');
    const filtered = views.filter(
      (v) =>
        (!q ||
          `${v.firstName} ${v.lastName} ${v.position} ${v.unit}`
            .toLocaleLowerCase('pl-PL')
            .includes(q)) &&
        (!query.unit || v.unit === query.unit) &&
        (!query.employment || v.employment === query.employment) &&
        (!query.sheet || v.sheetId === query.sheet) &&
        (!query.evaluatorId || v.evaluatorId === query.evaluatorId),
    );
    const sort = query.sort ?? 'lastName';
    const key = (v: (typeof views)[number]): string =>
      sort === 'unit'
        ? `${v.unit}|${v.lastName}`
        : sort === 'position'
          ? v.position
          : sort === 'deadline'
            ? (v.currentCase?.nextDeadline?.date ?? '9999')
            : `${v.lastName} ${v.firstName}`;
    return filtered.sort((a, b) => key(a).localeCompare(key(b), 'pl'));
  }

  async get(id: string) {
    const employee = await this.employee(id);
    const imported = await this.repo.listHistory(id);
    const view = this.view(
      employee,
      await this.repo.listSubstitutions(),
      imported,
    );
    if (!this.canRead(view))
      throw new ForbiddenException(
        'Możesz przeglądać tylko dane osób, które oceniasz.',
      );
    return { ...view, nextCycle: this.nextCyclePreview(employee, imported) };
  }

  /**
   * What "Rozpocznij nowy cykl" would do, so HR is warned before starting a
   * cycle whose opening-talk term (§7 rozp. 2016) has already passed. Null
   * while an assessment is in progress.
   */
  private nextCyclePreview(
    employee: Employee,
    imported: Parameters<EmployeesService['pastAssessments']>[1],
  ) {
    if (this.casesOf(employee.id).some((r) => !r.acknowledgedOn)) return null;
    const start = newCycleStart(
      employee,
      this.pastAssessments(employee.id, imported),
    );
    if (!start.ok)
      return { ok: false, reason: start.message, openingTalk: null };
    return {
      ok: true,
      reason: start.reason,
      openingTalk: toDeadline(
        openingTalkDeadline(start.cycleStart),
        this.today,
      ),
    };
  }

  private async employee(id: string): Promise<Employee> {
    const employee = await this.repo.findEmployee(id);
    if (!employee) throw new NotFoundException(NOT_FOUND);
    return employee;
  }

  private canRead(view: {
    evaluatorId: string | null;
    effectiveEvaluatorId: string | null;
  }) {
    const user = this.auth.requireUser();
    if (user.role === 'HR' || user.role === 'ADMIN') return true;
    return (
      user.role === 'SUPERVISOR' &&
      !!user.evaluatorId &&
      (view.evaluatorId === user.evaluatorId ||
        view.effectiveEvaluatorId === user.evaluatorId)
    );
  }

  private casesOf(personId: string): CaseRecord[] {
    return this.cases.all().filter((c) => c.person.id === personId);
  }

  /** Signed assessments of the system, as history items. */
  private systemHistory(personId: string): PastAssessment[] {
    return this.casesOf(personId).flatMap((c): PastAssessment[] => {
      if (!c.signedByEvaluatorOn) return [];
      const evaluation = computeEvaluation(c, this.today);
      if (!evaluation) return [];
      return [
        {
          source: 'SYSTEM',
          caseId: c.id,
          assessedOn: c.signedByEvaluatorOn,
          acknowledgedOn: c.acknowledgedOn,
          result: evaluation.result,
          level: evaluation.level
            ? displayName(evaluation.level.label).toLocaleLowerCase('pl-PL')
            : null,
        },
      ];
    });
  }

  private pastAssessments(
    employeeId: string,
    imported: readonly {
      assessedOn: string;
      acknowledgedOn: string | null;
      result: 'POSITIVE' | 'NEGATIVE';
      level: string | null;
    }[],
  ): PastAssessment[] {
    return [
      ...this.systemHistory(employeeId),
      ...imported.map((h) => ({
        source: 'IMPORT' as const,
        caseId: null,
        assessedOn: h.assessedOn,
        acknowledgedOn: h.acknowledgedOn,
        result: h.result,
        level: h.level,
      })),
    ].sort(byNewest);
  }

  private view(
    employee: Employee,
    substitutions: readonly Substitution[],
    imported: readonly {
      assessedOn: string;
      acknowledgedOn: string | null;
      result: 'POSITIVE' | 'NEGATIVE';
      level: string | null;
    }[],
  ) {
    const effective = effectiveEvaluator(
      employee.evaluatorId,
      substitutions,
      this.today,
    );
    const name = (id: string | null) => {
      const e = id ? EVALUATORS.find((x) => x.id === id) : undefined;
      return e ? fullName(e) : null;
    };
    const current = this.casesOf(employee.id).find((c) => !c.nextCaseId);
    const summary = current ? this.cases.summary(current) : null;
    const history = this.pastAssessments(employee.id, imported);
    const suggestion = suggestSheet(employee);
    return {
      ...employee,
      evaluatorName: name(employee.evaluatorId),
      effectiveEvaluatorId: effective.evaluatorId,
      effectiveEvaluatorName: name(effective.evaluatorId),
      substitution: effective.substitution
        ? { from: effective.substitution.from, to: effective.substitution.to }
        : null,
      sheetId: summary?.sheetId ?? suggestion.sheetId,
      sheetSuggestion: suggestion,
      currentCase: summary
        ? {
            id: summary.id,
            stage: summary.currentStage,
            stageName: STAGE_NAMES[summary.currentStage],
            status: summary.status,
            sheetId: summary.sheetId,
            nextDeadline: summary.nextDeadline,
            assessmentDue: this.assessmentDue(current!),
          }
        : null,
      lastAssessment: history[0] ?? null,
      obligatoryPromotion: this.obligatory(employee, history),
    };
  }

  /**
   * art. 89 ust. 2, one answer for the register, statistics, monitoring and
   * the inbox: the rule on the person's acknowledged case (as the reminders
   * use it) or, for assessments imported from before the system, the rule on
   * the whole history. Adds the date to grant the grade by and the next step.
   */
  private obligatory(employee: Employee, history: readonly PastAssessment[]) {
    const records = this.casesOf(employee.id);
    const acknowledged = records
      .filter((r) => r.acknowledgedOn)
      .sort((a, b) => b.acknowledgedOn!.localeCompare(a.acknowledgedOn!))[0];
    const fromCase = acknowledged
      ? obligatoryGradeFor(
          acknowledged,
          records.find((r) => r.nextCaseId === acknowledged.id) ?? null,
        )
      : null;
    const rule = obligatoryPromotion(employee, history);
    const last = history[0];
    const deadline = fromCase
      ? fromCase.deadline
      : rule.due && last?.acknowledgedOn
        ? shiftToWorkingDay(
            daysTermEnd(last.acknowledgedOn, OBLIGATORY_GRADE_DAYS),
          )
        : null;
    const due = !!fromCase || rule.due;
    return {
      ...rule,
      due,
      reason: fromCase ? fromCase.message : rule.reason,
      /** CASE: the reminders scheduler already notifies; HISTORY: imports. */
      source: fromCase ? ('CASE' as const) : ('HISTORY' as const),
      deadline: due ? deadline : null,
      nextStep: due
        ? obligatoryPromotionNextStep(deadline, this.today, formatDatePl)
        : null,
    };
  }

  /** HR inbox: one notification per person with an obligatory next grade. */
  private async notifyObligatoryPromotions(): Promise<void> {
    const substitutions = await this.repo.listSubstitutions();
    const history = await this.repo.listHistory();
    const drafts = (await this.repo.listEmployees()).flatMap((e) => {
      const promotion = this.view(
        e,
        substitutions,
        history.filter((h) => h.employeeId === e.id),
      ).obligatoryPromotion;
      if (!promotion.due || promotion.source === 'CASE') return [];
      return [
        {
          key: `employee:${e.id}:OBLIGATORY_GRADE:${promotion.deadline ?? ''}`,
          audience: 'HR' as const,
          caseId: null,
          type: 'OBLIGATORY_GRADE' as const,
          title: `Obowiązkowy kolejny stopień służbowy: ${fullName(e)}`,
          body: `${promotion.reason} ${promotion.nextStep} (${promotion.legalBasis}).`,
        },
      ];
    });
    try {
      await this.notifications.deliver(drafts, () => null, this.today);
    } catch {
      // The inbox is best effort; the register still shows the alert.
    }
  }

  /**
   * Term of the assessment (art. 81 ust. 4) with and without the extension
   * for absences longer than a month (ust. 7). The opening-talk term (§7
   * rozp. 2016) is never extended, so the card shows both side by side.
   */
  private assessmentDue(record: CaseRecord) {
    const extended = stageDeadline(record, 'ASSESSMENT', this.today);
    const base = assessmentDueDeadline(
      record.cycleStart,
      record.partI.assessmentDue,
    );
    if (!extended?.date) return null;
    return {
      ...extended,
      baseDate: base.date,
      extended: !!base.date && base.date !== extended.date,
    };
  }

  // ---- writes ------------------------------------------------------------

  private assertEvaluator(id: string | null | undefined) {
    if (id && !EVALUATORS.some((e) => e.id === id))
      throw new BadRequestException(['Wybrany oceniający nie istnieje.']);
  }

  /** Known units: the register and the evaluators (podległość służbowa). */
  async units(): Promise<string[]> {
    const all = [
      ...(await this.repo.listEmployees()).map((e) => e.unit),
      ...EVALUATORS.map((e) => e.unit),
    ];
    return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'pl'));
  }

  private async assertUnit(
    unit: string | undefined,
  ): Promise<string | undefined> {
    if (unit === undefined) return undefined;
    const name = normalizeUnit(unit);
    const existing = conflictingUnit(name, await this.units());
    if (existing)
      throw new BadRequestException([
        `Komórka „${name}” już jest w kartotece jako „${existing}”. Wybierz ją z listy, żeby nie powstał duplikat w statystykach.`,
      ]);
    return name;
  }

  private normalize<T extends Partial<EmployeeInput>>(fields: T): T {
    // Appointment data exists only for an urzędnik służby cywilnej.
    if (fields.employment === 'PRACOWNIK')
      return {
        ...fields,
        appointedYear: null,
        grade: null,
        gradeGrantedOn: null,
      };
    return fields;
  }

  async create(input: EmployeeInput) {
    this.assertEvaluator(input.evaluatorId);
    const unit = (await this.assertUnit(input.unit))!;
    const now = new Date().toISOString();
    const employee: Employee = {
      ...this.normalize({ ...input, unit }),
      id: `p-${randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    await this.repo.insertEmployee(employee);
    return this.get(employee.id);
  }

  /**
   * Edits the record; open cases (not yet acknowledged) get the new person
   * data, and a change of the evaluator (zmiana podległości) moves them to
   * the new evaluator, noted in the case history.
   */
  async update(id: string, patch: EmployeePatch) {
    const stored = await this.employee(id);
    this.assertEvaluator(patch.evaluatorId);
    const unit =
      patch.unit !== undefined && normalizeUnit(patch.unit) !== stored.unit
        ? ((await this.assertUnit(patch.unit)) ?? stored.unit)
        : stored.unit;
    const next: Employee = {
      ...stored,
      ...this.normalize({ ...stored, ...patch, unit }),
      id,
      createdAt: stored.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.repo.updateEmployee(next);
    void this.notifyObligatoryPromotions();
    for (const record of this.casesOf(id)) {
      if (record.acknowledgedOn) continue;
      const history = [...record.history];
      let evaluatorId = record.evaluatorId;
      if (next.evaluatorId && next.evaluatorId !== record.evaluatorId) {
        const from = EVALUATORS.find((e) => e.id === record.evaluatorId);
        const to = EVALUATORS.find((e) => e.id === next.evaluatorId)!;
        history.push({
          date: this.today,
          text: `Kadry zmieniły podległość służbową: oceniający ${from ? fullName(from) : '—'} → ${fullName(to)}.`,
        });
        evaluatorId = next.evaluatorId;
      }
      await this.cases.save({
        ...record,
        person: { ...record.person, ...this.person(next) },
        evaluatorId,
        history,
      });
    }
    return this.get(id);
  }

  private person(e: Employee): Person {
    return {
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      position: e.position,
      unit: e.unit,
      employment: e.employment,
      hiredOn: e.indefiniteSince ?? e.createdAt.slice(0, 10),
      officeHead: e.officeHead,
      managesPeople: e.managesPeople,
    };
  }

  /**
   * Deletes the employee's data. Rule: refused (409) while an assessment is
   * in progress (not yet acknowledged), because the case must be finished
   * first. Otherwise the record, absences and imported history are deleted
   * and the person's finished cases are anonymised (name replaced), so the
   * statistics still count them without personal data (RODO, art. 17).
   */
  async remove(id: string): Promise<void> {
    await this.employee(id);
    const records = this.casesOf(id);
    if (records.some((r) => !r.acknowledgedOn)) {
      throw new ConflictException(
        'Nie można usunąć danych: pracownik ma ocenę w toku. Najpierw zakończ ocenę (zapoznanie ocenianego z oceną).',
      );
    }
    await this.repo.deleteEmployee(id);
    for (const record of records) {
      await this.cases.save({
        ...record,
        person: {
          ...record.person,
          ...ANONYMIZED,
          id: `usuniety-${record.id}`,
        },
        history: [
          ...record.history,
          {
            date: this.today,
            text: 'Dane osobowe ocenianego usunięto z kartoteki.',
          },
        ],
      });
    }
  }

  /**
   * Starts a new assessment cycle: a case in SHEET_SELECTION, anchored on
   * the last assessment or on employment for an indefinite period (opening
   * talk 30 days, 7 days after a negative assessment; §7 rozp. 2016).
   */
  async startCycle(id: string) {
    const employee = await this.employee(id);
    const records = this.casesOf(id);
    const open = records.find((r) => !r.acknowledgedOn);
    if (open) {
      throw new ConflictException(
        `Pracownik ma już ocenę w toku (teczka „${open.id}”). Nowy cykl rozpoczyna się po zapoznaniu z oceną.`,
      );
    }
    if (!employee.evaluatorId) {
      throw new ConflictException(
        'Najpierw przypisz oceniającego (podległość służbowa).',
      );
    }
    const start = newCycleStart(
      employee,
      this.pastAssessments(id, await this.repo.listHistory(id)),
    );
    if (!start.ok) throw new ConflictException(start.message);
    const caseId = `c-${randomUUID().slice(0, 8)}`;
    const person = this.person(employee);
    const record = caseRecord({
      id: caseId,
      person,
      evaluatorId: employee.evaluatorId,
      cycleStart: start.cycleStart,
      stage: 'SHEET_SELECTION',
      previousAssessment: start.previousAssessment,
      promotionRequest: emptyPromotionRequest(employee.employment),
      history: [
        {
          date: this.today,
          text: `Kadry rozpoczęły nowy cykl oceny. ${start.reason}`,
        },
      ],
    });
    for (const old of records.filter((r) => !r.nextCaseId)) {
      await this.cases.save({ ...old, nextCaseId: caseId });
    }
    await this.cases.save(record);
    await this.syncAbsences();
    return {
      caseId,
      case: this.cases.summary(this.cases.record(caseId)),
      reason: start.reason,
    };
  }

  // ---- absences ----------------------------------------------------------

  async absences(employeeId: string) {
    await this.get(employeeId);
    const list = await this.repo.listAbsences(employeeId);
    return {
      absences: list,
      continuous: continuousAbsences(list),
      legalBasis:
        'art. 81 ust. 7 ustawy o służbie cywilnej; ciągłość i dni wolne między nieobecnościami wg zasad liczenia terminów (art. 110–115 KC)',
    };
  }

  async addAbsence(employeeId: string, input: AbsenceInput) {
    await this.employee(employeeId);
    if (input.to < input.from)
      throw new BadRequestException([
        'Data końca nieobecności nie może być wcześniejsza niż data początku.',
      ]);
    const type = ABSENCE_TYPES.find((t) => t.id === input.type)!;
    const absence: Absence = {
      id: randomUUID(),
      employeeId,
      type: input.type,
      from: input.from,
      to: input.to,
      justified: input.justified ?? type.justified,
      note: input.note ?? '',
      createdAt: new Date().toISOString(),
    };
    await this.repo.insertAbsence(absence);
    await this.syncAbsences();
    return absence;
  }

  async removeAbsence(employeeId: string, absenceId: string) {
    if (!(await this.repo.deleteAbsence(employeeId, absenceId)))
      throw new NotFoundException('Nie znaleziono nieobecności.');
    await this.syncAbsences();
  }

  /** Copies the absences into every case of the person (deadline extension). */
  private async syncAbsences() {
    const all = await this.repo.listAbsences();
    for (const record of this.cases.all()) {
      const absences = all
        .filter((a) => a.employeeId === record.person.id)
        .map((a) => ({ from: a.from, to: a.to, justified: a.justified }));
      if (absences.length || record.absences?.length)
        await this.cases.save({ ...record, absences });
    }
  }

  // ---- substitutions -----------------------------------------------------

  async substitutions() {
    const name = (id: string) => {
      const e = EVALUATORS.find((x) => x.id === id);
      return e ? fullName(e) : id;
    };
    return (await this.repo.listSubstitutions()).map((s) => ({
      ...s,
      evaluatorName: name(s.evaluatorId),
      substituteName: name(s.substituteId),
      active: s.from <= this.today && this.today <= s.to,
    }));
  }

  async addSubstitution(input: SubstitutionInput) {
    this.assertEvaluator(input.evaluatorId);
    this.assertEvaluator(input.substituteId);
    const errors: string[] = [];
    if (input.evaluatorId === input.substituteId)
      errors.push(
        'Osoba zastępująca musi być inna niż zastępowany oceniający.',
      );
    if (input.to < input.from)
      errors.push(
        'Data końca zastępstwa nie może być wcześniejsza niż data początku.',
      );
    if (errors.length) throw new BadRequestException(errors);
    const substitution: Substitution = {
      id: randomUUID(),
      evaluatorId: input.evaluatorId,
      substituteId: input.substituteId,
      from: input.from,
      to: input.to,
      note: input.note ?? '',
      createdAt: new Date().toISOString(),
    };
    await this.repo.insertSubstitution(substitution);
    return substitution;
  }

  async removeSubstitution(id: string) {
    if (!(await this.repo.deleteSubstitution(id)))
      throw new NotFoundException('Nie znaleziono zastępstwa.');
  }

  // ---- history -----------------------------------------------------------

  /** Past cycles of the system (every case) and imported assessments. */
  async history(employeeId: string) {
    await this.get(employeeId);
    const cases = this.casesOf(employeeId).map((c) => {
      const summary = this.cases.summary(c);
      const evaluation = c.signedByEvaluatorOn
        ? computeEvaluation(c, this.today)
        : null;
      return {
        caseId: c.id,
        cycleLabel: summary.cycleLabel,
        sheetId: c.sheetId,
        stage: c.stage,
        stageName: STAGE_NAMES[c.stage],
        status: summary.status,
        signedOn: c.signedByEvaluatorOn,
        acknowledgedOn: c.acknowledgedOn,
        result: evaluation?.result ?? null,
        level: evaluation?.level
          ? displayName(evaluation.level.label).toLocaleLowerCase('pl-PL')
          : null,
      };
    });
    return {
      cases: cases.sort((a, b) =>
        (b.signedOn ?? '9999').localeCompare(a.signedOn ?? '9999'),
      ),
      imported: await this.repo.listHistory(employeeId),
    };
  }

  async importHistory(input: HistoryImportInput) {
    const employees = await this.repo.listEmployees();
    const resolve = (cell: string) => {
      const value = cell.trim();
      const byId = employees.find((e) => e.id === value);
      if (byId) return { id: byId.id };
      const byName = employees.filter(
        (e) =>
          `${e.firstName} ${e.lastName}`.toLocaleLowerCase('pl-PL') ===
          value.toLocaleLowerCase('pl-PL'),
      );
      if (byName.length === 1) return { id: byName[0].id };
      if (byName.length > 1)
        return {
          error: `w kartotece jest kilka osób „${value}”, podaj identyfikator`,
        };
      return { error: `nie znaleziono pracownika „${value}” w kartotece` };
    };
    const { rows, errors } = parseHistoryCsv(input.csv, resolve, this.today);
    if (errors.length > 0) {
      throw new BadRequestException(errors.map((e) => e.message));
    }
    const existing = await this.repo.listHistory();
    const seen = new Set(
      existing.map((h) => `${h.employeeId}|${h.assessedOn}`),
    );
    const now = new Date().toISOString();
    const fresh = rows.filter((r) => {
      const key = `${r.employeeId}|${r.assessedOn}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    await this.repo.insertHistory(
      fresh.map((r) => ({
        id: randomUUID(),
        employeeId: r.employeeId,
        assessedOn: r.assessedOn,
        acknowledgedOn: r.acknowledgedOn,
        result: r.result,
        level: r.level,
        createdAt: now,
      })),
    );
    void this.notifyObligatoryPromotions();
    const freshRows = new Set(fresh);
    const nameOf = new Map(employees.map((e) => [e.id, fullName(e)]));
    return {
      imported: fresh.length,
      skipped: rows.length - fresh.length,
      // Who was imported, so HR can open each card and check it.
      rows: rows.map((r) => ({
        line: r.line,
        employeeId: r.employeeId,
        name: nameOf.get(r.employeeId) ?? r.employeeId,
        assessedOn: r.assessedOn,
        result: r.result,
        level: r.level,
        skipped: !freshRows.has(r),
      })),
    };
  }

  // ---- statistics and export ----------------------------------------------

  async statistics(unit?: string) {
    const employees = (await this.repo.listEmployees()).filter(
      (e) => !unit || e.unit === unit,
    );
    const history = await this.repo.listHistory();
    const unitOf = new Map(employees.map((e) => [e.id, e.unit]));
    const caseFacts: CaseFact[] = this.cases
      .all()
      .filter((c) => !unit || c.person.unit === unit)
      .map((c) => {
        const summary = this.cases.summary(c);
        const evaluation = c.signedByEvaluatorOn
          ? computeEvaluation(c, this.today)
          : null;
        const due =
          summary.stages.find((s) => s.id === 'ASSESSMENT')?.deadline?.date ??
          c.partI.assessmentDue;
        return {
          unit: c.person.unit,
          stage: c.stage,
          signedOn: c.signedByEvaluatorOn,
          finished:
            summary.status === 'ZAKONCZONA' ||
            summary.status === 'OKRES_SPRZECIWU',
          result: evaluation?.result ?? null,
          level: evaluation?.level
            ? displayName(evaluation.level.label).toLocaleLowerCase('pl-PL')
            : null,
          dueOn: due,
          overdue: summary.nextDeadline?.state === 'OVERDUE',
          promotionRequested: c.promotionRequest.attached === 'YES',
        };
      });
    const imported = history
      .filter((h) => unitOf.has(h.employeeId))
      .map((h) => ({
        unit: unitOf.get(h.employeeId)!,
        result: h.result,
        level: h.level,
      }));
    const employeeFacts = employees.map((e) => ({
      unit: e.unit,
      obligatoryPromotion: this.obligatory(
        e,
        this.pastAssessments(
          e.id,
          history.filter((h) => h.employeeId === e.id),
        ),
      ).due,
    }));
    return {
      generatedOn: this.today,
      unit: unit ?? null,
      ...computeStatistics(caseFacts, imported, employeeFacts),
    };
  }

  async statisticsCsv(unit?: string) {
    return statisticsCsv(await this.statistics(unit), this.today);
  }

  /** The register with the last assessment, as CSV (archiwizacja danych). */
  async employeesCsv() {
    const list = await this.list();
    return toCsv([
      [
        'Identyfikator',
        'Imię',
        'Nazwisko',
        'Komórka',
        'Stanowisko',
        'Status',
        'Kierownik urzędu',
        'Kieruje pracownikami',
        'Rok mianowania',
        'Stopień służbowy',
        'Zatrudnienie na czas nieokreślony od',
        'Oceniający',
        'Arkusz',
        'Etap bieżącej oceny',
        'Termin',
        'Ostatnia ocena',
        'Data ostatniej oceny',
      ],
      ...list.map((v) => [
        v.id,
        v.firstName,
        v.lastName,
        v.unit,
        v.position,
        v.employment === 'URZEDNIK'
          ? 'urzędnik służby cywilnej'
          : 'pracownik służby cywilnej',
        v.officeHead ? 'tak' : 'nie',
        v.managesPeople ? 'tak' : 'nie',
        v.appointedYear ?? '',
        v.grade ?? '',
        v.indefiniteSince ? formatDatePl(v.indefiniteSince) : '',
        v.evaluatorName ?? '',
        v.sheetId,
        v.currentCase?.stageName ?? '',
        v.currentCase?.nextDeadline?.date
          ? formatDatePl(v.currentCase.nextDeadline.date)
          : '',
        v.lastAssessment
          ? `${v.lastAssessment.result === 'POSITIVE' ? 'pozytywna' : 'negatywna'}${v.lastAssessment.level ? `, ${v.lastAssessment.level}` : ''}`
          : '',
        v.lastAssessment ? formatDatePl(v.lastAssessment.assessedOn) : '',
      ]),
    ]);
  }
}
