import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { Roles } from '../auth/roles.decorator.js';
import type { CaseDetail } from '../cases/case.types.js';
import {
  type DueDateChangeInput,
  dueDateChangeSchema,
  type EvaluatorChangeInput,
  evaluatorChangeSchema,
  type PositionChangeInput,
  positionChangeSchema,
  type TalkInvitationInput,
  talkInvitationSchema,
} from './deadlines.schemas.js';
import { DeadlinesService } from './deadlines.service.js';

@ApiTags('Terminy ocen')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Controller()
export class DeadlinesController {
  constructor(private readonly deadlines: DeadlinesService) {}

  /** Reasons of art. 81 ust. 8 and thresholds, so the UI does not duplicate the law. */
  @Get('deadlines/rules')
  @ApiOperation({
    summary: 'Przyczyny zmiany terminu oceny',
    description:
      'Przyczyny z art. 81 ust. 7–8 ustawy i progi przypomnień (frontend nie powiela przepisów).',
  })
  @ApiOkResponse({ description: 'Przyczyny i progi.' })
  @Can.Anyone()
  rules() {
    return this.deadlines.rules();
  }

  @Get('evaluators')
  @ApiOperation({
    summary: 'Lista oceniających',
    description: 'Oceniający do wyboru przy zmianie oceniającego. Tylko HR.',
  })
  @ApiOkResponse({ description: 'Lista oceniających.' })
  @Roles('HR')
  evaluators() {
    return this.deadlines.evaluators();
  }

  @Post('cases/:id/due-date')
  @ApiOperation({
    summary: 'Zmiana terminu oceny przez oceniającego',
    description:
      'Przyczyna z art. 81 ust. 8 pkt 1–4; warunek 6 miesięcy; pisemne zawiadomienie ocenianego (§8 rozporządzenia).',
  })
  @ApiOkResponse({ description: 'Teczka oceny po zmianie.' })
  @ApiErrors(400, 404, 409)
  @Roles('SUPERVISOR')
  @HttpCode(200)
  changeDueDate(
    @Param('id') id: string,
    @Body({ schema: dueDateChangeSchema }) body: DueDateChangeInput,
  ): Promise<CaseDetail> {
    return this.deadlines.changeDueDateAsEvaluator(id, body);
  }

  @Post('cases/:id/talk-invitations')
  @ApiOperation({
    summary: 'Zaproszenie na rozmowę',
    description:
      'Oceniający zaprasza ocenianego na rozmowę rozpoczynającą lub oceniającą (data, godzina, miejsce).',
  })
  @ApiOkResponse({ description: 'Teczka oceny z zaproszeniem.' })
  @ApiErrors(400, 404)
  @Roles('SUPERVISOR')
  @HttpCode(201)
  invite(
    @Param('id') id: string,
    @Body({ schema: talkInvitationSchema }) body: TalkInvitationInput,
  ): Promise<CaseDetail> {
    return this.deadlines.inviteToTalk(id, body);
  }

  @Post('cases/:id/remind')
  @ApiOperation({
    summary: 'Przypomnienie dla ocenianego',
    description:
      'Oceniający przypomina o potwierdzeniu części I albo o zapoznaniu się z oceną (powiadomienie w aplikacji, jedno dziennie).',
  })
  @ApiOkResponse({ description: 'Teczka oceny z wpisem w historii.' })
  @ApiErrors(404, 409)
  @Roles('SUPERVISOR')
  @HttpCode(200)
  remind(@Param('id') id: string): Promise<CaseDetail> {
    return this.deadlines.remindEmployee(id);
  }

  @Get('cases/:id/talk-invitations/:invitationId/ics')
  @ApiOperation({
    summary: 'Dodaj do kalendarza (.ics)',
    description:
      'Zaproszenie jako plik kalendarza iCalendar. Oceniający lub oceniany.',
  })
  @ApiOkResponse({ description: 'Plik .ics.' })
  @ApiErrors(404)
  @Roles('SUPERVISOR', 'EMPLOYEE')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="rozmowa-ocena-okresowa.ics"',
  )
  ics(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
  ): string {
    return this.deadlines.invitationIcs(id, invitationId);
  }

  @Post('cases/:id/position-change')
  @ApiOperation({
    summary: 'Zmiana stanowiska ocenianego',
    description:
      'Zmiana stanowiska z istotną zmianą obowiązków (§9 rozporządzenia): ponowna część I albo ocena w terminie.',
  })
  @ApiOkResponse({ description: 'Teczka oceny po zmianie.' })
  @ApiErrors(400, 404, 409)
  @Roles('SUPERVISOR', 'HR')
  @HttpCode(200)
  positionChange(
    @Param('id') id: string,
    @Body({ schema: positionChangeSchema }) body: PositionChangeInput,
  ): Promise<CaseDetail> {
    return this.deadlines.positionChange(id, body);
  }

  @Post('cases/:id/evaluator')
  @ApiOperation({
    summary: 'Zmiana oceniającego',
    description:
      'Nowy oceniający w trakcie okresu oceny, kryteria bez zmian (§9 ust. 3 rozporządzenia). Tylko HR.',
  })
  @ApiOkResponse({ description: 'Teczka oceny po zmianie.' })
  @ApiErrors(400, 404, 409)
  @Roles('HR')
  @HttpCode(200)
  changeEvaluator(
    @Param('id') id: string,
    @Body({ schema: evaluatorChangeSchema }) body: EvaluatorChangeInput,
  ): Promise<CaseDetail> {
    return this.deadlines.changeEvaluator(id, body);
  }
}
