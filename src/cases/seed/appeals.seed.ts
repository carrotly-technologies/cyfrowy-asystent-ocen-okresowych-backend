import type { CaseRecord } from '../case.types.js';
import { defaultAssessmentDue } from '../deadlines.rules.js';
import { formatDatePl } from '../dates.js';
import { emptyPromotionRequest } from '../promotion.rules.js';
import {
  caseRecord,
  emptyPartI,
  previousAssessment,
  relative,
} from './seed-helpers.js';

/**
 * Demo cases of the post-assessment paths (FICTIONAL people): an objection
 * waiting for the dyrektor generalny (c-301) and a pending request of the
 * assessed person to change the assessment date (c-302). The case in the
 * objection period is c-006 (seed.data.ts).
 */
type Rel = ReturnType<typeof relative>;

const BUDGET_UNIT = 'Wydział Budżetu i Finansów, Biuro Dyrektora Generalnego';
const TEAM_UNIT = 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych';

export function appealsSeed(r: Rel): CaseRecord[] {
  return [
    objectionAwaitingDirector(r),
    dueDateRequestPending(r),
    sheetAWaitingForAck(r),
  ];
}

/**
 * Sheet A (kierownik urzędu): the signed assessment was handed over and waits
 * for the assessed person (login m.wasilewska). A sprzeciw goes to the person who
 * made the assessment (art. 83 ust. 2), who decides it (login k.zawadzki).
 */
