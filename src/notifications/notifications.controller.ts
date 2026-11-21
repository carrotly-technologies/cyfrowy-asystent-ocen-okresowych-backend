import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { Roles } from '../auth/roles.decorator.js';
import { NotificationsService } from './notifications.service.js';
import { RemindersService } from './reminders.service.js';

@ApiTags('Powiadomienia')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly reminders: RemindersService,
  ) {}

  /** The signed-in user's own notifications, newest first, and the unread count. */
  @Get()
  @ApiOperation({
    summary: 'Moje powiadomienia',
    description:
      'Powiadomienia zalogowanego użytkownika (najnowsze pierwsze) i liczba nieprzeczytanych.',
  })
  @ApiOkResponse({
    description: 'Lista powiadomień i licznik nieprzeczytanych.',
  })
  @Can.Anyone()
  mine() {
    return this.notifications.mine();
  }

  @Post('read-all')
  @ApiOperation({
    summary: 'Oznacz wszystkie jako przeczytane',
    description:
      'Oznacza wszystkie powiadomienia użytkownika jako przeczytane.',
  })
  @ApiOkResponse({ description: 'Liczba oznaczonych.' })
  @Can.Anyone()
  @HttpCode(200)
  async readAll() {
    return { marked: await this.notifications.markAllRead() };
  }

  @Post(':id/read')
  @ApiOperation({
    summary: 'Oznacz jako przeczytane',
    description: 'Oznacza jedno powiadomienie jako przeczytane (204).',
  })
  @ApiOkResponse({ description: 'Oznaczono.' })
  @ApiErrors(404)
  @Can.Anyone()
  @HttpCode(204)
  async read(@Param('id') id: string): Promise<void> {
    await this.notifications.markRead(id);
  }

  /** "Uruchom przypomnienia teraz" (demo / HR / admin): one scheduler run. */
  @Post('run')
  @ApiOperation({
    summary: 'Uruchom przypomnienia teraz',
    description:
      'Jeden przebieg harmonogramu przypomnień dla DEMO_TODAY; idempotentny. HR i administrator.',
  })
  @ApiOkResponse({ description: 'Liczba utworzonych powiadomień.' })
  @Roles('HR', 'ADMIN')
  @HttpCode(200)
  run() {
    return this.reminders.run();
  }
}
