import { Test } from '@nestjs/testing';
import { CRITERIA_CATALOGUE } from '../criteria/data/criteria.data.js';
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

  it('returns A, B and C with the 1–9 scale and up to 3 additional criteria', () => {
    const sheets = controller.findAll();
    expect(sheets.map((s) => s.id)).toEqual(['A', 'B', 'C']);
    expect(sheets.find((s) => s.id === 'A')?.mandatoryCriteria).toHaveLength(6);
    for (const sheet of sheets) {
      expect(sheet.scale).toEqual([1, 3, 5, 7, 9]);
      expect(sheet.maxAdditionalCriteria).toBe(3);
      expect(sheet.template.annex).toMatch(/Załącznik nr [234]/);
    }
  });

  it('references only criteria from the catalogue', () => {
    const ids = new Set(CRITERIA_CATALOGUE.criteria.map((c) => c.id));
    for (const sheet of controller.findAll()) {
      for (const id of sheet.mandatoryCriteria) expect(ids.has(id)).toBe(true);
    }
  });
});
