import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('Criteria, sheets and assessments (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    token = await loginAs(app, 'j.kaminska');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => withToken(app, token);

  describe('GET /api/criteria', () => {
    it('returns the catalogue of załącznik nr 1 with descriptions', async () => {
      const res = await http().get('/api/criteria').expect(200);
      expect(res.body.legalBasis).toContain('załącznik nr 1');
      expect(res.body.scale[0]).toEqual({
        points: 1,
        label: 'Znacznie poniżej oczekiwań',
      });
      expect(res.body.criteria).toHaveLength(14);
      expect(res.body.criteria[0]).toMatchObject({
        id: 'komunikacja',
        number: 1,
        name: 'Komunikacja',
      });
      expect(res.body.criteria[0].description).toHaveLength(4);
    });
  });

  describe('GET /api/sheets', () => {
    it('returns the three periodic sheets', async () => {
      const res = await http().get('/api/sheets').expect(200);
      expect(res.body.map((s: { id: string }) => s.id)).toEqual([
        'A',
        'B',
        'C',
      ]);
      expect(res.body[1]).toMatchObject({
        name: 'Arkusz B oceny okresowej',
        scale: [1, 3, 5, 7, 9],
        maxAdditionalCriteria: 3,
        template: {
          annex: 'Załącznik nr 3',
          objectionNotice: expect.stringContaining(
            'art. 83 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej',
          ),
          partIIIApplicability: expect.stringContaining('art. 89 ust. 1'),
        },
      });
      expect(res.body[2].template.annex).toBe('Załącznik nr 4');
    });
  });

  describe('GET /api/civil-service-grades', () => {
    it('returns the nine grades of art. 86 ust. 1', async () => {
      const res = await http().get('/api/civil-service-grades').expect(200);
      expect(res.body.grades.map((g: { id: string }) => g.id)).toEqual([
        'I',
        'II',
        'III',
        'IV',
        'V',
        'VI',
        'VII',
        'VIII',
        'IX',
      ]);
      expect(res.body.legalBasis).toContain('art. 86 ust. 1');
    });
  });

  describe('POST /api/assessments/evaluate', () => {
    const C = [
      'wykorzystywanie_wiedzy',
      'rzetelnosc',
      'organizacja_pracy',
      'wspolpraca',
      'komunikacja',
    ];

    it('evaluates a periodic sheet (E4 edge case)', async () => {
      const res = await http()
        .post('/api/assessments/evaluate')
        .send({
          sheetId: 'C',
          scores: C.map((criterionId) => ({
            criterionId,
            points: criterionId === 'rzetelnosc' ? 1 : 5,
          })),
        })
        .expect(200);
      expect(res.body).toMatchObject({
        averageDisplay: '4,20',
        level: { label: 'Na poziomie oczekiwań', range: '>4–6' },
        result: 'NEGATIVE',
      });
      expect(res.body.average).toBeCloseTo(4.2);
      expect(res.body.reasons.length).toBeGreaterThan(0);
    });

    it('answers 400 with Polish domain messages', async () => {
      const res = await http()
        .post('/api/assessments/evaluate')
        .send({
          sheetId: 'C',
          scores: [{ criterionId: 'rzetelnosc', points: 4 }],
        })
        .expect(400);
      expect(res.body.message).toContain(
        'Ocena kryterium „Rzetelność” musi wynosić 1, 3, 5, 7 lub 9 pkt (podano 4).',
      );
      expect(res.body.message).toContain(
        'Brak oceny kryterium obowiązkowego „Komunikacja” (arkusz C).',
      );
    });

    it('answers 400 for a malformed body', async () => {
      const res = await http()
        .post('/api/assessments/evaluate')
        .send({ sheetId: 'C', scores: 'nope' })
        .expect(400);
      expect(res.body.message[0]).toMatch(/^scores: /);
    });
  });
});
