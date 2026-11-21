import { Module } from '@nestjs/common';
import { SheetsController } from './sheets.controller.js';
import { SheetsService } from './sheets.service.js';

@Module({
  controllers: [SheetsController],
  providers: [SheetsService],
  exports: [SheetsService],
})
export class SheetsModule {}
