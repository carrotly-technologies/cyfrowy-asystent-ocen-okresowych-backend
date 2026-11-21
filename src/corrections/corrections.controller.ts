import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { randomUUID } from 'node:crypto';
import { Roles } from '../auth/roles.decorator.js';
import type { User } from '../auth/user.types.js';
import { fullName } from '../cases/case.rules.js';
import {
  CaseRuleError,
  CaseValidationError,
} from '../cases/case-rule.error.js';
import type { CaseSummary } from '../cases/case.types.js';
import { CasesService } from '../cases/cases.service.js';
import {
  applyCorrection,
  correctableFields,
} from '../cases/correction.rules.js';
import {
  type CorrectionBody,
  correctionSchema,
} from './corrections.schemas.js';

/**
 * „Tryb korekty błędów przez administratora”: the ADMIN reads a case and
 * changes a field locked after a confirmation, with a mandatory reason; every
 * change is audited in `corrections` and in the case history.
 */
@Controller('admin/cases')
@Roles('ADMIN')
export class CorrectionsController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(): (CaseSummary & { evaluatorName: string; corrections: number })[] {
    return this.cases.all().map((r) => ({
      ...this.cases.summary(r),
      evaluatorName: this.cases.evaluatorName(r),
      corrections: r.corrections?.length ?? 0,
    }));
  }

  /** The case (read only, as HR sees it) and its correctable fields. */
  @Get(':id')
  get(@Param('id') id: string) {
    const record = this.cases.record(id);
    return {
      case: this.cases.detail(id, null),
      fields: correctableFields(record),
    };
  }

  @Post(':id/corrections')
  correct(
    @CurrentUser() me: User,
    @Param('id') id: string,
    @Body({ schema: correctionSchema }) body: CorrectionBody,
  ) {
    const record = this.cases.record(id);
    try {
      const { record: next, correction } = applyCorrection(record, body, {
        id: randomUUID(),
        at: new Date().toISOString(),
        today: this.cases.today,
        by: { userId: me.id, name: fullName(me) },
      });
      this.cases.save(next);
      return {
        correction,
        case: this.cases.detail(id, null),
        fields: correctableFields(next),
      };
    } catch (error) {
      if (error instanceof CaseRuleError) {
        throw new ConflictException(error.message);
      }
      if (error instanceof CaseValidationError) {
        throw new BadRequestException(error.messages);
      }
      throw error;
    }
  }
}
