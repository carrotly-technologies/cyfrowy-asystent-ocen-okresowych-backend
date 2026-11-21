import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import { Can } from '@nestjs/authorization';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { StageId } from '../cases/case.types.js';
import {
  type AskInput,
  askSchema,
  suggestionsQuerySchema,
} from './assistant.schemas.js';
import { AssistantEnabledGuard } from './assistant-enabled.guard.js';
import { AssistantService } from './assistant.service.js';
import type { AskResponse } from './assistant.types.js';
import { type DocumentListItem, listDocuments } from './documents.js';

@ApiTags('Asystent AI')
@ApiBearerAuth()
@ApiErrors(401, 404)
@Can.Anyone()
@Controller('assistant')
@UseGuards(AssistantEnabledGuard)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Pytanie do asystenta',
    description:
      'Odpowiedź na podstawie bazy wiedzy (przepisy, poradniki) ze wskazaniem źródeł. Odpowiedź ma charakter doradczy. 404, gdy asystent jest wyłączony (FEATURE_ASSISTANT=false).',
  })
  @ApiOkResponse({ description: 'Odpowiedź ze źródłami.' })
  @ApiErrors(400)
  @HttpCode(200)
  ask(@Body({ schema: askSchema }) body: AskInput): Promise<AskResponse> {
    return this.assistant.ask(body);
  }

  /** The source documents: linked, and whether the assistant answers from them. */
  @Get('documents')
  @ApiOperation({ summary: 'Dokumenty źródłowe asystenta' })
  @ApiOkResponse({
    description: '`{ id, title, description, url, indexed, note }[]`.',
  })
  documents(): DocumentListItem[] {
    return listDocuments();
  }

  @Get('suggestions')
  @ApiOperation({
    summary: 'Przykładowe pytania',
    description: 'Opcjonalnie dla etapu oceny (`stageId`).',
  })
  @ApiQuery({
    name: 'stageId',
    required: false,
    description: 'Etap oceny, np. `OPENING_TALK`.',
  })
  @ApiOkResponse({ description: 'Lista pytań.' })
  suggestions(
    @Query('stageId', { schema: suggestionsQuerySchema }) stageId?: StageId,
  ): string[] {
    return this.assistant.suggestions(stageId);
  }
}
