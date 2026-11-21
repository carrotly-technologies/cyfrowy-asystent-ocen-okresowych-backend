import { Module } from '@nestjs/common';
import { DATABASE, type Database } from '../database/database.js';
import { DemoModule } from '../demo/demo.module.js';
import { AppealsController } from './appeals.controller.js';
import { AppealsService } from './appeals.service.js';
import { CaseRepository } from './case.repository.js';
import { CaseStore } from './case-store.service.js';
import { CasesController } from './cases.controller.js';
import { CasesService } from './cases.service.js';
import { InMemoryCaseRepository } from './in-memory-case.repository.js';
import { PostgresCaseRepository } from './postgres-case.repository.js';

@Module({
  imports: [DemoModule],
  controllers: [CasesController, AppealsController],
  providers: [
    {
      provide: CaseRepository,
      inject: [DATABASE],
      useFactory: (db: Database | null): CaseRepository =>
        db ? new PostgresCaseRepository(db) : new InMemoryCaseRepository(),
    },
    CaseStore,
    CasesService,
    AppealsService,
  ],
  exports: [CasesService],
})
export class CasesModule {}
