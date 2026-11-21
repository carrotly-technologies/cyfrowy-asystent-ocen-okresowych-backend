import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/configure-app.js';
import { loginAs, withToken } from './auth.helpers.js';

describe('HR register: employees, absences, history, statistics (e2e)', () => {
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

  const newEmployee = {
    firstName: 'Jan',
    lastName: 'Testowy',
    unit: 'Wydział Testów',
    position: 'Specjalista',
    employment: 'PRACOWNIK',
    officeHead: false,
    managesPeople: false,
    appointedYear: null,
    grade: null,
    gradeGrantedOn: null,
    indefiniteSince: '2026-11-11',
    evaluatorId: 'ev-kaminska',
  };

  describe('access', () => {
    it('HR sees the whole register (25+ seeded people), sorted by last name', async () => {
      const res = await as(hr).get('/api/employees').expect(200);
      expect(res.body.length).toBeGreaterThanOrEqual(25);
      const names = res.body.map((e: { lastName: string }) => e.lastName);
      expect(names).toEqual(
        [...names].sort((a, b) => a.localeCompare(b, 'pl')),
      );
    });

    it('a supervisor sees only own team, read only', async () => {
      const res = await as(supervisor).get('/api/employees').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(
        res.body.every(
          (e: { evaluatorId: string }) => e.evaluatorId === 'ev-kaminska',
        ),
      ).toBe(true);
      await as(supervisor).get('/api/employees/p-krol').expect(403);
      await as(supervisor).get('/api/employees/p-nowak').expect(200);
      await as(supervisor).post('/api/employees').send(newEmployee).expect(403);
      await as(supervisor)
        .patch('/api/employees/p-nowak')
        .send({ position: 'X' })
        .expect(403);
      await as(supervisor).delete('/api/employees/p-pietrzak').expect(403);
      await as(supervisor).get('/api/statistics').expect(403);
    });

    it('a substitute supervisor sees the team of the evaluator they replace', async () => {
      const sikora = await loginAs(app, 'r.sikora');
      const res = await as(sikora).get('/api/employees').expect(200);
      const ids = res.body.map((e: { id: string }) => e.id);
      expect(ids).toContain('p-gorska'); // evaluated by ev-pawlak, substituted by ev-sikora
    });

    it('an employee gets 403 everywhere', async () => {
      await as(employee).get('/api/employees').expect(403);
      await as(employee).get('/api/statistics').expect(403);
    });

    it('filters by query', async () => {
      const res = await as(hr).get('/api/employees?q=jasi').expect(200);
      expect(res.body.map((e: { id: string }) => e.id)).toEqual(['p-jasinska']);
      const urzednicy = await as(hr)
        .get('/api/employees?employment=URZEDNIK&sheet=B')
        .expect(200);
      expect(
        urzednicy.body.every(
          (e: { employment: string; sheetId: string }) =>
            e.employment === 'URZEDNIK' && e.sheetId === 'B',
        ),
      ).toBe(true);
    });
  });

  describe('create, edit, delete', () => {
    it('ADMIN (technical role) reads the register but does not change it', async () => {
      await as(admin).get('/api/employees').expect(200);
      await as(admin).post('/api/employees').send(newEmployee).expect(403);
      await as(admin)
        .patch('/api/employees/p-wojcik')
        .send({ position: 'X' })
        .expect(403);
      await as(admin).post('/api/employees/p-pietrzak/cycles').expect(403);
    });

    it('lists units and refuses a unit that duplicates an existing one', async () => {
      const units = await as(hr).get('/api/employees/units').expect(200);
      expect(units.body).toContain('Wydział Legislacji, Departament Prawny');
      const res = await as(hr)
        .post('/api/employees')
        .send({ ...newEmployee, unit: 'Wydział Legislacji' })
        .expect(400);
      expect(res.body.message[0]).toContain(
        'jako „Wydział Legislacji, Departament Prawny”',
      );
    });

    it('HR creates and edits; a new evaluator moves open cases', async () => {
      const created = await as(hr)
        .post('/api/employees')
        .send(newEmployee)
        .expect(201);
      expect(created.body).toMatchObject({
        firstName: 'Jan',
        evaluatorName: 'Joanna Kamińska',
        sheetId: 'C',
      });
      const moved = await as(hr)
        .patch('/api/employees/p-wojcik')
        .send({ evaluatorId: 'ev-sikora', position: 'Główny specjalista' })
        .expect(200);
      expect(moved.body.evaluatorName).toBe('Robert Sikora');
      const kase = await as(hr).get('/api/cases/c-002').expect(200);
      expect(kase.body.person.position).toBe('Główny specjalista');
      expect(kase.body.history.at(-1).text).toContain('zmieniły podległość');
    });

    it('validates input in Polish', async () => {
      const res = await as(hr)
        .post('/api/employees')
        .send({ ...newEmployee, firstName: '', evaluatorId: 'nope' })
        .expect(400);
      expect(JSON.stringify(res.body.message)).toContain('imię');
      await as(hr)
        .post('/api/employees')
        .send({ ...newEmployee, evaluatorId: 'nope' })
        .expect(400);
    });

    it('refuses to delete a person with an assessment in progress (409), deletes otherwise', async () => {
      const res = await as(hr).delete('/api/employees/p-nowak').expect(409);
      expect(res.body.message).toContain('ocenę w toku');
      await as(hr).delete('/api/employees/p-pietrzak').expect(204);
      await as(hr).get('/api/employees/p-pietrzak').expect(404);
    });

    it('archives assessed people only after the retention of akta osobowe, or by ADMIN with a reason', async () => {
      const res = await as(hr).delete('/api/employees/p-grabowski').expect(409);
      expect(res.body.message).toContain('art. 94 pkt 9b');
      await as(admin).delete('/api/employees/p-grabowski').expect(409);
      await as(admin)
        .delete('/api/employees/p-grabowski')
        .query({ reason: 'Sprostowanie błędnie założonej kartoteki' })
        .expect(204);
      await as(hr).get('/api/employees/p-grabowski').expect(404);
    });
  });

  describe('obligatory next grade', () => {
    it('one answer in the register and the HR inbox, with a date and the next step', async () => {
      const list = await as(hr).get('/api/employees').expect(200);
      const due = list.body.filter(
        (e: { obligatoryPromotion: { due: boolean } }) =>
          e.obligatoryPromotion.due,
      );
      expect(due.map((e: { id: string }) => e.id)).toEqual(
        expect.arrayContaining(['p-jasinska', 'p-dabrowska']),
      );
      for (const e of due) {
        expect(e.obligatoryPromotion.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(e.obligatoryPromotion.nextStep).toContain(
          'dyrektora generalnego',
        );
      }
      const inbox = await as(hr).get('/api/notifications').expect(200);
      const titles = inbox.body.items
        .filter((n: { type: string }) => n.type === 'OBLIGATORY_GRADE')
        .map((n: { title: string }) => n.title);
      expect(titles.some((t: string) => t.includes('Ewa Jasińska'))).toBe(true);
      expect(
        titles.filter((t: string) => t.includes('Ewa Dąbrowska')),
      ).toHaveLength(1);
    });
  });

  describe('assessment cycle', () => {
    it('previews the opening-talk term before a cycle is started', async () => {
      const res = await as(hr).get('/api/employees/p-pietrzak').expect(200);
      expect(res.body.nextCycle).toMatchObject({ ok: true });
      expect(res.body.nextCycle.openingTalk.date).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      const busy = await as(hr).get('/api/employees/p-nowak').expect(200);
      expect(busy.body.nextCycle).toBeNull();
      expect(busy.body.currentCase.assessmentDue).toMatchObject({
        extended: false,
      });
    });

    it('starts a first cycle from the indefinite employment date', async () => {
      const res = await as(hr)
        .post('/api/employees/p-pietrzak/cycles')
        .expect(201);
      expect(res.body.case.currentStage).toBe('SHEET_SELECTION');
      expect(res.body.case.nextDeadline.legalBasis).toContain(
        '30 dni od zatrudnienia',
      );
      const view = await as(hr).get('/api/employees/p-pietrzak').expect(200);
      expect(view.body.currentCase.id).toBe(res.body.caseId);
      await as(hr).post('/api/employees/p-pietrzak/cycles').expect(409);
    });

    it('after an imported negative assessment: 7 days and previous assessment prefilled', async () => {
      const res = await as(hr)
        .post('/api/employees/p-michalak/cycles')
        .expect(201);
      const detail = await as(hr)
        .get(`/api/cases/${res.body.caseId}`)
        .expect(200);
      expect(detail.body.previousAssessment).toMatchObject({
        result: 'NEGATIVE',
        level: 'poniżej oczekiwań',
      });
      expect(detail.body.nextDeadline.legalBasis).toContain('7 dni');
    });

    it('refuses while a case is open', async () => {
      await as(hr).post('/api/employees/p-nowak/cycles').expect(409);
    });
  });

  describe('absences', () => {
    it('the seeded 33-day absence extends the assessment due date (art. 81 ust. 7)', async () => {
      const res = await as(hr)
        .get('/api/employees/p-lewandowski/absences')
        .expect(200);
      expect(res.body.continuous).toEqual([
        {
          from: '2026-10-05',
          to: '2026-11-06',
          days: 33,
          longerThanMonth: true,
        },
      ]);
      const kase = await as(hr).get('/api/cases/c-003').expect(200);
      expect(kase.body.nextDeadline.legalBasis).toContain('art. 81 ust. 7');
    });

    it('adding and removing an absence changes the deadline', async () => {
      const before = (await as(hr).get('/api/cases/c-201').expect(200)).body
        .nextDeadline.date;
      const added = await as(hr)
        .post('/api/employees/p-baran/absences')
        .send({
          type: 'ZWOLNIENIE_LEKARSKIE',
          from: '2026-06-01',
          to: '2026-07-31',
        })
        .expect(201);
      expect(added.body.justified).toBe(true);
      const after = (await as(hr).get('/api/cases/c-201').expect(200)).body
        .nextDeadline;
      expect(after.date > (before ?? '')).toBe(true);
      await as(hr)
        .delete(`/api/employees/p-baran/absences/${added.body.id}`)
        .expect(204);
      expect(
        (await as(hr).get('/api/cases/c-201').expect(200)).body.nextDeadline
          .date,
      ).toBe(before);
    });

    it('400 for an end before the start; supervisor cannot add', async () => {
      await as(hr)
        .post('/api/employees/p-nowak/absences')
        .send({
          type: 'URLOP_WYPOCZYNKOWY',
          from: '2026-06-10',
          to: '2026-06-01',
        })
        .expect(400);
      await as(supervisor)
        .post('/api/employees/p-nowak/absences')
        .send({
          type: 'URLOP_WYPOCZYNKOWY',
          from: '2026-06-01',
          to: '2026-06-10',
        })
        .expect(403);
    });
  });

  describe('substitutions', () => {
    it('lists, adds and removes', async () => {
      const list = await as(hr).get('/api/substitutions').expect(200);
      expect(list.body[0]).toMatchObject({
        evaluatorName: 'Agnieszka Pawlak',
        substituteName: 'Robert Sikora',
        active: true,
      });
      await as(hr)
        .post('/api/substitutions')
        .send({
          evaluatorId: 'ev-sikora',
          substituteId: 'ev-sikora',
          from: '2026-12-01',
          to: '2026-12-10',
        })
        .expect(400);
      const added = await as(hr)
        .post('/api/substitutions')
        .send({
          evaluatorId: 'ev-kaminska',
          substituteId: 'ev-sikora',
          from: '2026-12-01',
          to: '2026-12-10',
        })
        .expect(201);
      await as(hr).delete(`/api/substitutions/${added.body.id}`).expect(204);
    });
  });

  describe('history and import', () => {
    it('imports a CSV, skips duplicates, reports bad rows', async () => {
      const csv =
        'pracownik;data_sporzadzenia;ocena;poziom\nAleksandra Król;2024-05-06;pozytywna;powyżej oczekiwań\np-krol;2022-05-06;pozytywna;na poziomie oczekiwań\n';
      const res = await as(hr)
        .post('/api/employees/history/import')
        .send({ csv })
        .expect(200);
      expect(res.body).toMatchObject({ imported: 2, skipped: 0 });
      expect(res.body.rows).toEqual([
        expect.objectContaining({
          employeeId: 'p-krol',
          name: 'Aleksandra Król',
          assessedOn: '2024-05-06',
          skipped: false,
        }),
        expect.objectContaining({ employeeId: 'p-krol', skipped: false }),
      ]);
      const again = await as(hr)
        .post('/api/employees/history/import')
        .send({ csv })
        .expect(200);
      expect(again.body).toMatchObject({ imported: 0, skipped: 2 });
      expect(
        again.body.rows.every((r: { skipped: boolean }) => r.skipped),
      ).toBe(true);
      const history = await as(hr)
        .get('/api/employees/p-krol/history')
        .expect(200);
      expect(
        history.body.imported.map((h: { assessedOn: string }) => h.assessedOn),
      ).toEqual(['2024-05-06', '2022-05-06']);
      const bad = await as(hr)
        .post('/api/employees/history/import')
        .send({
          csv: 'pracownik;data_sporzadzenia;ocena;poziom\nNikt;2024-01-01;pozytywna;',
        })
        .expect(400);
      expect(bad.body.message[0]).toContain('Wiersz 2');
    });

    it('history lists system cases of a person', async () => {
      const res = await as(hr)
        .get('/api/employees/p-nowak/history')
        .expect(200);
      expect(res.body.cases.map((c: { caseId: string }) => c.caseId)).toEqual(
        expect.arrayContaining(['c-000', 'c-001']),
      );
      expect(
        res.body.cases.find((c: { caseId: string }) => c.caseId === 'c-000')
          .result,
      ).toBe('POSITIVE');
    });
  });

  describe('employee list import (CSV)', () => {
    const sample = readFileSync(
      resolve(import.meta.dirname, '../docs/import/pracownicy-wzor.csv'),
      'utf8',
    );

    it('previews without saving, then imports 25 people with evaluators and sheets', async () => {
      const before = (await as(hr).get('/api/employees').expect(200)).body
        .length;
      const preview = await as(hr)
        .post('/api/employees/import')
        .send({ csv: sample, dryRun: true })
        .expect(200);
      expect(preview.body).toMatchObject({
        dryRun: true,
        created: 25,
        updated: 0,
        failed: 0,
      });
      expect((await as(hr).get('/api/employees').expect(200)).body.length).toBe(
        before,
      );

      const res = await as(hr)
        .post('/api/employees/import')
        .send({ csv: sample })
        .expect(200);
      expect(res.body).toMatchObject({ dryRun: false, created: 25, failed: 0 });
      const head = await as(hr).get('/api/employees/KAD-0001').expect(200);
      expect(head.body).toMatchObject({
        firstName: 'Zofia',
        evaluatorId: 'ev-zawadzki',
        sheetId: 'A',
        grade: 'VI',
      });
      const manager = await as(hr).get('/api/employees/KAD-0002').expect(200);
      expect(manager.body).toMatchObject({
        evaluatorId: 'ev-kaminska',
        sheetId: 'B',
      });
      const plain = await as(hr).get('/api/employees/KAD-0012').expect(200);
      expect(plain.body).toMatchObject({
        evaluatorId: 'ev-sikora',
        sheetId: 'C',
        employment: 'PRACOWNIK',
      });

      const again = await as(hr)
        .post('/api/employees/import')
        .send({ csv: sample })
        .expect(200);
      expect(again.body).toMatchObject({
        created: 0,
        updated: 0,
        unchanged: 25,
      });
    });

    it('updates by name and unit, keeps good rows when others are bad', async () => {
      const csv = [
        'imię;nazwisko;komórka;stanowisko;kieruje ludźmi;oceniający',
        'Aleksandra;Król;Wydział Legislacji, Departament Prawny;Główny legislator;nie;a.pawlak',
        'Nowa;Osoba;Wydział Legislacji, Departament Prawny;Referent;nie;a.pawlak',
        'Zła;Osoba;Wydział Legislacji, Departament Prawny;Referent;może;ktoś',
        'Nowa;Osoba;Wydział Legislacji, Departament Prawny;Referent;nie;a.pawlak',
      ].join('\n');
      const res = await as(hr)
        .post('/api/employees/import')
        .send({ csv })
        .expect(200);
      expect(res.body).toMatchObject({ created: 1, updated: 1, failed: 2 });
      expect(res.body.rows[0]).toMatchObject({
        line: 2,
        action: 'UPDATE',
        employeeId: 'p-krol',
      });
      expect(res.body.errors.map((e: { line: number }) => e.line)).toEqual([
        4, 5,
      ]);
      expect(res.body.errors[0].message).toContain('Wiersz 4');
      const krol = await as(hr).get('/api/employees/p-krol').expect(200);
      expect(krol.body.position).toBe('Główny legislator');
    });

    it('is for HR only and rejects a file without the header', async () => {
      await as(admin)
        .post('/api/employees/import')
        .send({ csv: sample })
        .expect(403);
      await as(supervisor)
        .post('/api/employees/import')
        .send({ csv: sample })
        .expect(403);
      const bad = await as(hr)
        .post('/api/employees/import')
        .send({ csv: 'a;b\n1;2' })
        .expect(400);
      expect(bad.body.message[0]).toContain('brak kolumn');
    });

    it('serves the sample CSV', async () => {
      const res = await as(hr)
        .get('/api/docs/import/pracownicy-wzor.csv')
        .expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
    });
  });

  describe('statistics and export', () => {
    it('returns aggregates and CSV', async () => {
      const res = await as(hr).get('/api/statistics').expect(200);
      expect(res.body.employees).toBeGreaterThanOrEqual(25);
      const director = await loginAs(app, 'b.wisniewska');
      await as(director).get('/api/statistics').expect(200);
      await as(director).get('/api/employees').expect(403);
      expect(res.body.promotions.obligatory).toBeGreaterThanOrEqual(1);
      expect(res.body.units.length).toBeGreaterThanOrEqual(4);
      expect(res.body.stages).toHaveLength(7);
      const csv = await as(admin).get('/api/statistics/export.csv').expect(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.text).toContain('Odsetek ocen negatywnych');
      const reg = await as(hr).get('/api/employees/export.csv').expect(200);
      expect(reg.text).toContain('Jasińska');
    });
  });
});
