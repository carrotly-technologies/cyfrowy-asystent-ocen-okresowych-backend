import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

interface Inbox {
  items: {
    id: string;
    type: string;
    caseId: string | null;
    readAt: string | null;
  }[];
  unread: number;
}

describe('Notifications, scheduler and due-date changes (e2e)', () => {
  let app: INestApplication<App>;
  const tokens: Record<string, string> = {};
  const as = (login: string) => withToken(app, tokens[login]);
  const inbox = async (login: string) =>
    (await as(login).get('/api/notifications').expect(200)).body as Inbox;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    delete process.env.DATABASE_URL;
    delete process.env.SMTP_HOST;
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    for (const login of [
      'j.kaminska',
      'r.sikora',
      'a.nowak',
      'p.wojcik',
      'a.lis',
      'admin',
    ]) {
      tokens[login] = await loginAs(app, login);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await as('admin').post('/api/demo/reset').expect(200);
  });

  it('every role finds notifications on first login', async () => {
    const supervisor = await inbox('j.kaminska');
    expect(supervisor.unread).toBeGreaterThanOrEqual(3);
    expect(supervisor.items.map((n) => n.type)).toEqual(
      expect.arrayContaining([
        'ASSESSMENT_DUE_SOON',
        'CRITERIA_REMINDER',
        'DUE_DATE_CHANGED',
      ]),
    );
    expect((await inbox('a.nowak')).items.map((n) => n.type)).toContain(
      'ASSESSMENT_DUE_SOON',
    );
    expect((await inbox('p.wojcik')).items.map((n) => n.type)).toContain(
      'PENDING_ACK',
    );
    expect((await inbox('a.lis')).items.map((n) => n.type)).toEqual(
      expect.arrayContaining(['OBLIGATORY_GRADE', 'DEADLINE_OVERDUE']),
    );
    expect((await inbox('admin')).items.map((n) => n.type)).toContain(
      'SCHEDULER_RUN',
    );
  });

  it('the evaluator reminds the evaluee to confirm part I (once a day); nothing to remind is 409', async () => {
    const res = await as('j.kaminska')
      .post('/api/cases/c-002/remind')
      .expect(200);
    expect(res.body.history.at(-1).text).toContain('przypomniał');
    const items = (await inbox('p.wojcik')).items;
    expect(items.some((n) => n.title.startsWith('Przypomnienie'))).toBe(true);
    await as('j.kaminska').post('/api/cases/c-002/remind').expect(200);
    expect(
      (await inbox('p.wojcik')).items.filter((n) =>
        n.title.startsWith('Przypomnienie'),
      ),
    ).toHaveLength(1);
    await as('j.kaminska').post('/api/cases/c-004/remind').expect(409);
    await as('r.sikora').post('/api/cases/c-002/remind').expect(403);
    await as('p.wojcik').post('/api/cases/c-002/remind').expect(403);
  });

  it('the scheduler is idempotent: a second run creates nothing', async () => {
    const before = (await inbox('j.kaminska')).items.length;
    const run = await as('a.lis').post('/api/notifications/run').expect(200);
    expect(run.body).toEqual({
      today: '2026-11-21',
      created: 0,
    });
    expect((await inbox('j.kaminska')).items.length).toBe(before);
    await as('j.kaminska').post('/api/notifications/run').expect(403);
  });

  it('mark one / all as read; someone else’s notification is 404', async () => {
    const { items, unread } = await inbox('a.nowak');
    await as('a.nowak')
      .post(`/api/notifications/${items[0].id}/read`)
      .expect(204);
    expect((await inbox('a.nowak')).unread).toBe(unread - 1);
    await as('p.wojcik')
      .post(`/api/notifications/${items[1].id}/read`)
      .expect(404);
    await as('a.nowak').post('/api/notifications/read-all').expect(200);
    expect((await inbox('a.nowak')).unread).toBe(0);
  });

  it('a long absence of c-003 (HR register) announces the extended due date (art. 81 ust. 7)', async () => {
    const hr = await inbox('a.lis');
    expect(
      hr.items.some(
        (n) => n.type === 'DUE_DATE_CHANGED' && n.caseId === 'c-003',
      ),
    ).toBe(true);
  });

  it('the evaluator changes the due date; the evaluee is notified (§8)', async () => {
    const res = await as('j.kaminska')
      .post('/api/cases/c-001/due-date')
      .send({
        date: '2027-02-15',
        reason: 'EVALUATOR_ABSENCE_EXPECTED',
        note: 'Urlop.',
      })
      .expect(200);
    expect(res.body.partI.assessmentDue).toBe('2027-02-15');
    expect(res.body.dueDateChanges.at(-1).notice.text).toContain(
      'Zawiadomienie',
    );
    expect((await inbox('a.nowak')).items.map((n) => n.type)).toContain(
      'DUE_DATE_CHANGED',
    );
    const employeeView = await as('a.nowak')
      .get('/api/cases/c-001')
      .expect(200);
    expect(employeeView.body.dueDateChanges).toHaveLength(1);
  });

  it('due-date change: 409 within 6 months, 400 bad reason, 403 for others', async () => {
    const conflict = await as('j.kaminska')
      .post('/api/cases/c-002/due-date')
      .send({ date: '2027-06-01', reason: 'EVALUEE_REQUEST' })
      .expect(409);
    expect(conflict.body.message).toContain('6 miesięcy');
    await as('j.kaminska')
      .post('/api/cases/c-001/due-date')
      .send({ date: '2027-06-01', reason: 'ABSENCE_EXTENSION' })
      .expect(400);
    await as('r.sikora')
      .post('/api/cases/c-001/due-date')
      .send({ date: '2027-06-01', reason: 'EVALUEE_REQUEST' })
      .expect(403);
    await as('a.nowak')
      .post('/api/cases/c-001/due-date')
      .send({ date: '2027-06-01', reason: 'EVALUEE_REQUEST' })
      .expect(403);
  });

  it('talk invitation: notification and .ics for the evaluee only', async () => {
    const res = await as('j.kaminska')
      .post('/api/cases/c-001/talk-invitations')
      .send({
        kind: 'ASSESSMENT',
        date: '2026-12-01',
        time: '10:00',
        place: 'Pokój 204',
      })
      .expect(201);
    const inv = res.body.talkInvitations.at(-1);
    expect((await inbox('a.nowak')).items.map((n) => n.type)).toContain(
      'TALK_INVITATION',
    );
    const ics = await as('a.nowak')
      .get(`/api/cases/c-001/talk-invitations/${inv.id}/ics`)
      .expect(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.text).toContain('DTSTART;TZID=Europe/Warsaw:20261201T100000');
    expect(ics.text).toMatch(/SUMMARY:Rozmowa \S+: .+ \(ocena okresowa\)/);
    await as('p.wojcik')
      .get(`/api/cases/c-001/talk-invitations/${inv.id}/ics`)
      .expect(403);
  });

  it('HR records a change of position (§9) and a new evaluator (§9 ust. 3)', async () => {
    const pos = await as('a.lis')
      .post('/api/cases/c-001/position-change')
      .send({ date: '2026-12-01' })
      .expect(200);
    expect(pos.body.positionChanges[0]).toMatchObject({
      effect: 'ASSESSMENT',
      deadline: '2026-12-31',
    });
    expect(pos.body.partI.assessmentDue).toBe('2026-12-31');

    const ev = await as('a.lis')
      .post('/api/cases/c-003/evaluator')
      .send({ evaluatorId: 'ev-sikora' })
      .expect(200);
    expect(ev.body.evaluator.lastName).toBe('Sikora');
    expect((await inbox('r.sikora')).items.map((n) => n.type)).toContain(
      'EVALUATOR_CHANGED',
    );
    await as('j.kaminska')
      .post('/api/cases/c-003/evaluator')
      .send({ evaluatorId: 'ev-sikora' })
      .expect(403);
  });

  it('GET /api/deadlines/rules lists the reasons of art. 81 ust. 8', async () => {
    const res = await as('j.kaminska').get('/api/deadlines/rules').expect(200);
    expect(
      res.body.reasons.filter((r: { selectable: boolean }) => r.selectable),
    ).toHaveLength(4);
  });
});
