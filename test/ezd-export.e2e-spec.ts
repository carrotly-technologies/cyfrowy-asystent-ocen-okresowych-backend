import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { caseExportSchema } from './../src/cases/case-export.schema.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('OpenAPI and export to EZD (e2e)', () => {
  let app: INestApplication<App>;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    for (const login of [
      'j.kaminska',
      'r.sikora',
      'a.lis',
      'a.nowak',
      'p.wojcik',
      'admin',
    ]) {
      tokens[login] = await loginAs(app, login);
    }
    await withToken(app, tokens['j.kaminska'])
      .post('/api/demo/reset')
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  const exportAs = (login: string, id: string, query = '') =>
    withToken(app, tokens[login]).get(`/api/cases/${id}/export${query}`);

  describe('GET /api/openapi.json', () => {
    it('documents every route with a Polish summary, without sign-in', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/openapi.json')
        .expect(200);
      const doc = res.body as {
        openapi: string;
        paths: Record<string, Record<string, { summary?: string }>>;
        components: { schemas: Record<string, unknown> };
      };
      expect(doc.openapi).toMatch(/^3\./);
      const ops = Object.entries(doc.paths).flatMap(([path, item]) =>
        Object.entries(item).map(([method, op]) => ({ path, method, op })),
      );
      expect(ops.length).toBeGreaterThanOrEqual(30);
      for (const { path, method, op } of ops) {
        expect(op.summary, `${method} ${path}`).toMatch(/[ąćęłńóśźżA-Za-z]/);
      }
      expect(doc.paths['/api/cases/{id}/export'].get).toBeDefined();
      expect(doc.components.schemas.EksportOcenyOkresowej).toBeDefined();
    });

    it('serves Swagger UI at /api/docs-api', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/docs-api')
        .expect(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('GET /api/cases/:id/export', () => {
    it('returns the full sheet in the versioned format', async () => {
      const res = await exportAs('j.kaminska', 'c-001', '?format=json').expect(
        200,
      );
      const out = caseExportSchema.parse(res.body);
      expect(out.schemaVersion).toBe('1.0');
      expect(out.case.id).toBe('c-001');
      expect(out.sheet?.id).toBe('C');
      expect(out.partI.criteria.length).toBeGreaterThan(0);
      expect(out.partII.scores.map((s) => s.id)).toEqual(
        out.partI.criteria.map((c) => c.id),
      );
      expect(out.partIII).toBeDefined();
    });

    it('defaults to JSON and rejects other formats in Polish', async () => {
      await exportAs('j.kaminska', 'c-001').expect(200);
      const res = await exportAs('j.kaminska', 'c-001', '?format=xml').expect(
        400,
      );
      expect(JSON.stringify(res.body)).toContain('Obsługiwany format');
    });

    it('requires sign-in', async () => {
      await request(app.getHttpServer())
        .get('/api/cases/c-001/export')
        .expect(401);
    });

    it('404 for an unknown case', async () => {
      await exportAs('a.lis', 'nie-ma').expect(404);
    });

    it('a supervisor exports only their own team', async () => {
      await exportAs('j.kaminska', 'c-001').expect(200);
      await exportAs('j.kaminska', 'c-101').expect(403);
      await exportAs('r.sikora', 'c-101').expect(200);
      await exportAs('r.sikora', 'c-001').expect(403);
    });

    it('the assessed person exports only their own, without the draft of part II', async () => {
      const res = await exportAs('a.nowak', 'c-001').expect(200);
      const out = caseExportSchema.parse(res.body);
      expect(out.assessed.id).toBe('p-nowak');
      expect(out.partII.scores.every((s) => s.points === null)).toBe(true);
      expect(out.partII.evaluation).toBeNull();
      await exportAs('a.nowak', 'c-002').expect(403);
      await exportAs('p.wojcik', 'c-001').expect(403);
    });

    it('HR exports every case; ADMIN none', async () => {
      await exportAs('a.lis', 'c-001').expect(200);
      await exportAs('a.lis', 'c-101').expect(200);
      await exportAs('admin', 'c-001').expect(403);
    });
  });
});
