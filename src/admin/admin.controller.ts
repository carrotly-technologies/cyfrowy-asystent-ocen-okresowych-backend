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
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Roles } from '../auth/roles.decorator.js';
import { toUserView, type User, type UserView } from '../auth/user.types.js';
import { UsersRepository } from '../auth/users.repository.js';
import {
  AccountsService,
  type CreatedAccount,
  type PersonAccount,
} from './accounts.service.js';
import {
  type CreateAccountInput,
  createAccountSchema,
  type UpdateUserInput,
  updateUserSchema,
} from './admin.schemas.js';

@ApiTags('Administracja')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Controller('admin/users')
export class AdminController {
  constructor(
    private readonly users: UsersRepository,
    private readonly accounts: AccountsService,
  ) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Konta użytkowników',
    description: 'Tylko ADMIN. Bez skrótów haseł.',
  })
  @ApiOkResponse({ description: 'Lista kont.' })
  async list(): Promise<UserView[]> {
    return (await this.users.list()).map(toUserView);
  }

  /** A new role applies to that user's next request (the token holds no role). */
  @Post()
  @Roles('HR', 'ADMIN')
  @ApiOperation({
    summary: 'Konto pracownika z kartoteki',
    description:
      'HR i ADMIN: `{ personId, login }` zakłada konto EMPLOYEE powiązane z osobą z kartoteki. ' +
      'Odpowiedź zawiera jednorazowe hasło tymczasowe (pokazywane tylko raz, przechowywany jest wyłącznie skrót scrypt). ' +
      '409: osoba ma już konto albo login jest zajęty.',
  })
  @ApiCreatedResponse({ description: '`{ account, temporaryPassword }`.' })
  @ApiErrors(400, 404, 409)
  create(
    @Body({ schema: createAccountSchema }) body: CreateAccountInput,
  ): Promise<CreatedAccount> {
    return this.accounts.create(body);
  }

  @Get('person/:personId')
  @Roles('HR', 'ADMIN')
  @ApiParam({ name: 'personId', description: 'Identyfikator z kartoteki.' })
  @ApiOperation({
    summary: 'Konto pracownika z kartoteki',
    description: '`{ account | null, suggestedLogin }`.',
  })
  @ApiOkResponse({ description: 'Konto osoby albo null i proponowany login.' })
  @ApiErrors(404)
  forPerson(@Param('personId') personId: string): Promise<PersonAccount> {
    return this.accounts.forPerson(personId);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiParam({ name: 'id', description: 'Identyfikator konta, np. `u-nowak`.' })
  @ApiOperation({
    summary: 'Zmiana roli użytkownika',
    description: 'Nowa rola obowiązuje od następnego żądania tego użytkownika.',
  })
  @ApiOkResponse({ description: 'Konto po zmianie.' })
  @ApiErrors(400, 404, 409)
  async update(
    @CurrentUser() me: User,
    @Param('id') id: string,
    @Body({ schema: updateUserSchema }) body: UpdateUserInput,
  ): Promise<UserView> {
    if (id === me.id && body.role !== 'ADMIN') {
      throw new ConflictException(
        'Nie możesz odebrać sobie roli administratora.',
      );
    }
    const user = await this.users.updateRole(id, body.role);
    if (!user) throw new NotFoundException(`Nie ma użytkownika „${id}”.`);
    return toUserView(user);
  }
}
