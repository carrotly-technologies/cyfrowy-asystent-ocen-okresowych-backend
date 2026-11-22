import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Post-assessment paths: fikcja zapoznania, sprzeciw, zmiana terminu (e2e)', () => {
  let app: INestApplication<App>;
  const t: Record<string, string> = {};

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
      'e.dabrowska',
      't.jankowski',
      'b.wisniewska',
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

  const as = (login: string) => withToken(app, t[login]);

  it('DIRECTOR signs in, lists objections and sees only cases with one', async () => {
    const me = await as('b.wisniewska').get('/api/me').expect(200);
    expect(me.body.role).toBe('DIRECTOR');
    const list = await as('b.wisniewska').get('/api/objections').expect(200);
    expect(list.body.map((o: { caseId: string }) => o.caseId)).toEqual([
      'c-301',
    ]);
    expect(list.body[0].objection.decisionDeadline.date).toBe('2026-12-03');
    const cases = await as('b.wisniewska').get('/api/cases').expect(200);
    expect(cases.body.map((c: { id: string }) => c.id)).toEqual(['c-301']);
    expect(cases.body[0].status).toBe('SPRZECIW_W_ROZPATRZENIU');
    await as('b.wisniewska').get('/api/cases/c-001').expect(403);
    const res = await as('a.nowak').get('/api/objections').expect(403);
    expect(res.body.message).toContain('dyrektor generalny');
  });

  it('employee files an objection in the 7-day window; only once; others get 403', async () => {
    let detail = await as('e.dabrowska').get('/api/cases/c-006').expect(200);
    expect(detail.body.legalActions).toContain('FILE_OBJECTION');
    const denied = await as('j.kaminska')
      .post('/api/cases/c-006/objection')
      .send({ text: 'x' })
      .expect(403);
    expect(denied.body.message).toMatch(
      /^Brak uprawnień\. Sprzeciw od oceny wnosi/,
    );
    await as('e.dabrowska')
      .post('/api/cases/c-006/objection')
      .send({ text: '' })
      .expect(400);
    detail = await as('e.dabrowska')
      .post('/api/cases/c-006/objection')
      .send({ text: 'Nie zgadzam się z oceną komunikacji.' })
      .expect(200);
    expect(detail.body.status).toBe('SPRZECIW_W_ROZPATRZENIU');
    expect(detail.body.objections[0].decisionDeadline.date).toBe('2026-12-07');
    const again = await as('e.dabrowska')
      .post('/api/cases/c-006/objection')
      .send({ text: 'Jeszcze raz' })
      .expect(409);
    expect(again.body.message).toContain('już wniesiony');
  });

  it('DIRECTOR dismisses: case closes with the labour-court note', async () => {
    await as('r.sikora')
      .post('/api/cases/c-301/objection/decision')
      .send({ outcome: 'DISMISS', reason: 'x' })
      .expect(403);
    const res = await as('b.wisniewska')
      .post('/api/cases/c-301/objection/decision')
      .send({ outcome: 'DISMISS', reason: 'Ocena rzetelnie uzasadniona.' })
      .expect(200);
    expect(res.body.status).toBe('ZAKONCZONA');
    expect(res.body.objections[0].decision.outcome).toBe('DISMISS');
    expect(res.body.objections[0].courtAppealDeadline.date).toBe('2026-12-07');
    expect(res.body.history.at(-1).text).toContain('sądu pracy');
    await as('b.wisniewska')
      .post('/api/cases/c-301/objection/decision')
      .send({ outcome: 'REDO', reason: 'x' })
      .expect(409);
  });

  it('DIRECTOR changes the assessment; evaluator re-signs; employee re-acknowledges', async () => {
    const changed = await as('b.wisniewska')
      .post('/api/cases/c-301/objection/decision')
      .send({
        outcome: 'CHANGE',
        reason: 'Opóźnienia niezależne od ocenianego.',
        decisions: { rzetelnosc: 5, organizacja_pracy: 5 },
      })
      .expect(200);
    expect(changed.body.currentStage).toBe('SIGNATURE');
    expect(changed.body.assessmentVersions[0].status).toBe('CHANGED');
    // The evaluator sees the decision and may not edit the scores it set.
    const evaluator = await as('r.sikora').get('/api/cases/c-301').expect(200);
    expect(evaluator.body.objectionDecisionNotice).toMatchObject({
      outcome: 'CHANGE',
      reason: 'Opóźnienia niezależne od ocenianego.',
    });
    expect(evaluator.body.locks.partII).toContain('rozstrzygnięciu sprzeciwu');
    await as('r.sikora')
      .patch('/api/cases/c-301')
      .send({ decisions: { rzetelnosc: 3 } })
      .expect(409);
    for (const action of ['SIGN_ASSESSMENT', 'SEND_FOR_ACK']) {
      await as('r.sikora')
        .post('/api/cases/c-301/actions')
        .send({ action })
        .expect(200);
    }
    const acked = await as('t.jankowski')
      .post('/api/cases/c-301/actions')
      .send({ action: 'EMPLOYEE_ACK_ASSESSMENT' })
      .expect(200);
    expect(acked.body.decisions.rzetelnosc).toBe(5);
    // art. 83 ust. 4: no further sprzeciw from the changed assessment.
    expect(acked.body.status).toBe('ZAKONCZONA');
    expect(acked.body.legalActions).not.toContain('FILE_OBJECTION');
    expect(acked.body.objectionDeadline).toBeNull();
    expect(acked.body.objectionRight.open).toBe(false);
    expect(acked.body.objectionNextSteps[0].text).toContain(
      'nie przysługuje kolejny sprzeciw',
    );
    await as('t.jankowski')
      .post('/api/cases/c-301/objection')
      .send({ text: 'Jeszcze raz.' })
      .expect(409);
  });

  it('DIRECTOR orders a new assessment: back to ASSESSMENT, previous one cancelled', async () => {
    const res = await as('b.wisniewska')
      .post('/api/cases/c-301/objection/decision')
      .send({
        outcome: 'REDO',
        reason: 'Nie przeprowadzono rozmowy oceniającej.',
      })
      .expect(200);
    expect(res.body.currentStage).toBe('ASSESSMENT');
    expect(res.body.status).toBe('W_TOKU');
    expect(res.body.assessmentVersions[0]).toMatchObject({
      status: 'CANCELLED',
      round: 1,
    });
    const employee = await as('t.jankowski')
      .get('/api/cases/c-301')
      .expect(200);
    expect(employee.body.justification).toBe('');
    expect(employee.body.history.at(-1).event.type).toBe(
      'OBJECTION_ASSESSMENT_REDO',
    );
  });

  it('fikcja zapoznania by HR or the evaluator, not by the employee', async () => {
    // c-101: Sikora's case, handed over 2 days ago, not acknowledged.
    await as('j.kaminska')
      .post('/api/cases/c-101/ack-fiction')
      .send({ date: '2026-11-20', reason: 'x' })
      .expect(403);
    await as('a.lis')
      .post('/api/cases/c-101/ack-fiction')
      .send({ date: '2026-11-25', reason: 'Odmowa podpisu' })
      .expect(409);
    const res = await as('a.lis')
      .post('/api/cases/c-101/ack-fiction')
      .send({ date: '2026-11-20', reason: 'Odmowa podpisu potwierdzenia' })
      .expect(200);
    expect(res.body.acknowledgedOn).toBe('2026-11-20');
    expect(res.body.ackFiction.recordedBy).toEqual({
      name: 'Agnieszka Lis',
      role: 'kadry',
    });
    expect(res.body.status).toBe('OKRES_SPRZECIWU');
    expect(res.body.objectionDeadline.date).toBe('2026-11-27');
    await as('r.sikora')
      .post('/api/cases/c-101/ack-fiction')
      .send({ date: '2026-11-20', reason: 'x' })
      .expect(409);
  });

  it('termin-change request: employee files (6-month rule), evaluator decides', async () => {
    const wojcik = await loginAs(app, 'p.wojcik');
    const refused = await withToken(app, wojcik)
      .post('/api/cases/c-002/due-date-request')
      .send({ reason: 'Delegacja' })
      .expect(409);
    expect(refused.body.message).toContain('więcej niż 6 miesięcy');
    await as('j.kaminska')
      .post('/api/cases/c-001/due-date-request')
      .send({ reason: 'x' })
      .expect(403);
    const filed = await as('a.nowak')
      .post('/api/cases/c-001/due-date-request')
      .send({ reason: 'Długotrwała delegacja', proposedDate: '2027-01-15' })
      .expect(200);
    expect(filed.body.dueDateRequests[0].status).toBe('PENDING');
    const team = await as('j.kaminska').get('/api/team').expect(200);
    expect(
      team.body.todo.filter((t: { text: string }) =>
        t.text.includes('wniosek o zmianę terminu'),
      ),
    ).toHaveLength(2);
    await as('a.nowak')
      .post('/api/cases/c-001/due-date-request/decision')
      .send({ approve: true })
      .expect(403);
    const approved = await as('j.kaminska')
      .post('/api/cases/c-001/due-date-request/decision')
      .send({ approve: true, newDate: '2027-02-01' })
      .expect(200);
    expect(approved.body.partI.assessmentDue).toBe('2027-02-01');
    expect(approved.body.dueDateChanges).toHaveLength(1);
    const rejected = await as('j.kaminska')
      .post('/api/cases/c-302/due-date-request/decision')
      .send({ approve: false, note: 'Ocena musi objąć cały okres.' })
      .expect(200);
    expect(rejected.body.dueDateRequests[0].status).toBe('REJECTED');
  });

  it('the assessed person withdraws a pending due-date request', async () => {
    const filed = await as('a.nowak')
      .post('/api/cases/c-001/due-date-request')
      .send({ reason: 'Długotrwała delegacja' })
      .expect(200);
    expect(filed.body.legalActions).toContain('WITHDRAW_DUE_DATE_REQUEST');
    await as('j.kaminska')
      .post('/api/cases/c-001/due-date-request/withdraw')
      .expect(403);
    const res = await as('a.nowak')
      .post('/api/cases/c-001/due-date-request/withdraw')
      .expect(200);
    expect(res.body.dueDateRequests[0].status).toBe('WITHDRAWN');
    expect(res.body.legalActions).not.toContain('WITHDRAW_DUE_DATE_REQUEST');
    expect(res.body.legalActions).toContain('REQUEST_DUE_DATE_CHANGE');
    await as('a.nowak')
      .post('/api/cases/c-001/due-date-request/withdraw')
      .expect(409);
  });
});
