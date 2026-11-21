import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { LlmClient } from './llm.client.js';

@Module({
  imports: [CasesModule],
  controllers: [AssistantController],
  providers: [AssistantService, LlmClient],
})
export class AssistantModule {}
