import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { AuthorizationService } from '@nestjs/authorization';
import {
  CasePolicy,
  isAssessedIn,
  isDirectorFor,
  isEvaluatorOf,
} from '../auth/case.policy.js';
import { legalActions, type Viewer } from './appeals.rules.js';
import { applyAction } from './actions.rules.js';
import { fullName } from './case.rules.js';
import { CaseRuleError, CaseValidationError } from './case-rule.error.js';
import { CaseStore } from './case-store.service.js';
import type {
  Actor,
  CaseAction,
  CaseDetail,
  CaseRecord,
  CaseSummary,
  Deadline,
  StageId,
} from './case.types.js';
import { toDetail, toSummary } from './case-view.js';
import { toExport } from './case-export.js';
import type { CaseExport } from './case-export.schema.js';
import type { ObservationInput, PatchCase } from './cases.schemas.js';
import { formatDatePl } from './dates.js';
import { describeDaysLeft, toDeadline } from './deadlines.rules.js';
import {
  DUE_DATE_REQUEST_BASIS,
  pendingDueDateRequest,
} from './due-date.rules.js';
import { addObservation, applyPatch } from './patch.rules.js';
import { ConfigService } from '@nestjs/config';
import { type OfficeConfig, readOffice } from '../config/office.js';

export interface TodoItem {
  caseId: string;
  stageId: StageId;
  text: string;
  deadline: Deadline;
}

const TODO_TEXT: Partial<Record<StageId, string>> = {
  SHEET_SELECTION: 'wybierz arkusz, kryteria dodatkowe i termin oceny',
  OPENING_TALK: 'przeprowadź rozmowę rozpoczynającą (część I)',
  PART_I_ACK: 'oceniany potwierdza część I',
  OBSERVATION: 'zapisuj obserwacje i przejdź do oceny',
  ASSESSMENT: 'przeprowadź rozmowę oceniającą i uzupełnij ocenę',
  SIGNATURE: 'podpisz ocenę i przekaż ją do zapoznania',
  ACKNOWLEDGEMENT: 'oceniany zapoznaje się z oceną',
};

@Injectable()
export class CasesService {
  constructor(
    private readonly store: CaseStore,
    private readonly auth: AuthenticationContext,
    private readonly authorization: AuthorizationService,
    config: ConfigService,
  ) {
    this.office = readOffice(config);
  }

  /** The office printed on the sheets (env OFFICE_*, src/config/office.ts). */
  readonly office: OfficeConfig;

  get today(): string {
    return this.store.today;
  }

  /** The signed-in user, for GET /api/me. */
  me() {
    const user = this.auth.requireUser();
    return {
      id: user.id,
      login: user.login,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      position: user.position,
      unit: user.unit,
      officeName: this.office.name,
    };
  }

  /**
   * Cases the caller may see: a supervisor's own, the assessed person's own
   * ("Moje oceny", newest first), every case for HR.
   */
  visibleCases(): CaseSummary[] {
    const user = this.auth.requireUser();
    return this.store
      .all()
      .filter(
        (r) =>
          user.role === 'HR' ||
          isEvaluatorOf(user, r) ||
          isAssessedIn(user, r) ||
          isDirectorFor(user, r),
      )
      .map((r) => toSummary(r, this.today));
  }

  team(): { cases: CaseSummary[]; todo: TodoItem[] } {
    const user = this.auth.requireUser();
    const records = this.store
      .all()
      .filter((c) => isEvaluatorOf(user, c) && !c.nextCaseId);
    const cases = records.map((r) => toSummary(r, this.today));
    const todo = cases
      .flatMap((c): TodoItem[] => {
        const deadline = c.nextDeadline;
        if (!deadline?.date) return [];
        const name = fullName(c.person);
        let text: string;
        if (c.status === 'SPRZECIW_W_ROZPATRZENIU') {
          text = `${name}: sprzeciw od oceny czeka na rozstrzygnięcie dyrektora generalnego`;
        } else if (c.status === 'OKRES_SPRZECIWU') {
          text = `${name}: biegnie termin na sprzeciw od oceny`;
        } else if (c.status === 'ZAKONCZONA') {
          text = `${name}: przeprowadź rozmowę rozpoczynającą nowego cyklu`;
        } else {
          const action = TODO_TEXT[c.currentStage];
          if (!action) return [];
          text = `${name}: ${action}`;
        }
        text += ` do ${formatDatePl(deadline.date)} (${describeDaysLeft(deadline.daysLeft!)}) · ${deadline.legalBasis.split(/[:;(]/)[0].trim()}`;
        return [{ caseId: c.id, stageId: c.currentStage, text, deadline }];
      })
      .concat(this.dueDateRequestTodos(records))
      .sort((a, b) => a.deadline.date!.localeCompare(b.deadline.date!));
    return { cases, todo };
  }

