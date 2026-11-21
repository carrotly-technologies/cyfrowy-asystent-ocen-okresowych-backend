import {
  ApiBearerAuth,
  ApiNoContentResponse,
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
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import {
  type JournalObservationInput,
  type JournalObservationPatch,
  type NoteInput,
  noteSchema,
  observationPatchSchema,
  observationSchema,
} from './journal.schemas.js';
import { JournalService } from './journal.service.js';

const PERSON_ID = ApiParam({
  name: 'personId',
  description: 'Identyfikator pracownika, np. `p-nowak`.',
});

/** Private journal of a supervisor; HR and ADMIN have no access. */
@ApiTags('Notatnik przełożonego')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Controller()
@Roles('SUPERVISOR')
export class JournalController {
  constructor(private readonly journal: JournalService) {}

  @Get('people/:personId/notes')
  @PERSON_ID
  @ApiOperation({
    summary: 'Notatki o pracowniku',
    description:
      'Prywatne notatki zalogowanego przełożonego o pracowniku z jego zespołu.',
  })
  @ApiOkResponse({ description: 'Lista notatek.' })
  @ApiErrors(404)
  listNotes(@Param('personId') personId: string) {
    return this.journal.listNotes(personId);
  }

  @Post('people/:personId/notes')
  @PERSON_ID
  @ApiOperation({
    summary: 'Dodanie notatki',
    description: 'Tekst 1–5000 znaków.',
  })
  @ApiCreatedResponse({ description: 'Nowa notatka.' })
  @ApiErrors(400, 404)
  addNote(
    @Param('personId') personId: string,
    @Body({ schema: noteSchema }) body: NoteInput,
  ) {
    return this.journal.addNote(personId, body);
  }

  @Patch('notes/:id')
  @ApiParam({ name: 'id', description: 'Identyfikator notatki.' })
  @ApiOperation({ summary: 'Zmiana notatki' })
  @ApiOkResponse({ description: 'Notatka z nowym `updatedAt`.' })
  @ApiErrors(400, 404)
  updateNote(
    @Param('id') id: string,
    @Body({ schema: noteSchema }) body: NoteInput,
  ) {
    return this.journal.updateNote(id, body);
  }

  @Delete('notes/:id')
  @ApiParam({ name: 'id', description: 'Identyfikator notatki.' })
  @ApiOperation({ summary: 'Usunięcie notatki' })
  @ApiNoContentResponse({ description: 'Usunięto.' })
  @ApiErrors(404)
  @HttpCode(204)
  async deleteNote(@Param('id') id: string): Promise<void> {
    await this.journal.deleteNote(id);
  }

  @Get('people/:personId/observations')
  @PERSON_ID
  @ApiOperation({
    summary: 'Obserwacje o pracowniku',
    description: 'Obserwacje S-D-R zalogowanego przełożonego, wg daty.',
  })
  @ApiOkResponse({ description: 'Lista obserwacji.' })
  @ApiErrors(404)
  listObservations(@Param('personId') personId: string) {
    return this.journal.listObservations(personId);
  }

  @Post('people/:personId/observations')
  @PERSON_ID
  @ApiOperation({
    summary: 'Dodanie obserwacji',
    description:
      'Data (nie późniejsza niż dziś), kryterium, rodzaj oraz sytuacja, działanie i rezultat.',
  })
  @ApiCreatedResponse({ description: 'Nowa obserwacja.' })
  @ApiErrors(400, 404)
  addObservation(
    @Param('personId') personId: string,
    @Body({ schema: observationSchema }) body: JournalObservationInput,
  ) {
    return this.journal.addObservation(personId, body);
  }

  @Patch('observations/:id')
  @ApiParam({ name: 'id', description: 'Identyfikator obserwacji.' })
  @ApiOperation({ summary: 'Zmiana obserwacji' })
  @ApiOkResponse({ description: 'Obserwacja po zmianie.' })
  @ApiErrors(400, 404)
  updateObservation(
    @Param('id') id: string,
    @Body({ schema: observationPatchSchema }) body: JournalObservationPatch,
  ) {
    return this.journal.updateObservation(id, body);
  }

  @Delete('observations/:id')
  @ApiParam({ name: 'id', description: 'Identyfikator obserwacji.' })
  @ApiOperation({ summary: 'Usunięcie obserwacji' })
  @ApiNoContentResponse({ description: 'Usunięto.' })
  @ApiErrors(404)
  @HttpCode(204)
  async deleteObservation(@Param('id') id: string): Promise<void> {
    await this.journal.deleteObservation(id);
  }
}
