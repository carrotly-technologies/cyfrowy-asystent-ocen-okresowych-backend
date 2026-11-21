import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  FORBIDDEN_PL,
  polishAuthBody,
  UNAUTHORIZED_PL,
} from './polish-auth-errors.filter.js';

describe('polishAuthBody', () => {
  it('translates the generic 401 and 403', () => {
    expect(polishAuthBody(new UnauthorizedException())).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: UNAUTHORIZED_PL,
    });
    expect(polishAuthBody(new ForbiddenException())).toEqual({
      statusCode: 403,
      error: 'Forbidden',
      message: FORBIDDEN_PL,
    });
  });

  it('keeps a specific message', () => {
    expect(
      polishAuthBody(
        new UnauthorizedException('Nieprawidłowy login lub hasło.'),
      ),
    ).toMatchObject({ message: 'Nieprawidłowy login lub hasło.' });
  });
});
