import { Test } from '@nestjs/testing';
import { COMPETENCY_MODEL } from '../competency-model/data/model.data.js';
import { SheetsController } from './sheets.controller.js';
import { SheetsService } from './sheets.service.js';

describe('SheetsController', () => {
  let controller: SheetsController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [SheetsController],
      providers: [SheetsService],
    }).compile();
    controller = module.get(SheetsController);
  });

  it('returns A, B, C and FIRST with the right scales and limits', () => {
    const sheets = controller.findAll();
    expect(sheets.map((s) => s.id)).toEqual(['A', 'B', 'C', 'FIRST']);
    expect(sheets.find((s) => s.id === 'A')?.mandatoryCriteria).toHaveLength(6);
    const first = sheets.find((s) => s.id === 'FIRST');
    expect(first).toMatchObject({
      kind: 'FIRST',
      scale: [3, 5, 7],
      maxAdditionalCriteria: 0,
      mandatoryCriteria: [
        'rzetelnosc',
        'wykorzystywanie_wiedzy',
        'organizacja_pracy',
        'komunikacja',
        'wspolpraca',
      ],
    });
  });

  it('references only known competencies', () => {
    const ids = new Set(COMPETENCY_MODEL.competencies.map((c) => c.id));
    for (const sheet of controller.findAll()) {
      for (const id of sheet.mandatoryCriteria) expect(ids.has(id)).toBe(true);
    }
  });
});
