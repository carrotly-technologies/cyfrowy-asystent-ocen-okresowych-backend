import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { DeadlinesController } from './deadlines.controller.js';
import { DeadlinesService } from './deadlines.service.js';

@Module({
  imports: [CasesModule, NotificationsModule],
  controllers: [DeadlinesController],
  providers: [DeadlinesService],
  exports: [DeadlinesService],
})
export class DeadlinesModule {}
