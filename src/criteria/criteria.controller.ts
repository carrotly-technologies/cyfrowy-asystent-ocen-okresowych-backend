import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { CRITERIA_CATALOGUE } from './data/criteria.data.js';
import type { CriteriaCatalogue } from './criteria.types.js';

/** GET /api/criteria: the catalogue of criteria (zał. nr 1 rozp. 2016) and the scale. */
@Can.Anyone()
@Controller('criteria')
export class CriteriaController {
  @Get()
  get(): CriteriaCatalogue {
    return CRITERIA_CATALOGUE;
  }
}
