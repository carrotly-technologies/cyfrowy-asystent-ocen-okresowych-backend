import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { ExportController } from './export.controller.js';

@Module({ imports: [CasesModule], controllers: [ExportController] })
export class ExportModule {}
