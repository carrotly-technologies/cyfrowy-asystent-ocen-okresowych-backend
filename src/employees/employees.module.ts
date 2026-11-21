import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { DATABASE, type Database } from '../database/database.js';
import { DemoModule } from '../demo/demo.module.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesRepository } from './employees.repository.js';
import { EmployeesService } from './employees.service.js';
import { InMemoryEmployeesRepository } from './in-memory-employees.repository.js';
import { PostgresEmployeesRepository } from './postgres-employees.repository.js';

@Module({
  imports: [CasesModule, DemoModule],
  controllers: [EmployeesController],
  providers: [
    {
      provide: EmployeesRepository,
      inject: [DATABASE],
      useFactory: (db: Database | null): EmployeesRepository =>
        db
          ? new PostgresEmployeesRepository(db)
          : new InMemoryEmployeesRepository(),
    },
    EmployeesService,
  ],
})
export class EmployeesModule {}
