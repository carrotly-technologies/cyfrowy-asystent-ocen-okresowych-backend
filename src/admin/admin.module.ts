import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module.js';
import { AccountsService } from './accounts.service.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [EmployeesModule],
  controllers: [AdminController],
  providers: [AccountsService],
})
export class AdminModule {}
