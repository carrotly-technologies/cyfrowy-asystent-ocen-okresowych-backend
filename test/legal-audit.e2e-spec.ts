import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

/** Fixes of the legal-compliance audit (deadlines, addressee, locks, §9, art. 89). */
describe('Legal audit fixes (e2e)', () => {
  let app: INestApplication<App>;
  const t: Record<string, string> = {};
  const as = (login: string) => withToken(app, t[login]);
  const act = (login: string, id: string, action: string) =>
    as(login).post(`/api/cases/${id}/actions`).send({ action });

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
      'a.lis',
      'a.nowak',
      'p.wojcik',
      'b.wisniewska',
      't.jankowski',
    ]) {
      t[login] = await loginAs(app, login);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await as('a.lis').post('/api/demo/reset').expect(200);
  });

  it('due date of the main case: 24 months from the previous assessment', async () => {
    const res = await as('j.kaminska').get('/api/cases/c-001').expect(200);
    expect(res.body.partI.assessmentDue).toBe('2026-11-30');
  });

  it('objection addressee: DG for sheets B/C, the assessor for sheet A', async () => {
    const c = await as('a.lis').get('/api/cases/c-006').expect(200);
    expect(c.body.objectionAddressee).toMatchObject({
      decider: 'DIRECTOR',
      to: 'dyrektora generalnego urzędu',
    });
    const a = await as('a.lis').get('/api/cases/c-201').expect(200);
    expect(a.body.objectionAddressee).toMatchObject({ decider: 'EVALUATOR' });
  });

  it('DIRECTOR dismisses with a later delivery date: the court term counts from it', async () => {
    const res = await as('b.wisniewska')
      .post('/api/cases/c-301/objection/decision')
      .send({
        outcome: 'DISMISS',
        reason: 'Ocena zasadna',
        decidedOn: '2026-11-20',
        deliveredOn: '2026-11-21',
      })
      .expect(200);
    const objection = res.body.objections.at(-1);
    expect(objection.decision).toMatchObject({
      decidedOn: '2026-11-20',
      deliveredOn: '2026-11-21',
    });
    // 21.11 + 14 = 05.12 (Saturday) -> Monday 07.12.2026
    expect(objection.courtAppealDeadline.date).toBe('2026-12-07');
    // "Stan i terminy": the court term, not the old objection term.
    const employee = await as('t.jankowski')
      .get('/api/cases/c-301')
      .expect(200);
    expect(employee.body.nextDeadline).toMatchObject({
      label: 'Termin na odwołanie do sądu pracy',
      date: '2026-12-07',
    });
  });

  it('decision dates: a future delivery or one before the decision is a 400 with a Polish message', async () => {
    const future = await as('b.wisniewska')
      .post('/api/cases/c-301/objection/decision')
      .send({ outcome: 'DISMISS', reason: 'x', deliveredOn: '2026-11-23' })
      .expect(400);
    expect(JSON.stringify(future.body)).toContain('w przyszłości');
    await as('b.wisniewska')
      .post('/api/cases/c-301/objection/decision')
      .send({
        outcome: 'DISMISS',
        reason: 'x',
        decidedOn: '2026-11-21',
        deliveredOn: '2026-11-20',
      })
      .expect(400);
    await as('b.wisniewska')
      .post('/api/cases/c-301/objection/decision')
      .send({ outcome: 'DISMISS', reason: 'x', deliveredOn: '21.11.20263' })
      .expect(400);
    const term = await as('b.wisniewska')
      .get('/api/objections/court-term?deliveredOn=2026-11-21')
      .expect(200);
    expect(term.body).toMatchObject({
      date: '2026-12-07',
      label: 'Termin na odwołanie do sądu pracy',
    });
    await as('b.wisniewska')
      .get('/api/objections/court-term?deliveredOn=jutro')
      .expect(400);
  });

  it('part II is locked before the assessment stage; notatki robocze are not', async () => {
    await as('j.kaminska')
      .patch('/api/cases/c-003')
      .send({ decisions: { zarzadzanie_ludzmi: 7 } })
      .expect(409);
    const res = await as('j.kaminska')
      .patch('/api/cases/c-003')
      .send({ workingNotes: 'Notatka.' })
      .expect(200);
    expect(res.body.workingNotes).toBe('Notatka.');
    expect(res.body.partIIEditableFrom).toBe('ASSESSMENT');
  });

  it('signing with part III attached notifies the DG, who can open the case', async () => {
    await as('j.kaminska')
      .patch('/api/cases/c-001')
      .send({
        assessmentTalkOn: '2026-11-20',
        decisions: {
          wykorzystywanie_wiedzy: 9,
          rzetelnosc: 9,
          organizacja_pracy: 9,
          wspolpraca: 9,
          komunikacja: 9,
          myslenie_analityczne: 9,
        },
        justification: 'Wyróżniające wyniki.',
        iprz: 'Szkolenie.',
        promotionRequest: {
          attached: 'YES',
          appointedYear: 2018,
          currentGrade: 'III',
          gradeGrantedOn: '2021-05-04',
          requestedGrade: 'IV',
          motivation: 'Wyróżniające wyniki.',
        },
      })
      .expect(200);
    await act('j.kaminska', 'c-001', 'COMPLETE_ASSESSMENT_TALK').expect(200);
    const signed = await act('j.kaminska', 'c-001', 'SIGN_ASSESSMENT').expect(
      200,
    );
    expect(signed.body.assessmentTalkOn).toBe('2026-11-20');
    expect(signed.body.assessmentPeriod.to).toBe('2026-11-21');
    const inbox = await as('b.wisniewska')
      .get('/api/notifications')
      .expect(200);
    expect(
      inbox.body.items.some(
        (n: { title: string; caseId: string }) =>
          n.caseId === 'c-001' && n.title.includes('kolejnego stopnia'),
      ),
    ).toBe(true);
    await as('b.wisniewska').get('/api/cases/c-001').expect(200);
  });

  it('change of position within 6 months (§9 ust. 1) reopens part I', async () => {
    const before = await as('a.lis').get('/api/cases/c-002').expect(200);
    const res = await as('a.lis')
      .post('/api/cases/c-002/position-change')
      .send({ date: '2026-11-23' })
      .expect(200);
    expect(res.body.currentStage).toBe('OPENING_TALK');
    expect(res.body.partI.assessmentDue).toBe(before.body.partI.assessmentDue);
    expect(res.body.nextDeadline).toMatchObject({
      date: '2026-12-23',
      legalBasis: expect.stringContaining('§9 ust. 1'),
    });
    const inbox = await as('p.wojcik').get('/api/notifications').expect(200);
    expect(
      inbox.body.items.some(
        (n: { type: string; caseId: string }) =>
          n.type === 'POSITION_CHANGE' && n.caseId === 'c-002',
      ),
    ).toBe(true);
  });
});
