import { Module } from '@nestjs/common';
import { CompetencyModelModule } from '../competency-model/competency-model.module.js';
import { SheetsModule } from '../sheets/sheets.module.js';
import { AssessmentsController } from './assessments.controller.js';
import { AssessmentsService } from './assessments.service.js';

@Module({
  imports: [CompetencyModelModule, SheetsModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService],
})
export class AssessmentsModule {}
