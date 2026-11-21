import { Module } from '@nestjs/common';
import { DemoModule } from '../demo/demo.module.js';
import { AppealsController } from './appeals.controller.js';
import { AppealsService } from './appeals.service.js';
import { CaseStore } from './case-store.service.js';
import { CasesController } from './cases.controller.js';
import { CasesService } from './cases.service.js';

@Module({
  imports: [DemoModule],
  controllers: [CasesController, AppealsController],
  providers: [CaseStore, CasesService, AppealsService],
  exports: [CasesService],
})
export class CasesModule {}
