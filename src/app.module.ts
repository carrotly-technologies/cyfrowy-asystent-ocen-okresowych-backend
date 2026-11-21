import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AuthorizationModule } from '@nestjs/authorization';
import { AdminModule } from './admin/admin.module.js';
import { AuthenticationRoot, AuthModule } from './auth/auth.module.js';
import { PolishAuthErrorsFilter } from './common/polish-auth-errors.filter.js';
import { AppConfigModule } from './config/app-config.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { AssessmentsModule } from './assessments/assessments.module.js';
import { CriteriaModule } from './criteria/criteria.module.js';
import { CasesModule } from './cases/cases.module.js';
import { CivilServiceGradesModule } from './civil-service-grades/civil-service-grades.module.js';
import { CorrectionsModule } from './corrections/corrections.module.js';
import { ExportModule } from './export/export.module.js';
import { DeadlinesModule } from './deadlines/deadlines.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DocsModule } from './docs/docs.module.js';
import { HealthModule } from './health/health.module.js';
import { HrModule } from './hr/hr.module.js';
import { JournalModule } from './journal/journal.module.js';
import { PartnerModule } from './partner/partner.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { SheetsModule } from './sheets/sheets.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot(),
    // Guard order: authentication (sets the user) before authorization.
    AuthenticationRoot,
    AuthorizationModule.forRoot(),
    AuthModule,
    HealthModule,
    AppConfigModule,
    CriteriaModule,
    SheetsModule,
    CivilServiceGradesModule,
    AssessmentsModule,
    CasesModule,
    HrModule,
    AssistantModule,
    DocsModule,
    AdminModule,
    CorrectionsModule,
    ExportModule,
    JournalModule,
    PartnerModule,
    EmployeesModule,
    NotificationsModule,
    DeadlinesModule,
  ],
  // Polish messages for the generic 401 / 403 of every route.
  providers: [{ provide: APP_FILTER, useClass: PolishAuthErrorsFilter }],
})
export class AppModule {}
