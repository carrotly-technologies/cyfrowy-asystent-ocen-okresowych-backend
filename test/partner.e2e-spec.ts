import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

// Demo team of j.kaminska: p-nowak (a.nowak), p-wojcik (p.wojcik),
// p-lewandowski, p-mazur, p-szymanski, p-dabrowska, p-zielinska, p-kowalczyk. r.sikora: p-wieczorek,
// p-krawczyk (2 people: team averages hidden).
describe('Virtual HR assistant and pulse survey (e2e)', () => {
  let app: INestApplication<App>;
  const tokens: Record<string, string> = {};
  const as = (login: string) => withToken(app, tokens[login]);
  const answers = {
    workload: 2,
    energy: 3,
    support: 4,
    clarity: 3,
    satisfaction: 3,
  };

  beforeAll(async () => {
    process.env.DEMO_TODAY = '2026-11-21';
    delete process.env.DATABASE_URL;
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_MODEL;
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
    ])
      tokens[login] = await loginAs(app, login);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await as('j.kaminska').post('/api/demo/reset').expect(200);
  });

  describe('pulse (employee)', () => {
    it('GET /api/pulse/me returns only own history, with own comments', async () => {
      const res = await as('p.wojcik').get('/api/pulse/me').expect(200);
      expect(res.body.history).toHaveLength(6);
      expect(
        res.body.history.every(
          (r: { personId: string }) => r.personId === 'p-wojcik',
        ),
      ).toBe(true);
      expect(res.body.history[3].comment).toBe(
        'Mam wrażenie, że ciągle gaszę pożary.',
      );
      expect(res.body.canSubmit).toBe(true);
      expect(res.body.questions).toHaveLength(5);
    });

    it('POST /api/pulse adds today’s response, a second one in the same week is 409', async () => {
      const created = await as('a.nowak')
        .post('/api/pulse')
        .send({ answers, comment: '  Dużo pracy  ', shareComment: false })
        .expect(201);
      expect(created.body).toMatchObject({
        personId: 'p-nowak',
        date: '2026-11-21',
        comment: 'Dużo pracy',
        shareComment: false,
      });
      await as('a.nowak').post('/api/pulse').send({ answers }).expect(409);
    });

    it('validates answers (1–5, all questions)', async () => {
      const res = await as('a.nowak')
        .post('/api/pulse')
        .send({ answers: { ...answers, energy: 7 } })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('1–5');
      await as('a.nowak')
        .post('/api/pulse')
        .send({ answers: { workload: 3 } })
        .expect(400);
    });

    it('only employees fill the pulse; questions are public to signed-in users', async () => {
      await as('j.kaminska').post('/api/pulse').send({ answers }).expect(403);
      await as('j.kaminska').get('/api/pulse/me').expect(403);
      await as('a.lis').get('/api/pulse/questions').expect(200);
    });

    it('PATCH share works only on own response', async () => {
      const me = await as('p.wojcik').get('/api/pulse/me').expect(200);
      const id = me.body.history[3].id;
      await as('a.nowak')
        .patch(`/api/pulse/${id}/share`)
        .send({ shareComment: true })
        .expect(404);
      await as('p.wojcik')
        .patch(`/api/pulse/${id}/share`)
        .send({ shareComment: true })
        .expect(200);
      const card = await as('j.kaminska')
        .get('/api/partner/people/p-wojcik')
        .expect(200);
      expect(card.body.points[3].sharedComment).toBe(
        'Mam wrażenie, że ciągle gaszę pożary.',
      );
    });
  });

  describe('privacy (supervisor)', () => {
    it('per person: flags and one overall index only, no answers to single questions', async () => {
      for (const id of ['p-lewandowski', 'p-wojcik', 'p-nowak']) {
        const card = await as('j.kaminska')
          .get(`/api/partner/people/${id}`)
          .expect(200);
        expect(card.body.points.length).toBeGreaterThan(0);
        for (const p of card.body.points) {
          expect(p).not.toHaveProperty('answers');
          expect(typeof p.index).toBe('number');
        }
        expect(card.body.trend).not.toHaveProperty('droppedQuestions');
        expect(JSON.stringify(card.body)).not.toMatch(
          /\d\/5|"workload"|"energy"/,
        );
      }
      const team = await as('j.kaminska').get('/api/partner/team').expect(200);
      const text = JSON.stringify(team.body.members);
      expect(text).not.toMatch(/answers|\d\/5/);
      for (const period of team.body.aggregate)
        if (period.respondents < 3) expect(period.averages).toBeNull();
    });

    it('the card shows shared comments only; private ones are just marked', async () => {
      const res = await as('j.kaminska')
        .get('/api/partner/people/p-lewandowski')
        .expect(200);
      const text = JSON.stringify(res.body);
      expect(text).not.toContain('pracuję po godzinach');
      expect(res.body.points.at(-1)).toMatchObject({ sharedComment: null });
      // Not even the existence of an unshared comment is revealed.
      expect(text).not.toContain('hasPrivateComment');
      expect(res.body.points.every((p: object) => !('comment' in p))).toBe(
        true,
      );
      const wojcik = await as('j.kaminska')
        .get('/api/partner/people/p-wojcik')
        .expect(200);
      expect(wojcik.body.points.at(-1).sharedComment).toContain(
        'przejęcia spraw kolegi',
      );
      expect(JSON.stringify(wojcik.body)).not.toContain('gaszę pożary');
    });

    it('the team view never carries comments and hides small groups', async () => {
      const team = await as('j.kaminska').get('/api/partner/team').expect(200);
      expect(JSON.stringify(team.body)).not.toMatch(
        /pracuję po godzinach|gaszę pożary/,
      );
      expect(team.body.members).toHaveLength(9);
      expect(team.body.aggregate.at(-1).respondents).toBeGreaterThanOrEqual(3);
      const other = await as('r.sikora').get('/api/partner/team').expect(200);
      expect(
        other.body.aggregate.every(
          (p: { averages: unknown }) => p.averages === null,
        ),
      ).toBe(true);
    });

    it('a supervisor reads only own team; employees and HR have no access', async () => {
      await as('r.sikora').get('/api/partner/people/p-nowak').expect(403);
      await as('j.kaminska').get('/api/partner/people/nie-ma').expect(404);
      await as('a.nowak').get('/api/partner/team').expect(403);
      await as('a.lis').get('/api/partner/people/p-nowak').expect(403);
      await as('r.sikora').get('/api/partner/cases/c-001/hints').expect(403);
    });
  });

  describe('signals, hints and ask', () => {
    it('flags follow the demo patterns, each with reasons and actions', async () => {
      const team = await as('j.kaminska').get('/api/partner/team').expect(200);
      const kinds = (id: string) =>
        team.body.members
          .find((m: { personId: string }) => m.personId === id)
          .signals.map((s: { kind: string }) => s.kind);
      expect(kinds('p-lewandowski')).toEqual(
        expect.arrayContaining(['OVERLOAD', 'BURNOUT_RISK']),
      );
      expect(kinds('p-wojcik')).toEqual(
        expect.arrayContaining(['MOTIVATION_DROP']),
      );
      expect(kinds('p-nowak')).toContain('APPRECIATION');
      expect(kinds('p-mazur')).toContain('APPRECIATION');
      const card = await as('j.kaminska')
        .get('/api/partner/people/p-lewandowski')
        .expect(200);
      for (const s of card.body.signals) {
        expect(s.reasons.length).toBeGreaterThan(0);
        expect(s.actions.length).toBeGreaterThan(0);
      }
    });

    it('case hints: areas, development forms and the decision note', async () => {
      const res = await as('j.kaminska')
        .get('/api/partner/cases/c-001/hints')
        .expect(200);
      expect(res.body.disclaimer).toContain('decyzja należy do przełożonego');
      expect(res.body.disclaimer).toContain('wirtualnego asystenta HR');
      expect(res.body.disclaimer).not.toMatch(/HR partner/);
      expect(
        res.body.areas.map((a: { criterionId: string }) => a.criterionId),
      ).toContain('komunikacja');
      expect(res.body.development[0].forms.length).toBeGreaterThan(0);
      expect(res.body.feedback.length).toBeGreaterThan(0);
    });

    it('ask without LLM answers from rules; the prompt is anonymized', async () => {
      const res = await as('j.kaminska')
        .post('/api/partner/ask')
        .send({
          personId: 'p-lewandowski',
          question: 'Jak porozmawiać z Michałem Lewandowskim o zmęczeniu?',
        })
        .expect(200);
      expect(res.body.mode).toBe('RULES');
      expect(res.body.answer).toContain('sygnał z pulsu');
      expect(res.body.anonymizedPrompt).not.toMatch(/Lewandowsk|Michał/);
      expect(res.body.anonymizedPrompt).toContain('[OSOBA_');
      expect(res.body.anonymizationNote).toContain('zanonimizowane');
      await as('r.sikora')
        .post('/api/partner/ask')
        .send({ personId: 'p-nowak', question: 'Jak docenić?' })
        .expect(403);
    });
  });
});
