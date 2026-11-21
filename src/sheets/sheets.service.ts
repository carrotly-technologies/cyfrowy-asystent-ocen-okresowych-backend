import { Injectable } from '@nestjs/common';
import { SHEETS } from './sheets.data.js';
import type { Sheet } from './sheet.types.js';

@Injectable()
export class SheetsService {
  findAll(): readonly Sheet[] {
    return SHEETS;
  }

  findById(id: string): Sheet | undefined {
    return SHEETS.find((s) => s.id === id);
  }
}
