import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import { Roles } from '../auth/roles.decorator.js';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  type RemindersInput,
  remindersSchema,
} from '../cases/cases.schemas.js';
import { HrService } from './hr.service.js';

@ApiTags('Kadry (HR)')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Controller('hr')
@Roles('HR')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Monitoring ocen w urzędzie',
    description:
      'Liczniki i wszystkie oceny z oceniającym i ostatnim przypomnieniem. Tylko HR.',
  })
  @ApiOkResponse({ description: 'Podsumowanie i lista ocen.' })
  overview() {
    return this.hr.overview();
  }

  @Post('reminders')
  @ApiOperation({
    summary: 'Przypomnienia o terminach',
    description:
      'Symulowane przypomnienia (`{ caseIds }`), zapisywane w historii oceny.',
  })
  @ApiOkResponse({ description: 'Wynik wysłania przypomnień.' })
  @ApiErrors(400)
  @HttpCode(200)
  remind(@Body({ schema: remindersSchema }) body: RemindersInput) {
    return this.hr.remind(body.caseIds);
  }
}
