import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { CorrectionsController } from './corrections.controller.js';

@Module({ imports: [CasesModule], controllers: [CorrectionsController] })
export class CorrectionsModule {}
