import { BadRequestException, Injectable } from '@nestjs/common';
import { CompetencyModelService } from '../competency-model/competency-model.service.js';
import type { ScalePoints } from '../competency-model/competency-model.types.js';
import { SheetsService } from '../sheets/sheets.service.js';
import type { Sheet } from '../sheets/sheet.types.js';
import { displayName } from './assessment.format.js';
import type {
  EvaluateRequest,
  SuggestLevelRequest,
} from './assessments.schemas.js';
import {
  evaluate,
  type EvaluateResult,
  validateEvaluation,
} from './evaluate.rules.js';
import {
  suggestLevel,
  type SuggestLevelResult,
  validateSuggestLevel,
} from './suggest-level.rules.js';

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly competencyModel: CompetencyModelService,
    private readonly sheets: SheetsService,
  ) {}

  suggestLevel(request: SuggestLevelRequest): SuggestLevelResult {
    const sheet = this.sheet(request.sheetId);
    const competency = this.competencyModel.findCompetency(
      request.competencyId,
    );
    const ratings = request.indicatorRatings.map((r) => ({
      indicatorId: r.indicatorId,
      points: r.points as ScalePoints | null,
    }));
    const errors = validateSuggestLevel(
      sheet,
      request.competencyId,
      competency,
      ratings,
    );
    if (errors.length > 0 || !competency) throw new BadRequestException(errors);
    return suggestLevel(
      sheet,
      competency,
      ratings,
      this.competencyModel.getModel().scale,
    );
  }

  evaluate(request: EvaluateRequest): EvaluateResult {
    const sheet = this.sheet(request.sheetId);
    const criterionName = (id: string) => {
      const competency = this.competencyModel.findCompetency(id);
      return competency ? displayName(competency.name) : undefined;
    };
    const errors = validateEvaluation(
      sheet,
      request.scores,
      request.firstAssessment,
      criterionName,
    );
    if (errors.length > 0) throw new BadRequestException(errors);
    return evaluate(
      sheet,
      request.scores,
      request.firstAssessment,
      criterionName,
      this.competencyModel.getModel().scale,
    );
  }

  private sheet(id: string): Sheet {
    const sheet = this.sheets.findById(id);
    if (!sheet) throw new BadRequestException([`Nieznany arkusz „${id}”.`]);
    return sheet;
  }
}
