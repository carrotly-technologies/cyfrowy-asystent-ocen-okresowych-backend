import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import {
  type AckFictionInput,
  ackFictionSchema,
  type DueDateDecisionInput,
  dueDateDecisionSchema,
  type DueDateRequestInput,
  dueDateRequestSchema,
  type ObjectionDecisionBody,
  objectionDecisionSchema,
  type ObjectionInput,
  objectionSchema,
} from './appeals.schemas.js';
import { AppealsService } from './appeals.service.js';
import type { CaseDetail } from './case.types.js';

/**
 * Who may act is checked in AppealsService against the case (403 with a
 * Polish explanation), so routes are open to every signed-in user here.
 */
@Controller()
export class AppealsController {
  constructor(private readonly appeals: AppealsService) {}

  @Post('cases/:id/ack-fiction')
  @Can.Anyone()
  @HttpCode(200)
  ackFiction(
    @Param('id') id: string,
    @Body({ schema: ackFictionSchema }) body: AckFictionInput,
  ): CaseDetail {
    return this.appeals.ackFiction(id, body);
  }

  @Post('cases/:id/objection')
  @Can.Anyone()
  @HttpCode(200)
  fileObjection(
    @Param('id') id: string,
    @Body({ schema: objectionSchema }) body: ObjectionInput,
  ): CaseDetail {
    return this.appeals.fileObjection(id, body.text);
  }

  @Post('cases/:id/objection/decision')
  @Can.Anyone()
  @HttpCode(200)
  decideObjection(
    @Param('id') id: string,
    @Body({ schema: objectionDecisionSchema }) body: ObjectionDecisionBody,
  ): CaseDetail {
    return this.appeals.decideObjection(id, body);
  }

  @Post('cases/:id/due-date-request')
  @Can.Anyone()
  @HttpCode(200)
  requestDueDateChange(
    @Param('id') id: string,
    @Body({ schema: dueDateRequestSchema }) body: DueDateRequestInput,
  ): CaseDetail {
    return this.appeals.requestDueDateChange(id, body);
  }

  @Post('cases/:id/due-date-request/decision')
  @Can.Anyone()
  @HttpCode(200)
  decideDueDateRequest(
    @Param('id') id: string,
    @Body({ schema: dueDateDecisionSchema }) body: DueDateDecisionInput,
  ): CaseDetail {
    return this.appeals.decideDueDateRequest(id, body);
  }

  @Get('objections')
  @Can.Anyone()
  objections() {
    return this.appeals.objections();
  }
}
