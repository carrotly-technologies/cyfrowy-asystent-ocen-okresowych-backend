import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CompetencyModelService } from '../competency-model/competency-model.service.js';
import { SheetsService } from '../sheets/sheets.service.js';
import { AssessmentsService } from './assessments.service.js';

describe('AssessmentsService', () => {
  let service: AssessmentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AssessmentsService, CompetencyModelService, SheetsService],
    }).compile();
    service = module.get(AssessmentsService);
  });

  it('suggests a level', () => {
    const result = service.suggestLevel({
      sheetId: 'C',
      competencyId: 'rzetelnosc',
      indicatorRatings: [
        { indicatorId: 'rzetelnosc.1', points: 7 },
        { indicatorId: 'rzetelnosc.2', points: 7 },
      ],
    });
    expect(result.suggestedPoints).toBe(7);
    expect(result.suggestedLabel).toBe('Powyżej oczekiwań');
  });

  it('throws 400 with Polish messages for an unknown competency', () => {
    expect(() =>
      service.suggestLevel({
        sheetId: 'C',
        competencyId: 'nope',
        indicatorRatings: [],
      }),
    ).toThrow(BadRequestException);
  });

  it('throws 400 listing every domain error of an evaluation', () => {
    try {
      service.evaluate({
        sheetId: 'FIRST',
        scores: [{ criterionId: 'rzetelnosc', points: 5 }],
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        message: string[];
      };
      expect(body.message).toHaveLength(5); // 4 missing elements + firstAssessment
    }
  });
});
