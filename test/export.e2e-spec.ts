import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { writeFileSync } from 'node:fs';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

const binary = (
  res: request.Response,
  cb: (e: Error | null, b: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe('Sheet PDF export (e2e)', () => {
  let app: INestApplication<App>;
  let kaminska: string;
  let hr: string;
  let nowak: string;
  let admin: string;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    [kaminska, hr, nowak, admin] = await Promise.all(
      ['j.kaminska', 'a.lis', 'a.nowak', 'admin'].map((l) => loginAs(app, l)),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const pdf = (token: string, id: string) =>
    withToken(app, token)
      .get(`/api/cases/${id}/sheet.pdf`)
      .buffer(true)
      .parse(binary);

  it('returns a PDF named ocena-<nazwisko>-<data>.pdf', async () => {
    const res = await pdf(kaminska, 'c-006').expect(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="ocena-[a-z-]+-2026-11-16\.pdf"/,
    );
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, body);
  });

  it('renders sheet A (HR reads every case)', async () => {
    const res = await pdf(hr, 'c-201').expect(200);
    expect((res.body as Buffer).length).toBeGreaterThan(5000);
    if (process.env.PDF_OUT)
      writeFileSync(`${process.env.PDF_OUT}.A.pdf`, res.body as Buffer);
  });

  it('embeds Liberation Serif (Times New Roman metrics) in every sheet', async () => {
    const sheets = { A: 'c-201', B: 'c-008', C: 'c-006' };
    for (const [sheet, id] of Object.entries(sheets)) {
      const res = await pdf(hr, id).expect(200);
      if (process.env.PDF_OUT)
        writeFileSync(`${process.env.PDF_OUT}.${sheet}.pdf`, res.body as Buffer);
      const text = (res.body as Buffer).toString('latin1');
      expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+LiberationSerif/);
      expect(text).not.toContain('Roboto');
    }
  });

  it('keeps the case access rules: own case for the employee, 403 otherwise', async () => {
    await pdf(nowak, 'c-001').expect(200);
    await pdf(nowak, 'c-006').expect(403);
    await pdf(admin, 'c-006').expect(403);
    await request(app.getHttpServer())
      .get('/api/cases/c-006/sheet.pdf')
      .expect(401);
  });
});
