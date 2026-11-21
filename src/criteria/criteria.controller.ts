import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { CRITERIA_CATALOGUE } from './data/criteria.data.js';
import type { CriteriaCatalogue } from './criteria.types.js';

/** GET /api/criteria: the catalogue of criteria (zał. nr 1 rozp. 2016) and the scale. */
@ApiTags('Słowniki')
@ApiBearerAuth()
@ApiErrors(401)
@Can.Anyone()
@Controller('criteria')
export class CriteriaController {
  @Get()
  @ApiOperation({
    summary: 'Wykaz kryteriów oceny',
    description:
      'Kryteria z załącznika nr 1 do rozp. PRM z 4.04.2016 i skala ocen.',
  })
  @ApiOkResponse({ description: '`{ title, legalBasis, scale, criteria }`.' })
  get(): CriteriaCatalogue {
    return CRITERIA_CATALOGUE;
  }
}
