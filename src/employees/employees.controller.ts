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
import { Roles } from '../auth/roles.decorator.js';
import {
  type AbsenceInput,
  absenceSchema,
  type EmployeeInput,
  type EmployeePatch,
  employeePatchSchema,
  employeeSchema,
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
@Controller()
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get('employees')
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  list(@Query() query: ListQuery) {
    return this.employees.list(query);
  }

  @Get('employees/evaluators')
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  evaluators() {
    return this.employees.evaluators();
  }

  @Get('employees/absence-types')
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  absenceTypes() {
    return this.employees.absenceTypes();
  }

  @Get('employees/export.csv')
  @Roles('HR', 'ADMIN')
  @Header('Content-Type', CSV)
  @Header(
    'Content-Disposition',
    'attachment; filename="kartoteka-pracownikow.csv"',
  )
  exportEmployees() {
    return this.employees.employeesCsv();
  }

  @Post('employees/history/import')
  @Roles('HR', 'ADMIN')
  @HttpCode(200)
  importHistory(
    @Body({ schema: historyImportSchema }) body: HistoryImportInput,
  ) {
    return this.employees.importHistory(body);
  }

  @Post('employees')
  @Roles('HR', 'ADMIN')
  create(@Body({ schema: employeeSchema }) body: EmployeeInput) {
    return this.employees.create(body);
  }

  @Get('employees/:id')
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  get(@Param('id') id: string) {
    return this.employees.get(id);
  }

  @Patch('employees/:id')
  @Roles('HR', 'ADMIN')
  update(
    @Param('id') id: string,
    @Body({ schema: employeePatchSchema }) body: EmployeePatch,
  ) {
    return this.employees.update(id, body);
  }

  @Delete('employees/:id')
  @Roles('HR', 'ADMIN')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.employees.remove(id);
  }

  @Post('employees/:id/cycles')
  @Roles('HR', 'ADMIN')
  startCycle(@Param('id') id: string) {
    return this.employees.startCycle(id);
  }

  @Get('employees/:id/history')
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  history(@Param('id') id: string) {
    return this.employees.history(id);
  }

  @Get('employees/:id/absences')
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  absences(@Param('id') id: string) {
    return this.employees.absences(id);
  }

  @Post('employees/:id/absences')
  @Roles('HR', 'ADMIN')
  addAbsence(
    @Param('id') id: string,
    @Body({ schema: absenceSchema }) body: AbsenceInput,
  ) {
    return this.employees.addAbsence(id, body);
  }

  @Delete('employees/:id/absences/:absenceId')
  @Roles('HR', 'ADMIN')
  @HttpCode(204)
  removeAbsence(
    @Param('id') id: string,
    @Param('absenceId') absenceId: string,
  ) {
    return this.employees.removeAbsence(id, absenceId);
  }

  @Get('substitutions')
  @Roles('HR', 'ADMIN', 'SUPERVISOR')
  substitutions() {
    return this.employees.substitutions();
  }

  @Post('substitutions')
  @Roles('HR', 'ADMIN')
  addSubstitution(
    @Body({ schema: substitutionSchema }) body: SubstitutionInput,
  ) {
    return this.employees.addSubstitution(body);
  }

  @Delete('substitutions/:id')
  @Roles('HR', 'ADMIN')
  @HttpCode(204)
  removeSubstitution(@Param('id') id: string) {
    return this.employees.removeSubstitution(id);
  }

  @Get('statistics')
  @Roles('HR', 'ADMIN', 'DIRECTOR')
  statistics(@Query('unit') unit?: string) {
    return this.employees.statistics(unit || undefined);
  }

  @Get('statistics/export.csv')
  @Roles('HR', 'ADMIN', 'DIRECTOR')
  @Header('Content-Type', CSV)
  @Header('Content-Disposition', 'attachment; filename="statystyki-ocen.csv"')
  statisticsCsv(@Query('unit') unit?: string) {
    return this.employees.statisticsCsv(unit || undefined);
  }
}
