import { Can } from '@nestjs/authorization';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { type EvaluateRequest, evaluateSchema } from './assessments.schemas.js';
import { AssessmentsService } from './assessments.service.js';
import type { EvaluateResult } from './evaluate.rules.js';

@Can.Anyone()
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Post('evaluate')
  @HttpCode(200)
  evaluate(
    @Body({ schema: evaluateSchema }) body: EvaluateRequest,
  ): EvaluateResult {
    return this.assessments.evaluate(body);
  }
}