function sheetAWaitingForAck(r: Rel): CaseRecord {
  const cycleStart = {
    kind: 'PREVIOUS_POSITIVE' as const,
    assessedOn: r.months(-24, 2),
  };
  const confirmed = r.months(-24, 20);
  const talk = r.days(-4);
  const signed = r.days(-2);
  return caseRecord({
    id: 'c-202',
    person: {
      id: 'p-wasilewska',
      firstName: 'Marta',
      lastName: 'Wasilewska',
      position: 'Prezes agencji rządowej (kierownik urzędu)',
      unit: 'Agencja rządowa (dane demonstracyjne)',
      employment: 'URZEDNIK',
      hiredOn: '2017-04-03',
      officeHead: true,
      managesPeople: true,
    },
    evaluatorId: 'ev-zawadzki',
    sheetId: 'A',
    cycleStart,
    previousAssessment: previousAssessment(cycleStart, 'powyżej oczekiwań'),
    promotionRequest: { ...emptyPromotionRequest('URZEDNIK'), attached: 'NO' },
    stage: 'ACKNOWLEDGEMENT',
    completedOn: {
      SHEET_SELECTION: confirmed,
      OPENING_TALK: confirmed,
      PART_I_ACK: confirmed,
      OBSERVATION: r.days(-6),
      ASSESSMENT: talk,
      SIGNATURE: signed,
    },
    partI: {
      ...emptyPartI(),
      assessmentDue: defaultAssessmentDue(cycleStart.assessedOn),
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    decisions: {
      zarzadzanie_ludzmi: 7,
      podejmowanie_decyzji: 5,
      organizacja_pracy: 7,
      wspolpraca: 5,
      komunikacja: 7,
      zarzadzanie_strategiczne: 5,
    },
    justification:
      'Agencja zrealizowała plan działalności w terminie; wdrożono nowy system obsługi wniosków. Decyzje dotyczące reorganizacji departamentów podejmowano z opóźnieniem, a strategia na kolejne lata wymaga doprecyzowania mierników.',
    iprz: 'Szkolenie z zarządzania strategicznego w administracji (I półrocze); przegląd mierników planu działalności z udziałem dyrektorów departamentów.',
    assessmentTalkOn: talk,
    signedByEvaluatorOn: signed,
    sentForAckOn: signed,
    history: [
      {
        date: confirmed,
        text: 'Rozmowa rozpoczynająca. Zatwierdzono część I (arkusz A).',
      },
      {
        date: signed,
        text: 'Oceniający podpisał ocenę: pozytywna, „Na poziomie oczekiwań” (średnia 6,00). Ocenę przekazano do zapoznania.',
      },
    ],
  });
}

function objectionAwaitingDirector(r: Rel): CaseRecord {
  const confirmed = r.months(-24, 9);
  const signed = r.days(-6);
  const acknowledged = r.days(-4);
  const filed = r.days(-2);
  const cycleStart = {
    kind: 'PREVIOUS_POSITIVE' as const,
    assessedOn: r.months(-24),
  };
  return caseRecord({
    id: 'c-301',
    person: {
      id: 'p-jankowski',
      firstName: 'Tadeusz',
      lastName: 'Jankowski',
      position: 'Specjalista do spraw zamówień publicznych',
      unit: BUDGET_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2015-03-02',
      officeHead: false,
      managesPeople: false,
    },
    evaluatorId: 'ev-sikora',
    sheetId: 'C',
    cycleStart,
    previousAssessment: previousAssessment(cycleStart, 'na poziomie oczekiwań'),
    promotionRequest: { ...emptyPromotionRequest('URZEDNIK'), attached: 'NO' },
    stage: 'ACKNOWLEDGEMENT',
    completedOn: {
      SHEET_SELECTION: confirmed,
      OPENING_TALK: confirmed,
      PART_I_ACK: confirmed,
      OBSERVATION: r.days(-10),
      ASSESSMENT: r.days(-8),
      SIGNATURE: signed,
      ACKNOWLEDGEMENT: acknowledged,
    },
    partI: {
      ...emptyPartI(),
      assessmentDue: defaultAssessmentDue(cycleStart.assessedOn),
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    decisions: {
      wykorzystywanie_wiedzy: 5,
      rzetelnosc: 3,
      organizacja_pracy: 3,
      wspolpraca: 5,
      komunikacja: 5,
    },
    justification:
      'Postępowania o udzielenie zamówienia prowadzone zgodnie z przepisami; dwukrotnie przekroczono wewnętrzne terminy przygotowania dokumentacji, co opóźniło ogłoszenie przetargów.',
    iprz: 'Szkolenie z planowania postępowań o udzielenie zamówienia; harmonogram postępowań uzgadniany z naczelnikiem co kwartał.',
    assessmentTalkOn: r.days(-8),
    signedByEvaluatorOn: signed,
    sentForAckOn: signed,
    acknowledgedOn: acknowledged,
    objections: [
      {
        id: 'c-301-obj-1',
        round: 1,
        filedOn: filed,
        text: 'Nie zgadzam się z oceną kryteriów „Rzetelność” oraz „Organizacja pracy i orientacja na osiąganie celów”. Opóźnienia wynikały z późnego przekazania opisów przedmiotu zamówienia przez komórki merytoryczne, co zgłaszałem na bieżąco (notatki służbowe z marca i czerwca).',
        decision: null,
      },
    ],
    history: [
      {
        date: signed,
        text: 'Oceniający podpisał ocenę: pozytywna (średnia 4,20). Ocenę przekazano do zapoznania.',
      },
      {
        date: acknowledged,
        text: 'Oceniany zapoznał się z oceną. Biegnie 7-dniowy termin na sprzeciw (art. 83 ust. 1 ustawy o służbie cywilnej).',
      },
      {
        date: filed,
        text: 'Oceniany wniósł sprzeciw od oceny do dyrektora generalnego urzędu (art. 83 ust. 1 ustawy o służbie cywilnej).',
        event: {
          type: 'OBJECTION_FILED',
          notify: ['DIRECTOR', 'EVALUATOR', 'HR'],
        },
      },
    ],
  });
}

function dueDateRequestPending(r: Rel): CaseRecord {
  const cycleStart = {
    kind: 'PREVIOUS_POSITIVE' as const,
    assessedOn: r.months(-14),
  };
  const confirmed = r.months(-14, 12);
  const due = defaultAssessmentDue(cycleStart.assessedOn);
  const filed = r.days(-1);
  return caseRecord({
    id: 'c-302',
    person: {
      id: 'p-michalska',
      firstName: 'Katarzyna',
      lastName: 'Michalska',
      position: 'Starszy specjalista do spraw koordynacji projektów cyfrowych',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2018-06-01',
      officeHead: false,
      managesPeople: false,
    },
    evaluatorId: 'ev-kaminska',
    sheetId: 'C',
    cycleStart,
    previousAssessment: previousAssessment(cycleStart, 'na poziomie oczekiwań'),
    stage: 'OBSERVATION',
    completedOn: {
      SHEET_SELECTION: confirmed,
      OPENING_TALK: confirmed,
      PART_I_ACK: confirmed,
    },
    partI: {
      ...emptyPartI(),
      assessmentDue: due,
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    dueDateRequests: [
      {
        id: 'c-302-ddr-1',
        filedOn: filed,
        reason:
          'Od lutego przechodzę do zespołu wdrożeniowego na 4 miesiące; proszę o przeprowadzenie oceny przed zmianą zadań, póki oceniająca zna moją dotychczasową pracę.',
        proposedDate: r.days(45),
        status: 'PENDING',
        decidedOn: null,
        decisionNote: null,
        newDate: null,
        decidedBy: null,
      },
    ],
    history: [
      {
        date: confirmed,
        text: `Rozmowa rozpoczynająca. Zatwierdzono część I; termin oceny ${formatDatePl(due)}.`,
      },
      {
        date: filed,
        text: 'Oceniany złożył wniosek o zmianę terminu oceny (art. 81 ust. 8 pkt 4 ustawy o służbie cywilnej).',
        event: { type: 'DUE_DATE_CHANGE_REQUESTED', notify: ['EVALUATOR'] },
      },
    ],
  });
}
