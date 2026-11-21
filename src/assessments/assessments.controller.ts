import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import { Can } from '@nestjs/authorization';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { type EvaluateRequest, evaluateSchema } from './assessments.schemas.js';
import { AssessmentsService } from './assessments.service.js';
import type { EvaluateResult } from './evaluate.rules.js';

@ApiTags('Słowniki')
@ApiBearerAuth()
@ApiErrors(401)
@Can.Anyone()
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Post('evaluate')
  @ApiOperation({
    summary: 'Wyliczenie wyniku oceny',
    description:
      'Średnia, poziom i wynik (pozytywna/negatywna) z uzasadnieniem i podstawą prawną. Wyliczenie pomocnicze: ocenę ustala oceniający.',
  })
  @ApiOkResponse({
    description: '`{ average, averageDisplay, level, result, reasons }`.',
  })
  @ApiErrors(400)
  @HttpCode(200)
  evaluate(
    @Body({ schema: evaluateSchema }) body: EvaluateRequest,
  ): EvaluateResult {
    return this.assessments.evaluate(body);
  }
}
