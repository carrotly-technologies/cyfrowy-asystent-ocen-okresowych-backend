import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SheetsService } from '../sheets/sheets.service.js';
import { AssessmentsService } from './assessments.service.js';

describe('AssessmentsService', () => {
  let service: AssessmentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AssessmentsService, SheetsService],
    }).compile();
    service = module.get(AssessmentsService);
  });

  it('evaluates a complete sheet C', () => {
    const result = service.evaluate({
      sheetId: 'C',
      scores: [
        'wykorzystywanie_wiedzy',
        'rzetelnosc',
        'organizacja_pracy',
        'wspolpraca',
        'komunikacja',
      ].map((criterionId) => ({ criterionId, points: 7 })),
    });
    expect(result.result).toBe('POSITIVE');
  });

  it('throws 400 listing every domain error of an evaluation', () => {
    try {
      service.evaluate({
        sheetId: 'C',
        scores: [{ criterionId: 'rzetelnosc', points: 5 }],
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const body = (error as BadRequestException).getResponse() as {
        message: string[];
      };
      expect(body.message).toHaveLength(4); // 4 missing mandatory criteria
    }
  });
});
