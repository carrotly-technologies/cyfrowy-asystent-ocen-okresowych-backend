import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Admin correction mode (e2e)', () => {
  let app: INestApplication<App>;
  let admin: string;
  let kaminska: string;
  let hr: string;
  let nowak: string;
  const REASON = 'Pomyłka przy przepisywaniu arkusza papierowego.';

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    [admin, kaminska, hr, nowak] = await Promise.all(
      ['admin', 'j.kaminska', 'a.lis', 'a.nowak'].map((l) => loginAs(app, l)),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await withToken(app, admin).post('/api/demo/reset').expect(200);
  });

  const as = (token: string) => withToken(app, token);

  it('lists cases and correctable fields for ADMIN only', async () => {
    const list = await as(admin).get('/api/admin/cases').expect(200);
    expect(list.body.length).toBeGreaterThan(10);
    const one = await as(admin).get('/api/admin/cases/c-006').expect(200);
    expect(one.body.case.id).toBe('c-006');
    expect(one.body.fields.map((f: { field: string }) => f.field)).toContain(
      'decisions.komunikacja',
    );
    for (const token of [kaminska, hr, nowak]) {
      const res = await as(token).get('/api/admin/cases').expect(403);
      expect(res.body.message).toBe('Brak uprawnień do tej operacji.');
      await as(token)
        .post('/api/admin/cases/c-006/corrections')
        .send({ field: 'iprz', value: 'x', reason: REASON })
        .expect(403);
    }
  });

  it('corrects a locked score, audits it and shows it in the case', async () => {
    const res = await as(admin)
      .post('/api/admin/cases/c-006/corrections')
      .send({ field: 'decisions.komunikacja', value: 7, reason: REASON })
      .expect(201);
    expect(res.body.correction).toMatchObject({
      oldValue: '5 pkt',
      newValue: '7 pkt',
      by: { name: 'Marek Zając' },
      reason: REASON,
    });
    const detail = await as(kaminska).get('/api/cases/c-006').expect(200);
    expect(detail.body.decisions.komunikacja).toBe(7);
    expect(detail.body.corrections).toHaveLength(1);
    expect(detail.body.history.at(-1).text).toContain('Korekta błędu');
    expect(detail.body.locks.partII).toMatch(/trybie korekty/);
    // The evaluator still cannot change the locked field.
    await as(kaminska)
      .patch('/api/cases/c-006')
      .send({ decisions: { komunikacja: 9 } })
      .expect(409);
  });

  it('400 without a reason or for a bad value, 409 for an unlocked field, 404 unknown case', async () => {
    const short = await as(admin)
      .post('/api/admin/cases/c-006/corrections')
      .send({ field: 'decisions.komunikacja', value: 7, reason: 'bo tak' })
      .expect(400);
    expect(short.body.message.join(' ')).toMatch(/powód korekty/i);
    await as(admin)
      .post('/api/admin/cases/c-006/corrections')
      .send({ field: 'decisions.komunikacja', value: 4, reason: REASON })
      .expect(400);
    await as(admin)
      .post('/api/admin/cases/c-001/corrections')
      .send({ field: 'iprz', value: 'x', reason: REASON })
      .expect(409);
    await as(admin)
      .post('/api/admin/cases/nope/corrections')
      .send({ field: 'iprz', value: 'x', reason: REASON })
      .expect(404);
  });
});
