import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CRITERIA_CATALOGUE,
  knownCriterionName,
} from '../criteria/data/criteria.data.js';
import { SheetsService } from '../sheets/sheets.service.js';
import type { Sheet } from '../sheets/sheet.types.js';
import type { EvaluateRequest } from './assessments.schemas.js';
import {
  evaluate,
  type EvaluateResult,
  validateEvaluation,
} from './evaluate.rules.js';

@Injectable()
export class AssessmentsService {
  constructor(private readonly sheets: SheetsService) {}

  evaluate(request: EvaluateRequest): EvaluateResult {
    const sheet = this.sheet(request.sheetId);
    const errors = validateEvaluation(
      sheet,
      request.scores,
      knownCriterionName,
    );
    if (errors.length > 0) throw new BadRequestException(errors);
    return evaluate(
      sheet,
      request.scores,
      knownCriterionName,
      CRITERIA_CATALOGUE.scale,
    );
  }

  private sheet(id: string): Sheet {
    const sheet = this.sheets.findById(id);
    if (!sheet) throw new BadRequestException([`Nieznany arkusz „${id}”.`]);
    return sheet;
  }
}
