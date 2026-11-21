import { PGlite } from '@electric-sql/pglite';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { DATABASE, MIGRATIONS_FOLDER } from './../src/database/database.js';
import { loginAs, withToken } from './auth.helpers.js';

// With a database (PGlite with the real migrations), cases and accounts
// survive a restart of the backend: the seed goes into an empty database only.
describe('Persistence of cases and accounts in PostgreSQL (e2e)', () => {
  let db: ReturnType<typeof drizzle>;
  let app: INestApplication<App>;

  async function start(): Promise<INestApplication<App>> {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    const next = moduleFixture.createNestApplication<INestApplication<App>>();
    configureApp(next);
    await next.init();
    return next;
  }

  const stageOf = async (id: string) => {
    const token = await loginAs(app, 'j.kaminska');
    const res = await withToken(app, token).get(`/api/cases/${id}`).expect(200);
    return res.body as { currentStage: string; history: { text: string }[] };
  };

  const roleOf = async (id: string) => {
    const token = await loginAs(app, 'admin');
    const res = await withToken(app, token).get('/api/admin/users').expect(200);
    return (res.body as { id: string; role: string }[]).find((u) => u.id === id)
      ?.role;
  };

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    process.env.REMINDERS_INTERVAL_MINUTES = '0';
    delete process.env.DATABASE_URL;
    db = drizzle({ client: new PGlite() });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    app = await start();
  });

  afterAll(async () => {
    await app.close();
  });

  it('keeps a stage change and a role change after a restart; reset restores the seed', async () => {
    const before = await stageOf('c-004');
    expect(before.currentStage).toBe('SHEET_SELECTION');
    const supervisor = await loginAs(app, 'j.kaminska');
    const moved = await withToken(app, supervisor)
      .post('/api/cases/c-004/actions')
      .send({ action: 'ACCEPT_SHEET' })
      .expect(200);
    expect(moved.body.currentStage).not.toBe('SHEET_SELECTION');
    const admin = await loginAs(app, 'admin');
    await withToken(app, admin)
      .patch('/api/admin/users/u-nowak')
      .send({ role: 'HR' })
      .expect(200);

    await app.close();
    app = await start();

    const after = await stageOf('c-004');
    expect(after.currentStage).toBe(moved.body.currentStage);
    expect(after.history).toEqual(moved.body.history);
    expect(after.history.length).toBeGreaterThan(before.history.length);
    expect(await roleOf('u-nowak')).toBe('HR');

    const token = await loginAs(app, 'j.kaminska');
    await withToken(app, token).post('/api/demo/reset').expect(200);
    expect((await stageOf('c-004')).currentStage).toBe('SHEET_SELECTION');
    expect(await roleOf('u-nowak')).toBe('EMPLOYEE');

    await app.close();
    app = await start();
    expect((await stageOf('c-004')).currentStage).toBe('SHEET_SELECTION');
  });
});
