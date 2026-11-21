import {
  ApiBearerAuth,
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
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Roles } from '../auth/roles.decorator.js';
import { toUserView, type User, type UserView } from '../auth/user.types.js';
import { UsersRepository } from '../auth/users.repository.js';
import { type UpdateUserInput, updateUserSchema } from './admin.schemas.js';

@ApiTags('Administracja')
@ApiBearerAuth()
@ApiErrors(401, 403)
@Controller('admin/users')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly users: UsersRepository) {}

  @Get()
  @ApiOperation({
    summary: 'Konta użytkowników',
    description: 'Tylko ADMIN. Bez skrótów haseł.',
  })
  @ApiOkResponse({ description: 'Lista kont.' })
  async list(): Promise<UserView[]> {
    return (await this.users.list()).map(toUserView);
  }

  /** A new role applies to that user's next request (the token holds no role). */
  @Patch(':id')
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
