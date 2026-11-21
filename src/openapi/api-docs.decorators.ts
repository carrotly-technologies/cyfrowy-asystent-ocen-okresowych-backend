import { applyDecorators } from '@nestjs/common';
import { ApiResponse, type SchemaObject } from '@nestjs/swagger';

const ERROR_DESCRIPTIONS = {
  400: 'Nieprawidłowe dane (komunikaty po polsku w `message`).',
  401: 'Brak tokenu albo token nieważny: zaloguj się przez POST /api/auth/login.',
  403: 'Brak uprawnień do tej operacji lub tych danych.',
  404: 'Nie znaleziono zasobu.',
  409: 'Operacja niedozwolona na tym etapie (wyjaśnienie po polsku w `message`).',
} as const;

export type ErrorStatus = keyof typeof ERROR_DESCRIPTIONS;

const errorBody: SchemaObject = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', description: 'Kod HTTP.' },
    message: {
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
      description: 'Komunikat albo lista komunikatów po polsku.',
    },
    error: { type: 'string', description: 'Nazwa błędu HTTP.' },
  },
};

/** Documents the error statuses of a route with the shared error body. */
export function ApiErrors(...statuses: ErrorStatus[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: ERROR_DESCRIPTIONS[status],
        schema: errorBody,
      }),
    ),
  );
}
