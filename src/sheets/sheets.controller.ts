import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { SheetsService } from './sheets.service.js';
import type { Sheet } from './sheet.types.js';

@ApiTags('Słowniki')
@ApiBearerAuth()
@ApiErrors(401)
@Can.Anyone()
@Controller('sheets')
export class SheetsController {
  constructor(private readonly sheets: SheetsService) {}

  @Get()
  @ApiOperation({
    summary: 'Arkusze ocen A, B, C',
    description:
      'Kryteria obowiązkowe, skala, limit kryteriów dodatkowych i teksty wzoru arkusza (rozp. PRM z 4.04.2016).',
  })
  @ApiOkResponse({ description: 'Lista arkuszy.' })
  findAll(): readonly Sheet[] {
    return this.sheets.findAll();
  }
}
