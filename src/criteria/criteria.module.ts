import { Module } from '@nestjs/common';
import { CriteriaController } from './criteria.controller.js';

@Module({ controllers: [CriteriaController] })
export class CriteriaModule {}
