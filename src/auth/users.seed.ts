import type { User } from './user.types.js';

/**
 * Demo accounts (fictional people). Every password is `Ocena2026!` (see
 * README); hashes are scrypt from `node scripts/hash-password.mjs <password>`.
 * Supervisors are linked to EVALUATORS and employees (EMPLOYEE, the assessed
 * person) to `Person.id` of cases in src/cases/seed/seed.data.ts.
 */
export const USER_SEED: readonly (User & { passwordHash: string })[] = [
  {
    id: 'u-kaminska',
    login: 'j.kaminska',
    firstName: 'Joanna',
    lastName: 'Kamińska',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych',
    evaluatorId: 'ev-kaminska',
    personId: null,
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$jzd/0OSRw48ZbZglQQSqhw$ptsLTqhtw6rYDWTuk319LpDZ3sK09stdqz78f5pW3mY',
  },
  {
    id: 'u-sikora',
    login: 'r.sikora',
    firstName: 'Robert',
    lastName: 'Sikora',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Budżetu i Finansów, Biuro Dyrektora Generalnego',
    evaluatorId: 'ev-sikora',
    personId: null,
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$vN02hjw3WtGGUtZm0xztnw$1gBvW1l3fJFjp1JDjQTkhL2l1t7ddjr0VQO5E2HT39w',
  },
  {
    id: 'u-pawlak',
    login: 'a.pawlak',
    firstName: 'Agnieszka',
    lastName: 'Pawlak',
    role: 'SUPERVISOR',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Legislacji, Departament Prawny',
    evaluatorId: 'ev-pawlak',
    personId: null,
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$XfprfNbJskmMw4Tq+T0h9A$m3n9H8BJ3vtV+pzbXpyCqZ6ns5j2ewE8VZS5R4Cj+4s',
  },
  {
    id: 'u-lis',
    login: 'a.lis',
    firstName: 'Agnieszka',
    lastName: 'Lis',
    role: 'HR',
    position: 'Specjalistka ds. kadr',
    unit: 'Biuro Dyrektora Generalnego, Wydział Kadr',
    evaluatorId: null,
    personId: null,
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$L+QheEGNBk8OFsJ4vuY4xQ$yHuMHS3/KryD2aOgzdzSLBL7GeF/S0sBYRc7Q8rDDgE',
  },
  {
    id: 'u-admin',
    login: 'admin',
    firstName: 'Marek',
    lastName: 'Zając',
    role: 'ADMIN',
    position: 'Administrator systemu',
    unit: 'Biuro Informatyki',
    evaluatorId: null,
    personId: null,
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$42iK28FCDXeyoFD58TP8LA$HcENaHP38k1HlYM+7csA8n2yTO7wz/AWalXeOo35sYA',
  },
  {
    id: 'u-nowak',
    login: 'a.nowak',
    firstName: 'Anna',
    lastName: 'Nowak',
    role: 'EMPLOYEE',
    position: 'Radca do spraw regulacji sztucznej inteligencji',
    unit: 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych',
    evaluatorId: null,
    personId: 'p-nowak',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$Kjclg4xeSlqpOhY0H4df0w$C4mD2RxnZ3bInH10CjSvjAjVJB0GUDevi7yZqdj0qKg',
  },
  {
    id: 'u-wojcik',
    login: 'p.wojcik',
    firstName: 'Piotr',
    lastName: 'Wójcik',
    role: 'EMPLOYEE',
    position:
      'Starszy specjalista do spraw zarządzania kryzysowego w cyberprzestrzeni',
    unit: 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych',
    evaluatorId: null,
    personId: 'p-wojcik',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$N5iar5+gwIjUfj+g1T/E6w$XNndSd8FzKNvPtZef861AioCJVJDF7eKBA0H6ift2bo',
  },
  {
    id: 'u-wisniewska',
    login: 'b.wisniewska',
    firstName: 'Barbara',
    lastName: 'Wiśniewska',
    role: 'DIRECTOR',
    position: 'Dyrektor generalny urzędu',
    unit: 'Biuro Dyrektora Generalnego',
    evaluatorId: null,
    personId: null,
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$W9VdOzNWeN/XOTLLejSCAg$1lh/ZDKhBuhyxhQn+TrGQxChfnjlQZX+JAtWrn3fvWc',
  },
  {
    id: 'u-dabrowska',
    login: 'e.dabrowska',
    firstName: 'Ewa',
    lastName: 'Dąbrowska',
    role: 'EMPLOYEE',
    position: 'Główny specjalista do spraw opiniowania aktów prawnych',
    unit: 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych',
    evaluatorId: null,
    personId: 'p-dabrowska',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$JpiAnRtWrrjtyhaJ0BbYPg$zjf2LhZkblyl1cjGIVQoSSes7DVvD+f/hPE+v+RxX1M',
  },
  {
    id: 'u-jankowski',
    login: 't.jankowski',
    firstName: 'Tadeusz',
    lastName: 'Jankowski',
    role: 'EMPLOYEE',
    position: 'Specjalista do spraw zamówień publicznych',
    unit: 'Wydział Budżetu i Finansów, Biuro Dyrektora Generalnego',
    evaluatorId: null,
    personId: 'p-jankowski',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$UIkbhF06+yyEc5rD2KTxRw$1kaE05GKFI2pStrCgcd/iMbs0rJLGD68OQsT7CXYmCA',
  },
  {
    id: 'u-mazur',
    login: 'j.mazur',
    firstName: 'Julia',
    lastName: 'Mazur',
    role: 'EMPLOYEE',
    position: 'Specjalista do spraw analiz danych',
    unit: 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych',
    evaluatorId: null,
    personId: 'p-mazur',
    passwordHash:
      '$scrypt$ln=17,r=8,p=1$dskU4vBTmN5FQD+gj0z/Sg$Ve5p4jKyDy+PJjJketsh68S886ZZgv0USBCHgMTtaZQ',
  },
];
