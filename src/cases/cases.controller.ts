import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import type { CaseDetail, CaseSummary } from './case.types.js';
import {
  type CaseExport,
  type CaseExportFormat,
  caseExportQuerySchema,
  caseExportSchema,
} from './case-export.schema.js';
import {
  type ActionInput,
  actionSchema,
  type ObservationInput,
  observationSchema,
  type PatchCase,
  patchCaseSchema,
} from './cases.schemas.js';
import { DemoReset } from '../demo/demo-reset.service.js';
import { CasesService } from './cases.service.js';

const CASE_ID = ApiParam({
  name: 'id',
  description: 'Identyfikator teczki oceny, np. `c-001`.',
});

@ApiTags('Oceny okresowe')
@ApiBearerAuth()
@ApiErrors(401)
@Controller()
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly demoReset: DemoReset,
  ) {}

  @Get('me')
  @Can.Anyone()
  @ApiOperation({ summary: 'Zalogowany użytkownik' })
  @ApiOkResponse({
    description: '`{ id, login, name, role, position, unit, officeName }`.',
  })
  me() {
    return this.cases.me();
  }

  @Get('team')
  @Roles('SUPERVISOR')
  @ApiOperation({
    summary: 'Zespół przełożonego',
    description:
      'Bieżące oceny pracowników przełożonego i lista zadań posortowana wg terminów. Tylko SUPERVISOR.',
  })
  @ApiOkResponse({
    description:
      '`{ cases: CaseSummary[], todo }`. `nextEvaluationDueOn` (`YYYY-MM-DD` albo null): przewidywana data następnej oceny = data podpisania ostatniej oceny + 24 miesiące (art. 81 ust. 1).',
  })
  @ApiErrors(403)
  team() {
    return this.cases.team();
  }

  @Get('cases')
  @Roles('SUPERVISOR', 'EMPLOYEE', 'HR', 'DIRECTOR')
  @ApiOperation({
    summary: 'Lista ocen widocznych dla użytkownika',
    description:
      'Przełożony: oceny swojego zespołu; oceniany: tylko własne; HR: wszystkie.',
  })
  @ApiOkResponse({
    description:
      'Lista teczek (`CaseSummary[]`): oceniany, arkusz, etapy, najbliższy termin, przewidywana data następnej oceny (`nextEvaluationDueOn`), status.',
  })
  @ApiErrors(403)
  list(): CaseSummary[] {
    return this.cases.visibleCases();
  }

  @Get('cases/:id')
  @Roles('SUPERVISOR', 'EMPLOYEE', 'HR', 'DIRECTOR')
  @CASE_ID
  @ApiOperation({
    summary: 'Szczegóły oceny',
    description:
      'Etapy, terminy, sugestia arkusza, część I, obserwacje, część II, kontrola formalna i dostępne akcje. Oceniany nie widzi obserwacji ani projektu części II przed przekazaniem oceny.',
  })
  @ApiOkResponse({ description: 'Teczka oceny (`CaseDetail`).' })
  @ApiErrors(403, 404)
  findOne(@Param('id') id: string): Promise<CaseDetail> {
    return this.cases.view(id);
  }

  @Get('cases/:id/export')
  @Roles('SUPERVISOR', 'EMPLOYEE', 'HR', 'DIRECTOR')
  @CASE_ID
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['json'],
    description: 'Format eksportu (domyślnie `json`).',
  })
  @ApiOperation({
    summary: 'Eksport oceny do systemu EZD lub kadrowego',
    description:
      'Komplet pól arkusza A, B albo C (część I, II i III) w stabilnym, wersjonowanym formacie (`schemaVersion`). Uprawnienia jak przy odczycie oceny: oceniany tylko swoje, przełożony swój zespół, HR wszystkie. Oceniany dostaje część II dopiero po przekazaniu mu oceny.',
  })
  @ApiOkResponse({
    description: 'Arkusz oceny okresowej w formacie JSON.',
    standardSchema: caseExportSchema,
  })
  @ApiErrors(400, 403, 404)
  export(
    @Param('id') id: string,
    @Query('format', { schema: caseExportQuerySchema })
    _format: CaseExportFormat,
  ): Promise<CaseExport> {
    return this.cases.export(id);
  }

  @Patch('cases/:id')
  @Roles('SUPERVISOR')
  @CASE_ID
  @ApiOperation({
    summary: 'Zmiana danych oceny',
    description:
      'Częściowa aktualizacja (arkusz, część I, oceny cząstkowe, uzasadnienie, IPRZ, część III). Tylko oceniający tej oceny.',
  })
  @ApiOkResponse({ description: 'Teczka oceny po zmianie (`CaseDetail`).' })
  @ApiErrors(400, 403, 404, 409)
  patch(
    @Param('id') id: string,
    @Body({ schema: patchCaseSchema }) body: PatchCase,
  ): Promise<CaseDetail> {
    return this.cases.patch(id, body);
  }

  @Post('cases/:id/observations')
  @Roles('SUPERVISOR')
  @CASE_ID
  @ApiOperation({
    summary: 'Dodanie obserwacji (S-D-R)',
    description: 'Sytuacja, działanie, rezultat dla kryterium tej oceny.',
  })
  @ApiCreatedResponse({ description: 'Teczka oceny z nową obserwacją.' })
  @ApiErrors(400, 403, 404, 409)
  addObservation(
    @Param('id') id: string,
    @Body({ schema: observationSchema }) body: ObservationInput,
  ): Promise<CaseDetail> {
    return this.cases.addObservation(id, body);
  }

  @Post('cases/:id/actions')
  @Roles('SUPERVISOR', 'EMPLOYEE')
  @HttpCode(200)
  @CASE_ID
  @ApiOperation({
    summary: 'Akcja w przebiegu oceny',
    description:
      'Przejście do kolejnego etapu (np. podpis, przekazanie do zapoznania). Potwierdzenia `EMPLOYEE_ACK_*` wykonuje oceniany, pozostałe akcje oceniający.',
  })
  @ApiOkResponse({ description: 'Teczka oceny po akcji (`CaseDetail`).' })
  @ApiErrors(400, 403, 404, 409)
  action(
    @Param('id') id: string,
    @Body({ schema: actionSchema }) body: ActionInput,
  ): Promise<CaseDetail> {
    return this.cases.action(id, body.action);
  }

  /** Demo tool: any signed-in role may restore the seed. */
  @Post('demo/reset')
  @Can.Anyone()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Przywrócenie danych demonstracyjnych',
    description:
      'Przywraca oceny, konta, notatnik i rejestr kadrowy do stanu początkowego (także w bazie danych).',
  })
  @ApiOkResponse({ description: '`{ ok: true, today }`.' })
  async reset() {
    await this.cases.reset();
    await this.demoReset.run();
    return { ok: true, today: this.cases.today };
  }
}
