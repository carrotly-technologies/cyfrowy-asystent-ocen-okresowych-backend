import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthenticationContext } from '@nestjs/authentication';
import { ROLE_LABELS } from '../auth/role-labels.js';
import {
  ACK_FICTION_VIEWERS,
  courtTermPreview,
  decideObjection,
  fileObjection,
  objectionViews,
  recordAckFiction,
  type Viewer,
} from './appeals.rules.js';
import type {
  AckFictionInput,
  DueDateDecisionInput,
  DueDateRequestInput,
  ObjectionDecisionBody,
} from './appeals.schemas.js';
import { fullName } from './case.rules.js';
import type { ActorRef, CaseDetail, CaseRecord } from './case.types.js';
import { CasesService } from './cases.service.js';
import {
  decideDueDateRequest,
  fileDueDateRequest,
  withdrawDueDateRequest,
} from './due-date.rules.js';

/**
 * Post-assessment paths: fikcja zapoznania, sprzeciw and its decision by the
 * dyrektor generalny, the assessed person's request to change the date.
 * Rules live in appeals.rules.ts / due-date.rules.ts; this checks who acts
 * (403 with a Polish explanation) and stores the result.
 */
@Injectable()
export class AppealsService {
  constructor(
    private readonly cases: CasesService,
    private readonly auth: AuthenticationContext,
  ) {}

  async ackFiction(id: string, input: AckFictionInput): Promise<CaseDetail> {
    const record = this.cases.record(id);
    this.require(
      record,
      ACK_FICTION_VIEWERS,
      'Fikcję zapoznania z oceną odnotowuje oceniający tej osoby albo kadry (HR).',
    );
    return this.save(record, (r) =>
      recordAckFiction(
        r,
        input,
        this.by(),
        this.cases.today,
        this.cases.addresseeOf(r),
      ),
    );
  }

  async fileObjection(id: string, text: string): Promise<CaseDetail> {
    const record = this.cases.record(id);
    this.require(
      record,
      ['EMPLOYEE'],
      'Sprzeciw od oceny wnosi wyłącznie oceniany, którego ocena dotyczy (art. 83 ust. 1 ustawy o służbie cywilnej).',
    );
    return this.save(record, (r) =>
      fileObjection(r, text, this.cases.today, this.cases.addresseeOf(r)),
    );
  }

  async decideObjection(
    id: string,
    input: ObjectionDecisionBody,
  ): Promise<CaseDetail> {
    const record = this.cases.record(id);
    const addressee = this.cases.addresseeOf(record);
    this.require(
      record,
      [addressee.decider],
      addressee.decider === 'EVALUATOR'
        ? `Sprzeciw od tej oceny rozpatruje osoba, która jej dokonała (${addressee.legalBasis}).`
        : `Sprzeciw rozpatruje ${addressee.who.toLowerCase()} (${addressee.legalBasis}; art. 83 ust. 3).`,
    );
    return this.save(record, (r) =>
      decideObjection(r, input, this.by(), this.cases.today, addressee),
    );
  }

  async requestDueDateChange(
    id: string,
    input: DueDateRequestInput,
  ): Promise<CaseDetail> {
    const record = this.cases.record(id);
    this.require(
      record,
      ['EMPLOYEE'],
      'Wniosek o zmianę terminu oceny składa oceniany, którego ocena dotyczy (art. 81 ust. 8 pkt 4 ustawy o służbie cywilnej).',
    );
    return this.save(record, (r) =>
      fileDueDateRequest(r, input, this.cases.today),
    );
  }

  async withdrawDueDateRequest(id: string): Promise<CaseDetail> {
    const record = this.cases.record(id);
    this.require(
      record,
      ['EMPLOYEE'],
      'Wniosek o zmianę terminu oceny może wycofać tylko oceniany, który go złożył.',
    );
    return this.save(record, (r) =>
      withdrawDueDateRequest(r, this.cases.today),
    );
  }

  async decideDueDateRequest(
    id: string,
    input: DueDateDecisionInput,
  ): Promise<CaseDetail> {
    const record = this.cases.record(id);
    this.require(
      record,
      ['EVALUATOR'],
      'Wniosek o zmianę terminu oceny rozpatruje oceniający tej osoby (art. 81 ust. 8 ustawy o służbie cywilnej).',
    );
    return this.save(record, (r) =>
      decideDueDateRequest(r, input, this.by(), this.cases.today),
    );
  }

  /** Preview of the labour court term for a delivery date (art. 83 ust. 5). */
  courtTerm(deliveredOn: string) {
    return courtTermPreview(deliveredOn, this.cases.today);
  }

  /** Objections for the dyrektor generalny (and HR), pending first, oldest first. */
  objections() {
    const user = this.auth.requireUser();
    if (user.role !== 'DIRECTOR' && user.role !== 'HR') {
      throw new ForbiddenException(
        'Listę sprzeciwów widzi dyrektor generalny urzędu i kadry (HR).',
      );
    }
    const today = this.cases.today;
    return this.cases
      .all()
      .filter(
        // Sheet A objections go to the person who made the assessment.
        (record) =>
          user.role === 'HR' ||
          this.cases.addresseeOf(record).decider === 'DIRECTOR',
      )
      .flatMap((record) =>
        objectionViews(record, today).map((objection) => ({
          caseId: record.id,
          person: record.person,
          evaluatorName: this.cases.evaluatorName(record),
          sheetId: record.sheetId,
          status: this.cases.summary(record).status,
          objection,
        })),
      )
      .sort(
        (a, b) =>
          Number(!!a.objection.decision) - Number(!!b.objection.decision) ||
          a.objection.filedOn.localeCompare(b.objection.filedOn),
      );
  }

  private require(record: CaseRecord, allowed: readonly Viewer[], why: string) {
    const viewer = this.cases.viewerOf(record);
    if (!allowed.includes(viewer)) {
      throw new ForbiddenException(`Brak uprawnień. ${why}`);
    }
  }

  private by(): ActorRef {
    const user = this.auth.requireUser();
    return { name: fullName(user), role: ROLE_LABELS[user.role] };
  }

  private async save(
    record: CaseRecord,
    change: (r: CaseRecord) => CaseRecord,
  ): Promise<CaseDetail> {
    await this.cases.save(this.cases.run(() => change(record)));
    const viewer = this.cases.viewerOf(record);
    const actor =
      viewer === 'EVALUATOR' || viewer === 'EMPLOYEE' ? viewer : null;
    return this.cases.detail(record.id, actor);
  }
}
