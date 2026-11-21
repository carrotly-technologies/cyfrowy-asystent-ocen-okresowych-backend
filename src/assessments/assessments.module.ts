import { Module } from '@nestjs/common';
import { SheetsModule } from '../sheets/sheets.module.js';
import { AssessmentsController } from './assessments.controller.js';
import { AssessmentsService } from './assessments.service.js';

@Module({
  imports: [SheetsModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService],
})
export class AssessmentsModule {}
