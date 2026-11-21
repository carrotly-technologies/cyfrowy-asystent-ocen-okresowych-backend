import { Module } from '@nestjs/common';
import { CompetencyModelController } from './competency-model.controller.js';
import { CompetencyModelService } from './competency-model.service.js';

@Module({
  controllers: [CompetencyModelController],
  providers: [CompetencyModelService],
  exports: [CompetencyModelService],
})
export class CompetencyModelModule {}
