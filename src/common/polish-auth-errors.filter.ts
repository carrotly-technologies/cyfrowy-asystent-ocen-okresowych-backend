import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';

export const UNAUTHORIZED_PL =
  'Musisz się zalogować, aby wykonać tę operację (brak tokenu albo sesja wygasła).';
export const FORBIDDEN_PL = 'Brak uprawnień do tej operacji.';

/** Generic English messages of Nest and @nestjs/authentication / authorization. */
const GENERIC = new Set(['Unauthorized', 'Forbidden', 'Forbidden resource']);

/**
 * Body for a 401/403: the generic English message becomes Polish; a specific
 * message (e.g. „Nieprawidłowy login lub hasło.”) is kept as it is.
 */
export function polishAuthBody(exception: HttpException): unknown {
  const status = exception.getStatus();
  const response = exception.getResponse();
  const message =
    typeof response === 'string'
      ? response
      : (response as { message?: unknown }).message;
  if (typeof message !== 'string' || !GENERIC.has(message)) return response;
  const base = typeof response === 'object' ? response : {};
  return {
    ...base,
    statusCode: status,
    error: status === 401 ? 'Unauthorized' : 'Forbidden',
    message: status === 401 ? UNAUTHORIZED_PL : FORBIDDEN_PL,
  };
}

/** Polish messages for generic 401 and 403 across the whole API. */
@Catch(UnauthorizedException, ForbiddenException)
export class PolishAuthErrorsFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const body = polishAuthBody(exception);
    const res = host.switchToHttp().getResponse<{
      headersSent?: boolean;
      status(code: number): { json(body: unknown): void };
    }>();
    if (res.headersSent) return;
    res.status(exception.getStatus()).json(body);
  }
}
