import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Employee accounts from the HR register (e2e)', () => {
  let app: INestApplication<App>;
  let hr: string;
  let admin: string;
  let supervisor: string;
  let employee: string;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    delete process.env.DATABASE_URL;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    hr = await loginAs(app, 'a.lis');
    admin = await loginAs(app, 'admin');
    supervisor = await loginAs(app, 'j.kaminska');
    employee = await loginAs(app, 'a.nowak');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await withToken(app, hr).post('/api/demo/reset').expect(200);
  });

  const as = (token: string) => withToken(app, token);

  it('HR creates an EMPLOYEE account; the person signs in and sees own case', async () => {
    const before = await as(hr)
      .get('/api/admin/users/person/p-lewandowski')
      .expect(200);
    expect(before.body).toEqual({
      account: null,
      suggestedLogin: 'm.lewandowski',
    });

    const res = await as(hr)
      .post('/api/admin/users')
      .send({ personId: 'p-lewandowski', login: 'M.Lewandowski' })
      .expect(201);
    expect(res.body.account).toMatchObject({
      login: 'm.lewandowski',
      role: 'EMPLOYEE',
      name: 'Michał Lewandowski',
    });
    expect(res.body.account).not.toHaveProperty('passwordHash');
    const password = res.body.temporaryPassword as string;
    expect(password).toHaveLength(12);

    const after = await as(hr)
      .get('/api/admin/users/person/p-lewandowski')
      .expect(200);
    expect(after.body.account.login).toBe('m.lewandowski');

    const token = await loginAs(app, 'm.lewandowski', password);
    const cases = await as(token).get('/api/cases').expect(200);
    const ids = (cases.body as { id: string }[]).map((c) => c.id);
    expect(ids).toContain('c-003');
    await as(token).get('/api/cases/c-001').expect(403);
  });

  it('ADMIN may create accounts too', async () => {
    await as(admin)
      .post('/api/admin/users')
      .send({ personId: 'p-lewandowski', login: 'm.lewandowski' })
      .expect(201);
  });

  it('SUPERVISOR and EMPLOYEE get 403', async () => {
    for (const token of [supervisor, employee]) {
      await as(token)
        .post('/api/admin/users')
        .send({ personId: 'p-lewandowski', login: 'm.lewandowski' })
        .expect(403);
      await as(token).get('/api/admin/users/person/p-lewandowski').expect(403);
    }
  });

  it('HR still may not list or change roles (ADMIN only)', async () => {
    await as(hr).get('/api/admin/users').expect(403);
    await as(hr)
      .patch('/api/admin/users/u-nowak')
      .send({ role: 'HR' })
      .expect(403);
    await as(admin).get('/api/admin/users').expect(200);
  });

  it('409 for a taken login (any case) and for a person who has an account', async () => {
    const taken = await as(hr)
      .post('/api/admin/users')
      .send({ personId: 'p-lewandowski', login: 'A.Nowak' })
      .expect(409);
    expect(taken.body.message).toContain('zajęty');
    const has = await as(hr)
      .post('/api/admin/users')
      .send({ personId: 'p-nowak', login: 'anna.nowak' })
      .expect(409);
    expect(has.body.message).toContain('a.nowak');
  });

  it('400 for a bad login, 404 for an unknown person', async () => {
    await as(hr)
      .post('/api/admin/users')
      .send({ personId: 'p-lewandowski', login: 'Łukasz Ż' })
      .expect(400);
    await as(hr)
      .post('/api/admin/users')
      .send({ personId: 'p-nikt', login: 'n.nikt' })
      .expect(404);
  });

  it('the temporary password works once created; a wrong one gets 401', async () => {
    await as(hr)
      .post('/api/admin/users')
      .send({ personId: 'p-lewandowski', login: 'm.lewandowski' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'm.lewandowski', password: 'Ocena2026!' })
      .expect(401);
  });
});
