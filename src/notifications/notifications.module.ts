import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { DATABASE, type Database } from '../database/database.js';
import { DemoModule } from '../demo/demo.module.js';
import { Mailer } from './mailer.js';
import { NotificationsController } from './notifications.controller.js';
import {
  InMemoryNotificationsRepository,
  NotificationsRepository,
} from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';
import { PostgresNotificationsRepository } from './postgres-notifications.repository.js';
import { RemindersService } from './reminders.service.js';

@Module({
  imports: [CasesModule, DemoModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: NotificationsRepository,
      inject: [DATABASE],
      useFactory: (db: Database | null): NotificationsRepository =>
        db
          ? new PostgresNotificationsRepository(db)
          : new InMemoryNotificationsRepository(),
    },
    Mailer,
    NotificationsService,
    RemindersService,
  ],
  exports: [NotificationsService, RemindersService],
})
export class NotificationsModule {}
