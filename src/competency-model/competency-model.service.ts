import { Injectable } from '@nestjs/common';
import { COMPETENCY_MODEL } from './data/model.data.js';
import type { Competency, CompetencyModel } from './competency-model.types.js';

@Injectable()
export class CompetencyModelService {
  private readonly byId = new Map(
    COMPETENCY_MODEL.competencies.map((c) => [c.id, c]),
  );

  getModel(): CompetencyModel {
    return COMPETENCY_MODEL;
  }

  findCompetency(id: string): Competency | undefined {
    return this.byId.get(id);
  }

  /** Label of a scale point ("Na poziomie oczekiwań" for 5), from the model. */
  scaleLabel(points: number): string | undefined {
    return COMPETENCY_MODEL.scale.find((s) => s.points === points)?.label;
  }
}
