import type { Person } from '../cases/case.types.js';
import { relative } from '../cases/seed/seed-helpers.js';
import { buildSeed, EVALUATORS } from '../cases/seed/seed.data.js';
import type { GradeId } from '../civil-service-grades/data/grades.data.js';
import type { EmployeesSeed } from './employees.repository.js';
import type {
  Absence,
  Employee,
  HistoricalAssessment,
} from './employees.types.js';

/**
 * Demo HR register. Every person is FICTIONAL. People with an assessment
 * case come from the case seed (same ids), the rest only from here. Dates
 * are relative to DEMO_TODAY, except the absence example of "liczenie
 * terminów" (5–16.10.2026 + 19.10–6.11.2026).
 */

const HR_UNIT = 'Wydział Kadr i Szkoleń, Biuro Dyrektora Generalnego';

type Extra = Omit<Employee, 'createdAt' | 'updatedAt' | 'indefiniteSince'> & {
  indefiniteSince: string | null;
};

const GRADES: GradeId[] = ['II', 'III', 'IV', 'III', 'V', 'II'];

export function buildEmployeesSeed(today: string): EmployeesSeed {
  const r = relative(today);
  const stamp = `${today}T08:00:00.000Z`;
  const [kaminska, sikora, pawlak] = EVALUATORS;

  // Latest case of each person decides the evaluator.
  const people = new Map<string, { person: Person; evaluatorId: string }>();
  for (const c of buildSeed(today)) {
    if (!c.nextCaseId)
      people.set(c.person.id, { person: c.person, evaluatorId: c.evaluatorId });
  }
  const fromCases: Employee[] = [...people.values()].map(
    ({ person, evaluatorId }, i) => {
      const urzednik = person.employment === 'URZEDNIK';
      return {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        unit: person.unit,
        position: person.position,
        employment: person.employment,
        officeHead: person.officeHead,
        managesPeople: person.managesPeople,
        appointedYear: urzednik ? Number(person.hiredOn.slice(0, 4)) + 1 : null,
        grade: urzednik ? GRADES[i % GRADES.length] : null,
        gradeGrantedOn: null,
        indefiniteSince: person.hiredOn,
        evaluatorId,
        createdAt: stamp,
        updatedAt: stamp,
      };
    },
  );

  const extra = (
    e: Partial<Extra> &
      Pick<Extra, 'id' | 'firstName' | 'lastName' | 'unit' | 'position'>,
  ): Employee => ({
    employment: 'PRACOWNIK',
    officeHead: false,
    managesPeople: false,
    appointedYear: null,
    grade: null,
    gradeGrantedOn: null,
    indefiniteSince: null,
    evaluatorId: null,
    ...e,
    createdAt: stamp,
    updatedAt: stamp,
  });

  const others: Employee[] = [
    extra({
      id: 'p-jasinska',
      firstName: 'Ewa',
      lastName: 'Jasińska',
      unit: kaminska.unit,
      position: 'Główny specjalista do spraw strategii cyfrowej',
      employment: 'URZEDNIK',
      appointedYear: 2015,
      grade: 'IV',
      gradeGrantedOn: '2020-06-01',
      indefiniteSince: '2013-03-01',
      evaluatorId: kaminska.id,
    }),
    extra({
      id: 'p-kubiak',
      firstName: 'Magdalena',
      lastName: 'Kubiak',
      unit: kaminska.unit,
      position: 'Specjalista do spraw analiz danych',
      employment: 'URZEDNIK',
      appointedYear: 2021,
      grade: 'I',
      gradeGrantedOn: '2021-07-01',
      indefiniteSince: '2019-10-01',
      evaluatorId: kaminska.id,
    }),
    extra({
      id: 'p-pietrzak',
      firstName: 'Tomasz',
      lastName: 'Pietrzak',
      unit: kaminska.unit,
      position: 'Referent do spraw obsługi sekretariatu',
      indefiniteSince: r.days(-10),
      evaluatorId: kaminska.id,
    }),
    extra({
      id: 'p-grabowski',
      firstName: 'Paweł',
      lastName: 'Grabowski',
      unit: sikora.unit,
      position: 'Główny księgowy',
      managesPeople: true,
      employment: 'URZEDNIK',
      appointedYear: 2012,
      grade: 'VI',
      gradeGrantedOn: '2022-03-01',
      indefiniteSince: '2010-09-01',
      evaluatorId: sikora.id,
    }),
    extra({
      id: 'p-wrobel',
      firstName: 'Katarzyna',
      lastName: 'Wróbel',
      unit: sikora.unit,
      position: 'Specjalista do spraw płac',
      indefiniteSince: '2020-02-03',
      evaluatorId: sikora.id,
    }),
    extra({
      id: 'p-michalak',
      firstName: 'Joanna',
      lastName: 'Michalak',
      unit: sikora.unit,
      position: 'Starszy specjalista do spraw sprawozdawczości',
      employment: 'URZEDNIK',
      appointedYear: 2019,
      grade: 'II',
      gradeGrantedOn: '2019-12-01',
      indefiniteSince: '2017-05-02',
      evaluatorId: sikora.id,
    }),
    extra({
      id: 'p-zajac',
      firstName: 'Łukasz',
      lastName: 'Zając',
      unit: pawlak.unit,
      position: 'Starszy legislator',
      employment: 'URZEDNIK',
      appointedYear: 2016,
      grade: 'III',
      gradeGrantedOn: '2021-01-04',
      indefiniteSince: '2014-01-02',
      evaluatorId: pawlak.id,
    }),
    extra({
      id: 'p-krol',
      firstName: 'Aleksandra',
      lastName: 'Król',
      unit: pawlak.unit,
      position: 'Legislator',
      indefiniteSince: '2022-04-01',
      evaluatorId: pawlak.id,
    }),
    extra({
      id: 'p-wieczorek-a',
      firstName: 'Adam',
      lastName: 'Wieczorek',
      unit: pawlak.unit,
      position: 'Radca prawny',
      indefiniteSince: '2018-09-03',
      evaluatorId: pawlak.id,
    }),
    extra({
      id: 'p-sadowska',
      firstName: 'Monika',
      lastName: 'Sadowska',
      unit: HR_UNIT,
      position: 'Kierownik zespołu do spraw szkoleń',
      managesPeople: true,
      employment: 'URZEDNIK',
      appointedYear: 2017,
      grade: 'IV',
      gradeGrantedOn: '2023-02-01',
      indefiniteSince: '2015-06-01',
      evaluatorId: sikora.id,
    }),
    extra({
      id: 'p-czarnecki',
      firstName: 'Jakub',
      lastName: 'Czarnecki',
      unit: HR_UNIT,
      position: 'Specjalista do spraw kadr',
      indefiniteSince: '2023-01-02',
      evaluatorId: sikora.id,
    }),
    extra({
      id: 'p-ostrowska',
      firstName: 'Beata',
      lastName: 'Ostrowska',
      unit: HR_UNIT,
      position: 'Starszy referent do spraw naboru',
      indefiniteSince: '2024-03-01',
      evaluatorId: null,
    }),
  ];

  const absence = (
    a: Omit<Absence, 'createdAt' | 'note'> & { note?: string },
  ): Absence => ({ note: '', ...a, createdAt: stamp });
  const absences: Absence[] = [
    // Example of "liczenie terminów": one continuous absence of 33 days (weekend 17–18.10).
    absence({
      id: 'abs-1',
      employeeId: 'p-lewandowski',
      type: 'ZWOLNIENIE_LEKARSKIE',
      from: '2026-10-05',
      to: '2026-10-16',
      justified: true,
    }),
    absence({
      id: 'abs-2',
      employeeId: 'p-lewandowski',
      type: 'URLOP_WYPOCZYNKOWY',
      from: '2026-10-19',
      to: '2026-11-06',
      justified: true,
    }),
    absence({
      id: 'abs-3',
      employeeId: 'p-wojcik',
      type: 'URLOP_WYPOCZYNKOWY',
      from: r.days(-40),
      to: r.days(-33),
      justified: true,
    }),
    absence({
      id: 'abs-4',
      employeeId: 'p-kubiak',
      type: 'URLOP_MACIERZYNSKI',
      from: r.months(-3),
      to: r.months(3),
      justified: true,
    }),
    absence({
      id: 'abs-5',
      employeeId: 'p-mazur',
      type: 'NIEUSPRAWIEDLIWIONA',
      from: r.days(-20),
      to: r.days(-20),
      justified: false,
    }),
  ];

  const past = (
    id: string,
    employeeId: string,
    assessedOn: string,
    result: 'POSITIVE' | 'NEGATIVE',
    level: string,
  ): HistoricalAssessment => ({
    id,
    employeeId,
    assessedOn,
    acknowledgedOn: assessedOn,
    result,
    level,
    createdAt: stamp,
  });
  const history: HistoricalAssessment[] = [
    // Two consecutive top-level assessments since the last grade: art. 89 ust. 2.
    past(
      'hist-1',
      'p-jasinska',
      r.months(-48),
      'POSITIVE',
      'znacznie powyżej oczekiwań',
    ),
    past(
      'hist-2',
      'p-jasinska',
      r.months(-24, 5),
      'POSITIVE',
      'powyżej oczekiwań',
    ),
    past(
      'hist-3',
      'p-grabowski',
      r.months(-23),
      'POSITIVE',
      'na poziomie oczekiwań',
    ),
    past('hist-4', 'p-wrobel', r.months(-22), 'POSITIVE', 'powyżej oczekiwań'),
    past(
      'hist-5',
      'p-michalak',
      r.months(-26),
      'POSITIVE',
      'na poziomie oczekiwań',
    ),
    past('hist-6', 'p-michalak', r.days(-4), 'NEGATIVE', 'poniżej oczekiwań'),
    past(
      'hist-7',
      'p-zajac',
      r.months(-20),
      'POSITIVE',
      'znacznie powyżej oczekiwań',
    ),
    past(
      'hist-8',
      'p-wieczorek-a',
      r.months(-25),
      'POSITIVE',
      'na poziomie oczekiwań',
    ),
    past(
      'hist-9',
      'p-sadowska',
      r.months(-12),
      'POSITIVE',
      'powyżej oczekiwań',
    ),
  ];

  return {
    employees: [...fromCases, ...others],
    absences,
    substitutions: [
      {
        id: 'sub-1',
        evaluatorId: pawlak.id,
        substituteId: sikora.id,
        from: r.days(-5),
        to: r.days(20),
        note: 'Urlop wypoczynkowy naczelnika wydziału',
        createdAt: stamp,
      },
    ],
    history,
  };
}
