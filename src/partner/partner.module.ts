import { Module } from '@nestjs/common';
import { LlmClient } from '../assistant/llm.client.js';
import { CasesModule } from '../cases/cases.module.js';
import { DATABASE, type Database } from '../database/database.js';
import { DemoModule } from '../demo/demo.module.js';
import { JournalModule } from '../journal/journal.module.js';
import { PartnerController, PulseController } from './partner.controller.js';
import { PartnerService } from './partner.service.js';
import { PostgresPulseRepository } from './postgres-pulse.repository.js';
import {
  InMemoryPulseRepository,
  PulseRepository,
} from './pulse.repository.js';

@Module({
  imports: [CasesModule, DemoModule, JournalModule],
  controllers: [PulseController, PartnerController],
  providers: [
    {
      provide: PulseRepository,
      inject: [DATABASE],
      useFactory: (db: Database | null): PulseRepository =>
        db ? new PostgresPulseRepository(db) : new InMemoryPulseRepository(),
    },
    LlmClient,
    PartnerService,
  ],
})
export class PartnerModule {}
