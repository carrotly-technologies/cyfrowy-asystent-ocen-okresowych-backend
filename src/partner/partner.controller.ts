import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import {
  type PartnerAskInput,
  partnerAskSchema,
  type PulseShareInput,
  pulseShareSchema,
  type PulseSubmitInput,
  pulseSubmitSchema,
} from './partner.schemas.js';
import { PartnerService } from './partner.service.js';

/** Pulse survey: the employee fills and reads only their own responses. */
@ApiTags('Ankieta pulsu')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Controller('pulse')
export class PulseController {
  constructor(private readonly partner: PartnerService) {}

  @Get('questions')
  @ApiOperation({ summary: 'Pytania ankiety pulsu' })
  @ApiOkResponse({ description: 'Lista pytań.' })
  @Roles('EMPLOYEE', 'SUPERVISOR', 'HR', 'ADMIN')
  questions() {
    return this.partner.questions();
  }

  @Get('me')
  @ApiOperation({
    summary: 'Moje odpowiedzi w ankiecie pulsu',
    description: 'Tylko EMPLOYEE, tylko własne odpowiedzi.',
  })
  @ApiOkResponse({ description: 'Odpowiedzi ocenianego.' })
  @Roles('EMPLOYEE')
  me() {
    return this.partner.myPulse();
  }

  @Post()
  @ApiOperation({ summary: 'Wypełnienie ankiety pulsu' })
  @ApiCreatedResponse({ description: 'Zapisana odpowiedź.' })
  @ApiErrors(400)
  @Roles('EMPLOYEE')
  submit(@Body({ schema: pulseSubmitSchema }) body: PulseSubmitInput) {
    return this.partner.submit(body);
  }

  @Patch(':id/share')
  @ApiParam({ name: 'id', description: 'Identyfikator odpowiedzi.' })
  @ApiOperation({ summary: 'Udostępnienie komentarza przełożonemu' })
  @ApiOkResponse({ description: 'Odpowiedź po zmianie.' })
  @ApiErrors(400, 404)
  @Roles('EMPLOYEE')
  share(
    @Param('id') id: string,
    @Body({ schema: pulseShareSchema }) body: PulseShareInput,
  ) {
    return this.partner.setShare(id, body.shareComment);
  }
}

/** HR partner panel of a supervisor (own team only). */
@ApiTags('Wirtualny asystent HR')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Controller('partner')
@Roles('SUPERVISOR')
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get('team')
  @ApiOperation({
    summary: 'Sygnały dla zespołu przełożonego',
    description: 'Tylko SUPERVISOR, tylko własny zespół. Sygnały są doradcze.',
  })
  @ApiOkResponse({ description: 'Zespół z sygnałami.' })
  team() {
    return this.partner.team();
  }

  @Get('people/:personId')
  @ApiParam({
    name: 'personId',
    description: 'Identyfikator pracownika, np. `p-nowak`.',
  })
  @ApiOperation({ summary: 'Sygnały dla pracownika' })
  @ApiOkResponse({ description: 'Sygnały i kontekst pracy.' })
  @ApiErrors(404)
  person(@Param('personId') personId: string) {
    return this.partner.person(personId);
  }

  @Get('cases/:caseId/hints')
  @ApiParam({ name: 'caseId', description: 'Identyfikator teczki oceny.' })
  @ApiOperation({
    summary: 'Wskazówki do oceny',
    description: 'Podpowiedzi doradcze; decyzja należy do przełożonego.',
  })
  @ApiOkResponse({ description: 'Lista wskazówek.' })
  @ApiErrors(404)
  hints(@Param('caseId') caseId: string) {
    return this.partner.hints(caseId);
  }

  @Post('ask')
  @ApiOperation({
    summary: 'Pytanie do wirtualnego asystenta HR',
    description: 'Pytanie zanonimizowane przed wysłaniem do modelu językowego.',
  })
  @ApiOkResponse({ description: 'Odpowiedź.' })
  @ApiErrors(400)
  @HttpCode(200)
  ask(@Body({ schema: partnerAskSchema }) body: PartnerAskInput) {
    return this.partner.ask(body);
  }
}
