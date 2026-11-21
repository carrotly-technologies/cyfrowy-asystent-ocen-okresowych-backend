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
@Controller('pulse')
export class PulseController {
  constructor(private readonly partner: PartnerService) {}

  @Get('questions')
  @Roles('EMPLOYEE', 'SUPERVISOR', 'HR', 'ADMIN')
  questions() {
    return this.partner.questions();
  }

  @Get('me')
  @Roles('EMPLOYEE')
  me() {
    return this.partner.myPulse();
  }

  @Post()
  @Roles('EMPLOYEE')
  submit(@Body({ schema: pulseSubmitSchema }) body: PulseSubmitInput) {
    return this.partner.submit(body);
  }

  @Patch(':id/share')
  @Roles('EMPLOYEE')
  share(
    @Param('id') id: string,
    @Body({ schema: pulseShareSchema }) body: PulseShareInput,
  ) {
    return this.partner.setShare(id, body.shareComment);
  }
}

/** HR partner panel of a supervisor (own team only). */
@Controller('partner')
@Roles('SUPERVISOR')
export class PartnerController {
  constructor(private readonly partner: PartnerService) {}

  @Get('team')
  team() {
    return this.partner.team();
  }

  @Get('people/:personId')
  person(@Param('personId') personId: string) {
    return this.partner.person(personId);
  }

  @Get('cases/:caseId/hints')
  hints(@Param('caseId') caseId: string) {
    return this.partner.hints(caseId);
  }

  @Post('ask')
  @HttpCode(200)
  ask(@Body({ schema: partnerAskSchema }) body: PartnerAskInput) {
    return this.partner.ask(body);
  }
}
