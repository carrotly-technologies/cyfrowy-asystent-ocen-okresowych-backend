import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';

/** Swagger UI (public, like the files in docs/: it holds no personal data). */
export const OPENAPI_UI_PATH = 'api/docs-api';
/** The OpenAPI 3 document. */
export const OPENAPI_JSON_PATH = 'api/openapi.json';

const DESCRIPTION = `API Cyfrowego Asystenta Ocen Okresowych (ocena okresowa w służbie cywilnej: ustawa o służbie cywilnej, rozp. PRM z 4.04.2016, Dz.U. poz. 470).

Integracja z systemami EZD i kadrowymi: zaloguj konto techniczne przez \`POST /api/auth/login\`, wyślij token w nagłówku \`Authorization: Bearer <token>\` i pobierz komplet pól arkusza przez \`GET /api/cases/{id}/export?format=json\`. Uprawnienia są takie same jak w aplikacji: oceniany widzi tylko swoje oceny, przełożony oceny swojego zespołu, HR wszystkie.

Błędy zwracają \`{ statusCode, message, error }\` z komunikatem po polsku.`;

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Cyfrowy Asystent Ocen Okresowych: API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Token z POST /api/auth/login (ważny 8 godzin).',
    })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // setup() serves these outside Nest's router, so they are not listed.
  document.paths[`/${OPENAPI_JSON_PATH}`] = {
    get: {
      tags: ['Dokumentacja API'],
      summary: 'Ten dokument OpenAPI (JSON)',
      responses: { '200': { description: 'Dokument OpenAPI 3.' } },
    },
  };
  document.paths[`/${OPENAPI_UI_PATH}`] = {
    get: {
      tags: ['Dokumentacja API'],
      summary: 'Swagger UI z dokumentacją API',
      responses: { '200': { description: 'Strona HTML.' } },
    },
  };
  return document;
}

/** Serves Swagger UI and the JSON document; called from configureApp(). */
export function setupOpenApi(app: INestApplication): void {
  SwaggerModule.setup(OPENAPI_UI_PATH, app, () => buildOpenApiDocument(app), {
    jsonDocumentUrl: OPENAPI_JSON_PATH,
    yamlDocumentUrl: 'api/openapi.yaml',
    customSiteTitle: 'Dokumentacja API: Cyfrowy Asystent Ocen Okresowych',
    swaggerOptions: { persistAuthorization: true },
  });
}
