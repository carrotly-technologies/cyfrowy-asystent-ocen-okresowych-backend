import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssessmentsModule } from './assessments/assessments.module.js';
import { CompetencyModelModule } from './competency-model/competency-model.module.js';
import { CasesModule } from './cases/cases.module.js';
import { HealthModule } from './health/health.module.js';
import { HrModule } from './hr/hr.module.js';
import { OspModule } from './osp/osp.module.js';
import { SheetsModule } from './sheets/sheets.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    CompetencyModelModule,
    SheetsModule,
    AssessmentsModule,
    OspModule,
    CasesModule,
    HrModule,
  ],
})
export class AppModule {}
