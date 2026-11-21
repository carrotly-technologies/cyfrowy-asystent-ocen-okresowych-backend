import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { CaseAction, CaseDetail } from './case.types.js';
import {
  type ActionInput,
  actionSchema,
  type ObservationInput,
  observationSchema,
  type PatchCase,
  patchCaseSchema,
} from './cases.schemas.js';
import { CasesService } from './cases.service.js';

@Controller()
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get('me')
  me() {
    return this.cases.me();
  }

  @Get('team')
  team() {
    return this.cases.team();
  }

  @Get('cases/:id')
  findOne(@Param('id') id: string): CaseDetail {
    return this.cases.detail(id);
  }

  @Patch('cases/:id')
  patch(
    @Param('id') id: string,
    @Body({ schema: patchCaseSchema }) body: PatchCase,
  ): CaseDetail {
    return this.cases.patch(id, body);
  }

  @Post('cases/:id/observations')
  addObservation(
    @Param('id') id: string,
    @Body({ schema: observationSchema }) body: ObservationInput,
  ): CaseDetail {
    return this.cases.addObservation(id, body);
  }

  @Post('cases/:id/actions')
  @HttpCode(200)
  action(
    @Param('id') id: string,
    @Body({ schema: actionSchema }) body: ActionInput,
  ): CaseDetail {
    return this.cases.action(id, body.action as CaseAction);
  }

  @Post('demo/reset')
  @HttpCode(200)
  reset() {
    this.cases.reset();
    return { ok: true, today: this.cases.today };
  }
}
