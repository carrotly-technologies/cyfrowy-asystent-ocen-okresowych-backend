import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
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
@ApiTags('Zapoznanie, sprzeciw i termin oceny')
@ApiBearerAuth()
@ApiErrors(401, 403, 404)
@Controller()
export class AppealsController {
  constructor(private readonly appeals: AppealsService) {}

  @Post('cases/:id/ack-fiction')
  @ApiParam({
    name: 'id',
    description: 'Identyfikator teczki oceny, np. `c-001`.',
  })
  @ApiOperation({
    summary: 'Odmowa zapoznania się z oceną',
    description:
      'Oceniający odnotowuje odmowę lub niemożność zapoznania się ocenianego z oceną.',
  })
  @ApiOkResponse({ description: 'Teczka oceny (`CaseDetail`).' })
  @ApiErrors(400, 409)
  @Can.Anyone()
  @HttpCode(200)
  async ackFiction(
    @Param('id') id: string,
    @Body({ schema: ackFictionSchema }) body: AckFictionInput,
  ): Promise<CaseDetail> {
    return this.appeals.ackFiction(id, body);
  }

  @Post('cases/:id/objection')
  @ApiParam({
    name: 'id',
    description: 'Identyfikator teczki oceny, np. `c-001`.',
  })
  @ApiOperation({
    summary: 'Złożenie sprzeciwu od oceny',
    description:
      'Oceniany składa sprzeciw w terminie 7 dni od zapoznania się z oceną (art. 83 ust. 1 ustawy).',
  })
  @ApiOkResponse({ description: 'Teczka oceny (`CaseDetail`).' })
  @ApiErrors(400, 409)
  @Can.Anyone()
  @HttpCode(200)
  async fileObjection(
    @Param('id') id: string,
    @Body({ schema: objectionSchema }) body: ObjectionInput,
  ): Promise<CaseDetail> {
    return this.appeals.fileObjection(id, body.text);
  }

  @Post('cases/:id/objection/decision')
  @ApiParam({
    name: 'id',
    description: 'Identyfikator teczki oceny, np. `c-001`.',
  })
  @ApiOperation({
    summary: 'Rozpatrzenie sprzeciwu',
    description:
      'Decyzja dyrektora generalnego (DIRECTOR) w sprawie sprzeciwu.',
  })
  @ApiOkResponse({ description: 'Teczka oceny (`CaseDetail`).' })
  @ApiErrors(400, 409)
  @Can.Anyone()
  @HttpCode(200)
  async decideObjection(
    @Param('id') id: string,
    @Body({ schema: objectionDecisionSchema }) body: ObjectionDecisionBody,
  ): Promise<CaseDetail> {
    return this.appeals.decideObjection(id, body);
  }

  @Post('cases/:id/due-date-request')
  @ApiParam({
    name: 'id',
    description: 'Identyfikator teczki oceny, np. `c-001`.',
  })
  @ApiOperation({ summary: 'Wniosek o zmianę terminu oceny' })
  @ApiOkResponse({ description: 'Teczka oceny (`CaseDetail`).' })
  @ApiErrors(400, 409)
  @Can.Anyone()
  @HttpCode(200)
  async requestDueDateChange(
    @Param('id') id: string,
    @Body({ schema: dueDateRequestSchema }) body: DueDateRequestInput,
  ): Promise<CaseDetail> {
    return this.appeals.requestDueDateChange(id, body);
  }

  @Post('cases/:id/due-date-request/decision')
  @ApiParam({
    name: 'id',
    description: 'Identyfikator teczki oceny, np. `c-001`.',
  })
  @ApiOperation({ summary: 'Decyzja w sprawie zmiany terminu oceny' })
  @ApiOkResponse({ description: 'Teczka oceny (`CaseDetail`).' })
  @ApiErrors(400, 409)
  @Can.Anyone()
  @HttpCode(200)
  async decideDueDateRequest(
    @Param('id') id: string,
    @Body({ schema: dueDateDecisionSchema }) body: DueDateDecisionInput,
  ): Promise<CaseDetail> {
    return this.appeals.decideDueDateRequest(id, body);
  }

  @Get('objections')
  @ApiOperation({
    summary: 'Sprzeciwy do rozpatrzenia',
    description: 'Sprzeciwy widoczne dla zalogowanego użytkownika.',
  })
  @ApiOkResponse({ description: 'Lista sprzeciwów.' })
  @Can.Anyone()
  objections() {
    return this.appeals.objections();
  }
}