  /** Pending requests of the assessed people to change the date (art. 81 ust. 8 pkt 4). */
  private dueDateRequestTodos(records: CaseRecord[]): TodoItem[] {
    return records.flatMap((r): TodoItem[] => {
      const request = pendingDueDateRequest(r);
      if (!request) return [];
      const deadline = toDeadline(
        {
          date: r.partI.assessmentDue,
          label: 'Wniosek o zmianę terminu oceny',
          legalBasis: DUE_DATE_REQUEST_BASIS,
        },
        this.today,
      );
      return [
        {
          caseId: r.id,
          stageId: r.stage,
          text: `${fullName(r.person)}: rozpatrz wniosek o zmianę terminu oceny z ${formatDatePl(request.filedOn)} · ${DUE_DATE_REQUEST_BASIS}`,
          deadline,
        },
      ];
    });
  }

  all(): CaseRecord[] {
    return this.store.all();
  }

  summary(record: CaseRecord): CaseSummary {
    return toSummary(record, this.today);
  }

  /** GET /api/cases/:id: 404 for an unknown case, 403 for someone else's. */
  async view(id: string): Promise<CaseDetail> {
    const record = this.record(id);
    await this.authorize('view', record);
    return this.detail(id, this.actorFor(record));
  }

  /**
   * GET /api/cases/:id/export: the sheet's fields for an EZD or HR system.
   * Same access and the same view as GET /api/cases/:id.
   */
  async export(id: string): Promise<CaseExport> {
    return toExport(await this.view(id), new Date());
  }

  /** Who the caller is in this case; null when they only read it (HR). */
  private actorFor(record: CaseRecord): Actor | null {
    const user = this.auth.requireUser();
    if (isEvaluatorOf(user, record)) return 'EVALUATOR';
    if (isAssessedIn(user, record)) return 'EMPLOYEE';
    return null;
  }

  async patch(id: string, patch: PatchCase): Promise<CaseDetail> {
    const record = this.record(id);
    await this.authorize('edit', record);
    this.store.save(this.run(() => applyPatch(record, patch, this.today)));
    return this.detail(id, 'EVALUATOR');
  }

  async addObservation(
    id: string,
    input: ObservationInput,
  ): Promise<CaseDetail> {
    const record = this.record(id);
    await this.authorize('edit', record);
    const next = this.run(() =>
      addObservation(
        record,
        input,
        this.store.nextObservationId(id),
        this.today,
      ),
    );
    this.store.save(next);
    return this.detail(id);
  }

  /**
   * Workflow action. 404 unknown case; 403 when the caller is not the actor
   * of this action (the assessed person confirms, the evaluator does the
   * rest); 409 when the action is not legal at this stage.
   */
  async action(id: string, action: CaseAction): Promise<CaseDetail> {
    const record = this.record(id);
    await this.authorize('view', record);
    await this.authorization.authorize(
      CasePolicy,
      'act',
      this.auth.requireUser(),
      record,
      action,
    );
    this.store.save(this.run(() => applyAction(record, action, this.today)));
    return this.detail(id, this.actorFor(record));
  }

  private authorize(ability: 'view' | 'edit', record: CaseRecord) {
    return this.authorization.authorize(
      CasePolicy,
      ability,
      this.auth.requireUser(),
      record,
    );
  }

  /** The caller's part in a case, for the post-assessment actions. */
  viewerOf(record: CaseRecord): Viewer {
    const user = this.auth.requireUser();
    if (isEvaluatorOf(user, record)) return 'EVALUATOR';
    if (isAssessedIn(user, record)) return 'EMPLOYEE';
    if (user.role === 'HR') return 'HR';
    if (user.role === 'DIRECTOR') return 'DIRECTOR';
    return null;
  }

  /** Unscoped: for internal use. Routes go through view(). */
  detail(id: string, actor: Actor | null = 'EVALUATOR'): CaseDetail {
    const record = this.record(id);
    const user = this.auth.user;
    return {
      ...toDetail(
        record,
        this.today,
        this.store.evaluator(record.evaluatorId),
        this.office,
        actor,
      ),
      legalActions: user
        ? legalActions(record, this.today, this.viewerOf(record))
        : [],
    };
  }

  reset(): void {
    this.store.reset();
  }

  record(id: string): CaseRecord {
    const record = this.store.find(id);
    if (!record)
      throw new NotFoundException(`Nie znaleziono teczki oceny „${id}”.`);
    return record;
  }

  save(record: CaseRecord): void {
    this.store.save(record);
  }

  evaluatorName(record: CaseRecord): string {
    return fullName(this.store.evaluator(record.evaluatorId));
  }

  /** Domain errors -> HTTP: 409 for rules and locks, 400 for bad values. */
  run<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      if (error instanceof CaseRuleError) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: error.message,
          ...(error.formalCheck ? { formalCheck: error.formalCheck } : {}),
        });
      }
      if (error instanceof CaseValidationError) {
        throw new BadRequestException(error.messages);
      }
      throw error;
    }
  }
}
