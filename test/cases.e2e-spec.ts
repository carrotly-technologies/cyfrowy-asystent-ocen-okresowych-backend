import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Cases, team, employee and HR (e2e)', () => {
  let app: INestApplication<App>;
  let supervisor: string;
  let hr: string;
  let nowak: string;
  let wojcik: string;

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    [supervisor, hr, nowak, wojcik] = await Promise.all(
      ['j.kaminska', 'a.lis', 'a.nowak', 'p.wojcik'].map((l) =>
        loginAs(app, l),
      ),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await http().post('/api/demo/reset').expect(200);
  });

  const http = () => withToken(app, supervisor);
  const asHr = () => withToken(app, hr);
  const asNowak = () => withToken(app, nowak);
  const act = (id: string, action: string, token = supervisor) =>
    withToken(app, token).post(`/api/cases/${id}/actions`).send({ action });

  const C_DECISIONS = {
    wykorzystywanie_wiedzy: 7,
    rzetelnosc: 7,
    organizacja_pracy: 5,
    wspolpraca: 7,
    komunikacja: 5,
    myslenie_analityczne: 7,
  };

  it('GET /api/me returns the signed-in supervisor', async () => {
    const res = await http().get('/api/me').expect(200);
    expect(res.body).toEqual({
      id: 'u-kaminska',
      login: 'j.kaminska',
      name: 'Joanna Kamińska',
      role: 'SUPERVISOR',
      position: 'Naczelnik wydziału',
      unit: expect.stringContaining('Wydział'),
      officeName: 'Urząd demonstracyjny (dane fikcyjne)',
    });
  });

  it('GET /api/team returns the current team cases and todo sorted by date', async () => {
    const res = await http().get('/api/team').expect(200);
    expect(res.body.cases.map((c: { id: string }) => c.id)).toEqual([
      'c-001',
      'c-002',
      'c-003',
      'c-004',
      'c-005',
      'c-006',
      'c-007',
      'c-008',
    ]);
    const dates = res.body.todo.map(
      (t: { deadline: { date: string } }) => t.deadline.date,
    );
    expect(dates).toEqual(
      [...dates].sort((a: string, b: string) => a.localeCompare(b)),
    );
    expect(res.body.todo.length).toBeGreaterThan(0);
  });

  it('GET /api/cases/c-001 is the main demo case', async () => {
    const res = await http().get('/api/cases/c-001').expect(200);
    expect(res.body).toMatchObject({
      id: 'c-001',
      sheetId: 'C',
      currentStage: 'ASSESSMENT',
      status: 'W_TOKU',
      sheetSuggestion: { sheetId: 'C', isSuggestionOnly: true },
      availableActions: ['COMPLETE_ASSESSMENT_TALK'],
    });
    expect(res.body.stages.map((s: { id: string }) => s.id)).toEqual([
      'SHEET_SELECTION',
      'OPENING_TALK',
      'PART_I_ACK',
      'OBSERVATION',
      'ASSESSMENT',
      'SIGNATURE',
      'ACKNOWLEDGEMENT',
    ]);
    expect(res.body.observations).toHaveLength(8);
    expect(res.body).not.toHaveProperty('osp');
    expect(res.body).not.toHaveProperty('ratings');
    expect(res.body).not.toHaveProperty('path');
  });

  it('walks c-001 to the acknowledgement by the assessed person', async () => {
    await http()
      .patch('/api/cases/c-001')
      .send({
        decisions: C_DECISIONS,
        iprz: 'Szkolenie z prawa nowych technologii.',
        promotionRequest: { attached: 'NO' },
      })
      .expect(200);
    await act('c-001', 'COMPLETE_ASSESSMENT_TALK').expect(200);
    let res = await act('c-001', 'SIGN_ASSESSMENT').expect(200);
    expect(res.body.signedByEvaluatorOn).toBe('2026-11-21');
    res = await act('c-001', 'SEND_FOR_ACK').expect(200);
    expect(res.body).toMatchObject({
      currentStage: 'ACKNOWLEDGEMENT',
      status: 'DO_ZAPOZNANIA',
      // The supervisor can no longer confirm for the assessed person.
      availableActions: [],
    });
    await act('c-001', 'EMPLOYEE_ACK_ASSESSMENT').expect(403);

    const mine = await asNowak().get('/api/cases/c-001').expect(200);
    expect(mine.body.availableActions).toEqual(['EMPLOYEE_ACK_ASSESSMENT']);
    expect(mine.body.decisions).toEqual(C_DECISIONS); // handed over: visible
    res = await act('c-001', 'EMPLOYEE_ACK_ASSESSMENT', nowak).expect(200);
    expect(res.body).toMatchObject({
      status: 'OKRES_SPRZECIWU',
      acknowledgedOn: '2026-11-21',
      objectionDeadline: { date: '2026-11-30' },
    });
  });

  it('the assessed person reads only their own cases, read-only', async () => {
    const list = await asNowak().get('/api/cases').expect(200);
    expect(list.body.map((c: { id: string }) => c.id)).toEqual([
      'c-000',
      'c-001',
    ]);
    const detail = await asNowak().get('/api/cases/c-001').expect(200);
    // Before the hand-over: no observations, no draft of part II.
    expect(detail.body.observations).toEqual([]);
    expect(detail.body.formalCheck).toEqual([]);
    expect(detail.body.availableActions).toEqual([]);
    await asNowak().get('/api/cases/c-002').expect(403);
    await asNowak().patch('/api/cases/c-001').send({ iprz: 'x' }).expect(403);
    await act('c-001', 'COMPLETE_ASSESSMENT_TALK', nowak).expect(403);
    await asNowak().get('/api/team').expect(403);
    await asNowak().get('/api/hr/overview').expect(403);
  });

  it('only the assessed person confirms part I', async () => {
    let res = await http().get('/api/cases/c-002').expect(200);
    expect(res.body.currentStage).toBe('PART_I_ACK');
    expect(res.body.availableActions).toEqual([]);
    await act('c-002', 'EMPLOYEE_ACK_PART_I').expect(403);
    await act('c-002', 'EMPLOYEE_ACK_PART_I', nowak).expect(403);
    res = await act('c-002', 'EMPLOYEE_ACK_PART_I', wojcik).expect(200);
    expect(res.body).toMatchObject({
      currentStage: 'OBSERVATION',
      partI: { acknowledgedByEmployeeOn: '2026-11-21' },
    });
  });

  it('sheet selection: suggestion, additional criteria from the catalogue, acceptance', async () => {
    let res = await http().get('/api/cases/c-004').expect(200);
    expect(res.body).toMatchObject({
      currentStage: 'SHEET_SELECTION',
      sheetId: null,
      sheetSuggestion: {
        sheetId: 'C',
        legalBasis: expect.stringContaining('§3 ust. 4'),
      },
      availableActions: ['ACCEPT_SHEET'],
    });
    await http()
      .patch('/api/cases/c-004')
      .send({ partI: { additionalCriteria: ['kreatywnosc', 'kreatywnosc'] } })
      .expect(400);
    await http()
      .patch('/api/cases/c-004')
      .send({
        sheetId: 'C',
        partI: {
          additionalCriteria: ['kreatywnosc', 'orientacja_na_klienta'],
          assessmentDue: '2028-11-30',
        },
      })
      .expect(200);
    res = await act('c-004', 'ACCEPT_SHEET').expect(200);
    expect(res.body).toMatchObject({
      currentStage: 'OPENING_TALK',
      sheetId: 'C',
      partI: { assessmentDue: '2028-11-30' },
    });
  });

  it('illegal action -> 409 with a Polish explanation; unknown action -> 400', async () => {
    const res = await act('c-004', 'SIGN_ASSESSMENT').expect(409);
    expect(res.body.message).toMatch(/^Akcja „.+” jest teraz niedostępna\./);
    await act('c-004', 'ACCEPT_OSP_ANALYSIS').expect(400);
  });

  it('SIGN_ASSESSMENT with failing formal checks -> 409 with the list', async () => {
    await act('c-001', 'COMPLETE_ASSESSMENT_TALK').expect(200);
    const res = await act('c-001', 'SIGN_ASSESSMENT').expect(409);
    expect(res.body.formalCheck.map((f: { id: string }) => f.id)).toContain(
      'IPRZ_REQUIRED',
    );
  });

  it('adds an observation to a case criterion only', async () => {
    const observation = {
      date: '2026-11-20',
      criterionId: 'negocjowanie',
      kind: 'STRENGTH',
      situation: 'Negocjacje z partnerem.',
      action: 'Przygotował stanowisko.',
      result: 'Termin dotrzymany.',
    };
    const res = await http()
      .post('/api/cases/c-003/observations')
      .send(observation)
      .expect(201);
    expect(res.body.observations).toHaveLength(5);
    await http()
      .post('/api/cases/c-003/observations')
      .send({ ...observation, criterionId: 'rzetelnosc' })
      .expect(400);
  });

  it('HR overview counts and simulated reminders', async () => {
    let res = await asHr().get('/api/hr/overview').expect(200);
    expect(res.body.cases).toHaveLength(14);
    expect(res.body.counters).toMatchObject({
      awaitingAck: 1,
      objectionPeriod: 1,
    });
    res = await asHr()
      .post('/api/hr/reminders')
      .send({ caseIds: ['c-102', 'c-103'] })
      .expect(200);
    expect(res.body.sent).toBe(2);
    expect(res.body.log[0].text).toContain('Robert Sikora');
    await asHr()
      .post('/api/hr/reminders')
      .send({ caseIds: ['nope'] })
      .expect(404);
  });

  it('POST /api/demo/reset restores the seed', async () => {
    await act('c-004', 'ACCEPT_SHEET').expect(200);
    await http().post('/api/demo/reset').expect(200);
    const res = await http().get('/api/cases/c-004').expect(200);
    expect(res.body.currentStage).toBe('SHEET_SELECTION');
  });
});
