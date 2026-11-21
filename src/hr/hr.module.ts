import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { HrController } from './hr.controller.js';
import { HrService } from './hr.service.js';

@Module({
  imports: [CasesModule],
  controllers: [HrController],
  providers: [HrService],
})
export class HrModule {}
