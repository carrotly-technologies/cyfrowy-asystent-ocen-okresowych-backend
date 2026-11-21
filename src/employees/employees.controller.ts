import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator.js';
import {
  type AbsenceInput,
  absenceSchema,
  type EmployeeInput,
  type EmployeePatch,
  employeePatchSchema,
  employeeSchema,
  type EmployeesImportInput,
  employeesImportSchema,
  type HistoryImportInput,
  historyImportSchema,
  type SubstitutionInput,
  substitutionSchema,
} from './employees.schemas.js';
import { EmployeesService, type ListQuery } from './employees.service.js';

const CSV = 'text/csv; charset=utf-8';

/**
 * HR register. Reads: HR, ADMIN, and SUPERVISOR (own team only, read-only).
 * Writes: HR and ADMIN. Statistics: HR, ADMIN and DIRECTOR (dyrektor generalny).
 */
@ApiTags('Kartoteka pracowników (kadry)')
@ApiBearerAuth()
@Controller()
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get('employees')
  @ApiOperation({ summary: 'Rejestr pracowników' })
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  @ApiOperation({
    summary: 'Kartoteka pracowników (wyszukiwanie, filtry, sortowanie)',
  })
  list(@Query() query: ListQuery) {
    return this.employees.list(query);
  }

  @Get('employees/evaluators')
  @ApiOperation({ summary: 'Lista oceniających' })
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Oceniający do wyboru (podległość służbowa)' })
  evaluators() {
    return this.employees.evaluators();
  }

  @Get('employees/units')
  @ApiOperation({
    summary: 'Komórki organizacyjne (do wyboru w formularzu kartoteki)',
  })
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  units() {
    return this.employees.units();
  }

  @Get('employees/absence-types')
  @ApiOperation({ summary: 'Rodzaje nieobecności' })
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Rodzaje nieobecności' })
  absenceTypes() {
    return this.employees.absenceTypes();
  }

  @Get('employees/export.csv')
  @ApiOperation({ summary: 'Eksport rejestru pracowników do CSV' })
  @Roles('HR', 'ADMIN')
  @Header('Content-Type', CSV)
  @Header(
    'Content-Disposition',
    'attachment; filename="kartoteka-pracownikow.csv"',
  )
  @ApiOperation({ summary: 'Eksport kartoteki do CSV' })
  exportEmployees() {
    return this.employees.employeesCsv();
  }

  @Post('employees/history/import')
  @ApiOperation({ summary: 'Import historii ocen' })
  @Roles('HR')
  @HttpCode(200)
  @ApiOperation({ summary: 'Import ocen historycznych z CSV' })
  importHistory(
    @Body({ schema: historyImportSchema }) body: HistoryImportInput,
  ) {
    return this.employees.importHistory(body);
  }

  @Post('employees/import')
  @Roles('HR')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Import listy pracowników z CSV (podgląd albo zapis)',
    description:
      'Wzór: `docs/import/pracownicy-wzor.csv`. Błędne wiersze nie przerywają importu poprawnych; raport podaje numer wiersza i powód. `dryRun: true` niczego nie zapisuje.',
  })
  importEmployees(
    @Body({ schema: employeesImportSchema }) body: EmployeesImportInput,
  ) {
    return this.employees.importEmployees(body);
  }

  @Post('employees')
  @ApiOperation({ summary: 'Dodanie pracownika' })
  @Roles('HR')
  @ApiOperation({ summary: 'Dodanie pracownika do kartoteki' })
  create(@Body({ schema: employeeSchema }) body: EmployeeInput) {
    return this.employees.create(body);
  }

  @Get('employees/:id')
  @ApiOperation({ summary: 'Dane pracownika' })
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Dane pracownika' })
  get(@Param('id') id: string) {
    return this.employees.get(id);
  }

  @Patch('employees/:id')
  @ApiOperation({ summary: 'Zmiana danych pracownika' })
  @Roles('HR')
  @ApiOperation({ summary: 'Edycja danych pracownika lub zmiana podległości' })
  update(
    @Param('id') id: string,
    @Body({ schema: employeePatchSchema }) body: EmployeePatch,
  ) {
    return this.employees.update(id, body);
  }

  @Delete('employees/:id')
  // HR; ADMIN only to archive before the retention ends, with a reason.
  @Roles('HR', 'ADMIN')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Archiwizacja (anonimizacja) danych pracownika',
    description:
      'Po upływie okresu przechowywania akt osobowych (10 lat od ostatniej oceny, art. 94 pkt 9b KP). Wcześniej tylko ADMIN z podanym powodem: `?reason=...`.',
  })
  remove(@Param('id') id: string, @Query('reason') reason?: string) {
    return this.employees.remove(id, reason);
  }

  @Post('employees/:id/cycles')
  @ApiOperation({ summary: 'Rozpoczęcie nowego cyklu oceny' })
  @Roles('HR')
  @ApiOperation({ summary: 'Rozpoczęcie nowego cyklu oceny okresowej' })
  startCycle(@Param('id') id: string) {
    return this.employees.startCycle(id);
  }

  @Get('employees/:id/history')
  @ApiOperation({ summary: 'Historia ocen pracownika' })
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Historia ocen pracownika' })
  history(@Param('id') id: string) {
    return this.employees.history(id);
  }

  @Get('employees/:id/absences')
  @ApiOperation({ summary: 'Nieobecności pracownika' })
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Nieobecności pracownika i okresy ciągłe' })
  absences(@Param('id') id: string) {
    return this.employees.absences(id);
  }

  @Post('employees/:id/absences')
  @ApiOperation({ summary: 'Dodanie nieobecności' })
  @Roles('HR')
  @ApiOperation({ summary: 'Dodanie nieobecności' })
  addAbsence(
    @Param('id') id: string,
    @Body({ schema: absenceSchema }) body: AbsenceInput,
  ) {
    return this.employees.addAbsence(id, body);
  }

  @Delete('employees/:id/absences/:absenceId')
  @ApiOperation({ summary: 'Usunięcie nieobecności' })
  @Roles('HR')
  @HttpCode(204)
  @ApiOperation({ summary: 'Usunięcie nieobecności' })
  removeAbsence(
    @Param('id') id: string,
    @Param('absenceId') absenceId: string,
  ) {
    return this.employees.removeAbsence(id, absenceId);
  }

  @Get('substitutions')
  @ApiOperation({ summary: 'Zastępstwa oceniających' })
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Zastępstwa oceniających' })
  substitutions() {
    return this.employees.substitutions();
  }

  @Post('substitutions')
  @ApiOperation({ summary: 'Dodanie zastępstwa' })
  @Roles('HR')
  @ApiOperation({ summary: 'Dodanie zastępstwa' })
  addSubstitution(
    @Body({ schema: substitutionSchema }) body: SubstitutionInput,
  ) {
    return this.employees.addSubstitution(body);
  }

  @Delete('substitutions/:id')
  @ApiOperation({ summary: 'Usunięcie zastępstwa' })
  @Roles('HR')
  @HttpCode(204)
  @ApiOperation({ summary: 'Usunięcie zastępstwa' })
  removeSubstitution(@Param('id') id: string) {
    return this.employees.removeSubstitution(id);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Statystyki ocen okresowych' })
  @Roles('HR', 'ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Statystyki ocen okresowych' })
  statistics(@Query('unit') unit?: string) {
    return this.employees.statistics(unit || undefined);
  }

  @Get('statistics/export.csv')
  @ApiOperation({ summary: 'Eksport statystyk do CSV' })
  @Roles('HR', 'ADMIN', 'DIRECTOR')
  @Header('Content-Type', CSV)
  @Header('Content-Disposition', 'attachment; filename="statystyki-ocen.csv"')
  @ApiOperation({ summary: 'Eksport statystyk do CSV' })
  statisticsCsv(@Query('unit') unit?: string) {
    return this.employees.statisticsCsv(unit || undefined);
  }
}
