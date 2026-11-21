import { Test } from '@nestjs/testing';
import { CompetencyModelController } from './competency-model.controller.js';
import { CompetencyModelService } from './competency-model.service.js';

describe('CompetencyModelController', () => {
  let controller: CompetencyModelController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CompetencyModelController],
      providers: [CompetencyModelService],
    }).compile();
    controller = module.get(CompetencyModelController);
  });

  it('returns the model with 14 competencies and 49 indicators', () => {
    const model = controller.get();
    expect(model.instructions).toHaveLength(3);
    expect(model.scale.map((s) => s.points)).toEqual([1, 3, 5, 7, 9]);
    expect(model.competencies).toHaveLength(14);
    expect(model.competencies.flatMap((c) => c.indicators)).toHaveLength(49);
    for (const indicator of model.competencies.flatMap((c) => c.indicators)) {
      expect(Object.keys(indicator.levels).sort()).toEqual([
        '1',
        '3',
        '5',
        '7',
        '9',
      ]);
    }
  });
});
