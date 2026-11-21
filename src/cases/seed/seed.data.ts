import type { CaseRecord, Evaluator } from '../case.types.js';
import { defaultAssessmentDue } from '../deadlines.rules.js';
import { addDays, addMonths, formatDatePl } from '../dates.js';
import { emptyPromotionRequest } from '../promotion.rules.js';
import {
  caseRecord,
  emptyPartI,
  observations,
  previousAssessment,
  relative,
} from './seed-helpers.js';
import { appealsSeed } from './appeals.seed.js';

/**
 * Demo data (notatki/ux-koncepcja.md, "Dane demonstracyjne"). Every person,
 * unit and event is FICTIONAL. All
 * dates are relative to DEMO_TODAY, so the demo looks the same on any day.
 */

export const OFFICE_NAME = 'Urząd demonstracyjny (dane fikcyjne)';
export const SUPERVISOR_ID = 'ev-kaminska';
/** Assessed people with their own EMPLOYEE account (src/auth/users.seed.ts). */
export const EMPLOYEE_NOWAK = 'p-nowak';
export const EMPLOYEE_WOJCIK = 'p-wojcik';
export const EMPLOYEE_MAZUR = 'p-mazur';
const TEAM_UNIT = 'Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych';

export const EVALUATORS: readonly Evaluator[] = [
  {
    id: SUPERVISOR_ID,
    firstName: 'Joanna',
    lastName: 'Kamińska',
    position: 'Naczelnik wydziału',
    unit: TEAM_UNIT,
  },
  {
    id: 'ev-sikora',
    firstName: 'Robert',
    lastName: 'Sikora',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Budżetu i Finansów, Biuro Dyrektora Generalnego',
  },
  {
    id: 'ev-pawlak',
    firstName: 'Agnieszka',
    lastName: 'Pawlak',
    position: 'Naczelnik wydziału',
    unit: 'Wydział Legislacji, Departament Prawny',
  },
  {
    id: 'ev-zawadzki',
    firstName: 'Krzysztof',
    lastName: 'Zawadzki',
    position: 'Sekretarz stanu',
    unit: 'Kierownictwo ministerstwa (dane demonstracyjne)',
  },
];

export function buildSeed(today: string): CaseRecord[] {
  const r = relative(today);
  return [
    previousNowakCase(r),
    mainCase(r),
    partIAckCase(r),
    sheetBCase(r),
    sheetSelectionCase(r),
    afterNegativeCase(r),
    objectionPeriodCase(r),
    negativeSignatureCase(r),
    teamLeaderDraftCase(r),
    ...otherUnitCases(r),
    ...appealsSeed(r),
  ];
}

type Rel = ReturnType<typeof relative>;

/** Date of Anna Nowak's previous assessment (end of case c-000). */
function nowakPreviousOn(r: Rel): string {
  return r.workday(r.months(-24, 13).replace(/-\d\d$/, '-01'));
}

/** Anna Nowak's previous cycle, finished 2 years ago (account a.nowak sees both). */
function previousNowakCase(r: Rel): CaseRecord {
  const signed = nowakPreviousOn(r);
  const talk = r.workday(addDays(signed, -2));
  const acknowledged = r.workday(addDays(signed, 1));
  // The cycle started ~24 months before it was assessed (art. 81 ust. 4).
  const assessedBefore = r.workday(addDays(addMonths(signed, -24), 5));
  const confirmed = r.workday(addDays(assessedBefore, 14));
  return caseRecord({
    id: 'c-000',
    person: {
      id: EMPLOYEE_NOWAK,
      firstName: 'Anna',
      lastName: 'Nowak',
      position: 'Radca do spraw regulacji sztucznej inteligencji',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2017-04-03',
      officeHead: false,
      managesPeople: false,
    },
    evaluatorId: SUPERVISOR_ID,
    sheetId: 'C',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: assessedBefore },
    promotionRequest: { ...emptyPromotionRequest('URZEDNIK'), attached: 'NO' },
    stage: 'ACKNOWLEDGEMENT',
    completedOn: {
      SHEET_SELECTION: confirmed,
      OPENING_TALK: confirmed,
      PART_I_ACK: confirmed,
      OBSERVATION: talk,
      ASSESSMENT: talk,
      SIGNATURE: signed,
      ACKNOWLEDGEMENT: acknowledged,
    },
    partI: {
      ...emptyPartI(),
      additionalCriteria: ['myslenie_analityczne'],
      assessmentDue: defaultAssessmentDue(assessedBefore),
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    decisions: {
      wykorzystywanie_wiedzy: 7,
      rzetelnosc: 7,
      organizacja_pracy: 7,
      wspolpraca: 7,
      komunikacja: 5,
      myslenie_analityczne: 9,
    },
    justification:
      'Opinie przygotowywane terminowo i bez poprawek merytorycznych; wyróżniająca jakość analiz.',
    iprz: 'Szkolenie z prawa nowych technologii UE; udział w pracach zespołu ds. wdrożenia aktu w sprawie AI.',
    assessmentTalkOn: talk,
    signedByEvaluatorOn: signed,
    sentForAckOn: signed,
    acknowledgedOn: acknowledged,
    nextCaseId: 'c-001',
    history: [
      {
        date: signed,
        text: 'Oceniający podpisał ocenę: pozytywna, „Powyżej oczekiwań”. Ocenę przekazano do zapoznania.',
      },
      { date: acknowledged, text: 'Oceniany zapoznał się z oceną.' },
    ],
  });
}

/** Main demo path: sheet C, in the assessment stage (draft scores), 8 observations. */
function mainCase(r: Rel): CaseRecord {
  const id = 'c-001';
  // Previous assessment ~24 months ago, so this one is due in ~1–2 weeks
  // (24 months from the previous assessment, art. 81 ust. 4).
  const confirmed = r.months(-24, 13);
  const previous = nowakPreviousOn(r);
  const due = defaultAssessmentDue(previous);
  const startedAssessment = r.days(-2);
  return caseRecord({
    id,
    person: {
      id: EMPLOYEE_NOWAK,
      firstName: 'Anna',
      lastName: 'Nowak',
      position: 'Radca do spraw regulacji sztucznej inteligencji',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2017-04-03',
      officeHead: false,
      managesPeople: false,
    },
    evaluatorId: SUPERVISOR_ID,
    sheetId: 'C',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: previous },
    previousAssessment: previousAssessment(
      { kind: 'PREVIOUS_POSITIVE', assessedOn: previous },
      'powyżej oczekiwań',
    ),
    talkInvitations: [
      {
        id: `${id}-talk-1`,
        kind: 'ASSESSMENT',
        date: r.workday(addDays(r.days(0), 6)),
        time: '10:00',
        place: 'Pokój 204 (sala narad wydziału)',
        note: 'Proszę o przygotowanie krótkiej samooceny realizacji celów z części I.',
        createdOn: r.days(-1),
      },
    ],
    stage: 'ASSESSMENT',
    completedOn: {
      SHEET_SELECTION: r.workday(confirmed.replace(/-\d\d$/, '-02')),
      OPENING_TALK: confirmed,
      PART_I_ACK: confirmed,
      OBSERVATION: startedAssessment,
    },
    partI: {
      additionalCriteria: ['myslenie_analityczne'],
      assessmentDue: due,
      topics: {
        duties:
          'Omówiono zadania z OSP DSI WWI 5: analizy prawa krajowego i unijnego w obszarze AI, opinie indywidualne, projekty stanowisk Komisji, odpowiedzi na wystąpienia zewnętrzne. Priorytet na 2025 r.: opinie dotyczące systemów wysokiego ryzyka.',
        criteria:
          'Pięć kryteriów obowiązkowych arkusza C oraz kryterium dodatkowe „Myślenie analityczne”: przeważająca część zadań to analiza przepisów, orzecznictwa i wytycznych oraz formułowanie rekomendacji.',
        expectations:
          'Uzgodniono oczekiwania na poziomie „na poziomie oczekiwań” dla wszystkich kryteriów; szczególny nacisk na terminowość opinii i przystępność pism kierowanych do podmiotów spoza administracji.',
        goals:
          '1) Przygotowanie wzoru opinii indywidualnej do końca I kwartału 2025 r. 2) Udział w co najmniej jednym szkoleniu z wytycznych Komisji Europejskiej do aktu w sprawie AI.',
      },
      expectations: {
        wykorzystywanie_wiedzy:
          'Stosuje aktualne przepisy aktu w sprawie AI i RODO w opiniach; śledzi wytyczne organów UE i dzieli się wnioskami z wydziałem.',
        rzetelnosc:
          'Opinie i projekty stanowisk zgodne z procedurą wydziału, sprawdzone przed przekazaniem; terminy ustawowe dotrzymane, ryzyko opóźnienia zgłaszane z wyprzedzeniem.',
        organizacja_pracy:
          'Planuje pracę nad opiniami z terminami cząstkowymi; przy zbiegu zadań uzgadnia priorytety z naczelnikiem.',
        wspolpraca:
          'Przekazuje zespołowi ustalenia z prac Komisji; wspiera nowe osoby wzorami i przykładami z ukończonych spraw.',
        komunikacja:
          'Pisma do podmiotów zewnętrznych są zwięzłe, z odpowiedzią na pytania na początku; w rozmowach dostosowuje język do odbiorcy.',
        myslenie_analityczne:
          'Odróżnia ustalenia od przypuszczeń, wskazuje zależności między przepisami i formułuje wnioski z ich podstawą oraz ograniczeniami.',
      },
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    observations: observations(id, [
      {
        date: r.months(-21, 10),
        criterionId: 'rzetelnosc',
        kind: 'STRENGTH',
        situation:
          'Do wydziału wpłynęło 14 wniosków o opinie indywidualne dotyczące klasyfikacji systemów AI jako systemów wysokiego ryzyka, z terminem 30 dni.',
        action:
          'Rozpisała harmonogram z terminami cząstkowymi. Po tygodniu zgłosiła, że dwa wnioski wymagają uzupełnienia, i uzgodniła treść wezwań.',
        result:
          'Wszystkie opinie trafiły do podpisu w terminie; żadna sprawa nie wymagała przedłużenia terminu.',
      },
      {
        date: r.months(-18, 5),
        criterionId: 'komunikacja',
        kind: 'DEVELOPMENT',
        situation:
          'Projekt odpowiedzi na pismo stowarzyszenia branżowego w sprawie obowiązków dostawców modeli AI ogólnego przeznaczenia.',
        action:
          'Przygotowała sześciostronicowy projekt z obszerną analizą przepisów, bez wyodrębnienia odpowiedzi na trzy zadane pytania.',
        result:
          'Projekt wrócił z prośbą o skrócenie. Druga wersja (dwie strony, odpowiedzi w punktach) została przyjęta bez uwag. Ustaliłyśmy, że pisma zewnętrzne zaczynają się od krótkiej odpowiedzi.',
      },
      {
        date: r.months(-15, 12),
        criterionId: 'myslenie_analityczne',
        kind: 'STRENGTH',
        situation:
          'Analiza barier prawnych dla piaskownic regulacyjnych AI na potrzeby posiedzenia Komisji.',
        action:
          'Zestawiła wymogi aktu w sprawie AI z przepisami RODO i prawa zamówień publicznych, wskazała dwie kolizje przepisów i oddzieliła je od problemów wynikających z praktyki urzędów.',
        result:
          'Analizę włączono do materiałów na posiedzenie; dwie rekomendacje trafiły do założeń projektu nowelizacji.',
      },
      {
        date: r.months(-12, 3),
        criterionId: 'wspolpraca',
        kind: 'STRENGTH',
        situation:
          'Do wydziału dołączyły dwie nowe osoby bez doświadczenia w opiniowaniu.',
        action:
          'Z własnej inicjatywy przygotowała zestaw wzorów opinii i listę najczęstszych pytań wnioskodawców oraz poprowadziła dwa krótkie spotkania instruktażowe.',
        result:
          'Po miesiącu nowe osoby samodzielnie przygotowywały projekty prostych opinii.',
      },
      {
        date: r.months(-9, 8),
        criterionId: 'organizacja_pracy',
        kind: 'DEVELOPMENT',
        situation:
          'W jednym tygodniu zbiegły się: projekt stanowiska na posiedzenie Komisji i uwagi do projektu ustawy w uzgodnieniach międzyresortowych.',
        action:
          'Kontynuowała pracę nad stanowiskiem; o zagrożeniu terminu uwag poinformowała w dniu jego upływu.',
        result:
          'Uwagi wysłano z jednodniowym opóźnieniem, po uzgodnieniu z organizatorem uzgodnień. Omówiłyśmy, jak sygnalizować kolizję terminów z wyprzedzeniem.',
      },
      {
        date: r.months(-6, 2),
        criterionId: 'wykorzystywanie_wiedzy',
        kind: 'STRENGTH',
        situation:
          'Komisja Europejska opublikowała wytyczne dotyczące praktyk zakazanych w obszarze AI.',
        action:
          'Wzięła udział w szkoleniu z wytycznych i opracowała dla wydziału notatkę z wnioskami dla opinii indywidualnych.',
        result:
          'Notatka stała się podstawą aktualizacji wzoru opinii; spadła liczba pytań uzupełniających od wnioskodawców.',
      },
      {
        date: r.months(-3, 4),
        criterionId: 'komunikacja',
        kind: 'DEVELOPMENT',
        situation:
          'Spotkanie konsultacyjne z przedstawicielami młodych firm technologicznych.',
        action:
          'Odpowiadała na pytania językiem przepisów, bez przykładów; dwie osoby prosiły o ponowne wyjaśnienie.',
        result:
          'Sama zaproponowała zestaw pytań i odpowiedzi napisany prostym językiem. Na kolejnym spotkaniu korzystała z przykładów i nie było pytań doprecyzowujących.',
      },
      {
        date: r.days(-24),
        criterionId: 'myslenie_analityczne',
        kind: 'STRENGTH',
        situation:
          'Rozbieżne interpretacje wydziału i organu ochrony danych co do podstawy przetwarzania danych przy trenowaniu modeli.',
        action:
          'Przedstawiła dwa warianty wniosków, dla każdego podała podstawę w orzecznictwie TSUE i ograniczenia dostępnych danych.',
        result:
          'Dyrektor wybrał wariant rekomendowany; stanowisko uzgodniono bez dodatkowej rundy uwag.',
      },
    ]),
    history: [
      {
        date: previous,
        text: 'Sporządzono poprzednią ocenę okresową: pozytywna, „Powyżej oczekiwań”.',
      },
      {
        date: confirmed,
        text: `Rozmowa rozpoczynająca. Oceniający zatwierdził część I (kryterium dodatkowe: Myślenie analityczne), termin sporządzenia oceny: ${formatDatePl(due)}. Oceniany potwierdził zapoznanie.`,
      },
      {
        date: startedAssessment,
        text: 'Otwarto formularz oceny kompetencji (część II arkusza).',
      },
    ],
  });
}

/** Part I confirmed by the evaluator yesterday; waits for the assessed person (account p.wojcik). */
function partIAckCase(r: Rel): CaseRecord {
  const previous = r.days(-11);
  const confirmed = r.days(-1);
  return caseRecord({
    id: 'c-002',
    person: {
      id: EMPLOYEE_WOJCIK,
      firstName: 'Piotr',
      lastName: 'Wójcik',
      position:
        'Starszy specjalista do spraw zarządzania kryzysowego w cyberprzestrzeni',
      unit: TEAM_UNIT,
      employment: 'PRACOWNIK',
      hiredOn: '2019-10-01',
      officeHead: false,
      managesPeople: false,
    },
    evaluatorId: SUPERVISOR_ID,
    sheetId: 'C',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: previous },
    talkInvitations: [
      {
        id: 'c-002-talk-1',
        kind: 'OPENING',
        date: confirmed,
        time: '13:00',
        place: 'Pokój 210',
        note: '',
        createdOn: r.days(-3),
      },
    ],
    stage: 'PART_I_ACK',
    completedOn: { SHEET_SELECTION: r.days(-3), OPENING_TALK: confirmed },
    partI: {
      ...emptyPartI(),
      additionalCriteria: ['sytuacje_kryzysowe', 'myslenie_analityczne'],
      assessmentDue: defaultAssessmentDue(previous),
      topics: {
        duties:
          'Koordynacja obsługi incydentów w cyberprzestrzeni, raporty sytuacyjne, ćwiczenia z zarządzania kryzysowego.',
        criteria:
          'Pięć kryteriów obowiązkowych arkusza C oraz „Radzenie sobie w sytuacjach kryzysowych” i „Myślenie analityczne”.',
        expectations:
          'Raporty sytuacyjne w ciągu 2 godzin od zgłoszenia incydentu; wnioski z każdego ćwiczenia.',
        goals:
          'Przygotowanie procedury eskalacji incydentów do końca I kwartału.',
      },
      confirmedByEvaluatorOn: confirmed,
    },
    history: [
      {
        date: previous,
        text: 'Sporządzono poprzednią ocenę okresową: pozytywna, „Na poziomie oczekiwań”. Rozpoczął się nowy cykl oceny.',
      },
      {
        date: r.days(-3),
        text: 'Oceniający zatwierdził arkusz C (zgodnie z propozycją systemu) i 2 kryteria dodatkowe.',
      },
      {
        date: confirmed,
        text: 'Oceniający potwierdził przeprowadzenie rozmowy rozpoczynającej. Część I czeka na potwierdzenie ocenianego.',
      },
    ],
  });
}

/** Sheet B (team leader; the naczelnik OSP is the job description), observation period. */
function sheetBCase(r: Rel): CaseRecord {
  const id = 'c-003';
  const confirmed = r.months(-14);
  return caseRecord({
    id,
    person: {
      id: 'p-lewandowski',
      firstName: 'Michał',
      lastName: 'Lewandowski',
      position: 'Kierownik zespołu do spraw współpracy międzynarodowej',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2014-02-03',
      officeHead: false,
      managesPeople: true,
    },
    evaluatorId: SUPERVISOR_ID,
    sheetId: 'B',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-15, 10) },
    previousAssessment: previousAssessment(
      { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-15, 10) },
      'na poziomie oczekiwań',
    ),
    stage: 'OBSERVATION',
    completedOn: {
      SHEET_SELECTION: r.months(-14, -3),
      OPENING_TALK: confirmed,
      PART_I_ACK: confirmed,
    },
    partI: {
      ...emptyPartI(),
      additionalCriteria: ['wykorzystywanie_wiedzy', 'negocjowanie'],
      assessmentDue: defaultAssessmentDue(r.months(-15, 10)),
      topics: {
        duties:
          'Koordynacja zespołu (6 osób), przygotowanie wizyt zagranicznych kierownictwa, obsługa dotacji i zamówień na usługi podróży.',
        criteria:
          'Pięć kryteriów obowiązkowych arkusza B; dodatkowe: „Wykorzystywanie wiedzy i doskonalenie zawodowe” (wskazane w OSP) i „Negocjowanie” (uzgodnienia z partnerami zagranicznymi i wykonawcami).',
        expectations:
          'Regularne punkty kontrolne z zespołem, informacja zwrotna co kwartał, przygotowanie mandatu przed każdą rundą uzgodnień.',
        goals:
          'Wdrożenie wspólnego kalendarza wizyt i wydarzeń do końca 2025 r.',
      },
      expectations: {
        zarzadzanie_ludzmi:
          'Przydziela zadania z jasnym zakresem i terminem; co kwartał przekazuje członkom zespołu informację zwrotną.',
        podejmowanie_decyzji:
          'Podejmuje decyzje w sprawach organizacji wizyt w swoim zakresie, bez odkładania ich na ostatnią chwilę.',
        organizacja_pracy:
          'Planuje kalendarz wizyt z wyprzedzeniem i ustala zastępstwa w zespole.',
        wspolpraca:
          'Uzgadnia przygotowanie wizyt z departamentami merytorycznymi i protokołem.',
        komunikacja:
          'Przekazuje kierownictwu zwięzłe notatki przed wizytami i po nich.',
        wykorzystywanie_wiedzy:
          'Zna zasady rozliczania dotacji i zamówień na usługi podróży; aktualizuje wiedzę po zmianach przepisów.',
        negocjowanie:
          'Przed każdą rundą uzgodnień przygotowuje mandat i stanowisko minimalne.',
      },
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    observations: observations(id, [
      {
        date: r.months(-11, 6),
        criterionId: 'zarzadzanie_ludzmi',
        kind: 'STRENGTH',
        situation:
          'Po nieudanej organizacji spotkania dwustronnego członek zespołu pominął potwierdzenie tłumacza.',
        action:
          'Omówił z pracownikiem przebieg sprawy na konkretnych faktach i uzgodnił listę kontrolną przed wizytą.',
        result: 'Kolejne cztery wizyty odbyły się bez braków organizacyjnych.',
      },
      {
        date: r.months(-8, 1),
        criterionId: 'negocjowanie',
        kind: 'DEVELOPMENT',
        situation:
          'Uzgadnianie z wykonawcą zmian w umowie na usługi tłumaczeniowe.',
        action:
          'Przystąpił do rozmów bez ustalonego zakresu ustępstw i wariantu na wypadek braku porozumienia.',
        result:
          'Rozmowy przerwano i powtórzono po tygodniu, po przygotowaniu mandatu z naczelnikiem.',
      },
      {
        date: r.months(-4, 9),
        criterionId: 'podejmowanie_decyzji',
        kind: 'STRENGTH',
        situation:
          'Odwołany lot delegacji na dzień przed konferencją w Brukseli.',
        action:
          'W ciągu dwóch godzin porównał trzy warianty podróży i podjął decyzję w granicach budżetu.',
        result: 'Delegacja dotarła na czas, koszt mieścił się w planie.',
      },
      {
        date: r.days(-30),
        criterionId: 'komunikacja',
        kind: 'STRENGTH',
        situation:
          'Notatka dla kierownictwa przed wizytą partnerów z Europy Północnej.',
        action:
          'Wyodrębnił najważniejsze ustalenia, kwestie otwarte i podział odpowiedzialności.',
        result:
          'Notatkę przyjęto bez uzupełnień i wykorzystano jako wzór dla zespołu.',
      },
    ]),
    history: [
      {
        date: confirmed,
        text: 'Rozmowa rozpoczynająca. Zatwierdzono część I (2 kryteria dodatkowe); oceniany potwierdził zapoznanie.',
      },
    ],
  });
}

/** Hired for an indefinite period 2 weeks ago: the evaluator picks the sheet and criteria. */
function sheetSelectionCase(r: Rel): CaseRecord {
  const hiredOn = r.days(-14);
  return caseRecord({
    id: 'c-004',
    person: {
      id: EMPLOYEE_MAZUR,
      firstName: 'Julia',
      lastName: 'Mazur',
      position: 'Specjalista do spraw analiz danych',
      unit: TEAM_UNIT,
      employment: 'PRACOWNIK',
      hiredOn,
      officeHead: false,
      managesPeople: false,
    },
    evaluatorId: SUPERVISOR_ID,
    cycleStart: { kind: 'HIRED', date: hiredOn },
    stage: 'SHEET_SELECTION',
    history: [
      {
        date: hiredOn,
        text: 'Zatrudnienie na czas nieokreślony. Pierwsza ocena okresowa: rozmowa rozpoczynająca w 30 dni (§7 pkt 1).',
      },
    ],
  });
}

/** After a negative assessment: re-assessment in 6 months, opening talk within 7 days. */
function afterNegativeCase(r: Rel): CaseRecord {
  const assessedOn = r.days(-4);
  const acknowledgedOn = r.days(-3);
  return caseRecord({
    id: 'c-005',
    person: {
      id: 'p-szymanski',
      firstName: 'Paweł',
      lastName: 'Szymański',
      position: 'Starszy specjalista do spraw infrastruktury krytycznej',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2020-06-01',
      officeHead: false,
      managesPeople: false,
    },
    evaluatorId: SUPERVISOR_ID,
    sheetId: 'C',
    cycleStart: { kind: 'PREVIOUS_NEGATIVE', assessedOn, acknowledgedOn },
    stage: 'OPENING_TALK',
    completedOn: { SHEET_SELECTION: r.days(-2) },
    // Part I stays empty (no additional criteria either): the supervisor
    // fills it by hand at the opening talk.
    history: [
      {
        date: assessedOn,
        text: 'Sporządzono ocenę okresową: negatywna, „Poniżej oczekiwań” (rzetelność 1 pkt: dwa protokoły kontroli przekazane po terminie i z brakami).',
      },
      {
        date: acknowledgedOn,
        text: 'Oceniany zapoznał się z oceną negatywną. Ponowna ocena po upływie 6 miesięcy (art. 81 ust. 9 ustawy o służbie cywilnej); rozmowa rozpoczynająca w 7 dni od sporządzenia oceny (§7 pkt 2).',
      },
      {
        date: r.days(-2),
        text: 'Oceniający zatwierdził arkusz C i termin ponownej oceny.',
      },
    ],
  });
}

/** Assessment acknowledged 3 days ago: the 7-day objection term is running. */
function objectionPeriodCase(r: Rel): CaseRecord {
  const confirmed = r.months(-24, 6);
  const signed = r.days(-5);
  const acknowledged = r.days(-3);
  return caseRecord({
    id: 'c-006',
    person: {
      id: 'p-dabrowska',
      firstName: 'Ewa',
      lastName: 'Dąbrowska',
      position: 'Główny specjalista do spraw opiniowania aktów prawnych',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2012-09-03',
      officeHead: false,
      managesPeople: false,
    },
    evaluatorId: SUPERVISOR_ID,
    sheetId: 'C',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-24, -3) },
    previousAssessment: previousAssessment(
      { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-24, -3) },
      'powyżej oczekiwań',
    ),
    promotionRequest: { ...emptyPromotionRequest('URZEDNIK'), attached: 'NO' },
    stage: 'ACKNOWLEDGEMENT',
    completedOn: {
      SHEET_SELECTION: r.months(-24, 2),
      OPENING_TALK: confirmed,
      PART_I_ACK: confirmed,
      OBSERVATION: r.days(-9),
      ASSESSMENT: r.days(-7),
      SIGNATURE: signed,
      ACKNOWLEDGEMENT: acknowledged,
    },
    partI: {
      ...emptyPartI(),
      additionalCriteria: ['kreatywnosc'],
      assessmentDue: defaultAssessmentDue(r.months(-24, -3)),
      topics: {
        duties:
          'Omówiono zadania z OSP: opiniowanie projektów aktów prawnych pod kątem zgodności z prawem UE, przygotowanie uwag w uzgodnieniach międzyresortowych i udział w konferencjach uzgodnieniowych.',
        criteria:
          'Pięć kryteriów obowiązkowych arkusza C oraz kryterium dodatkowe „Kreatywność”: zadania obejmują proponowanie nowych rozwiązań w projektach przepisów.',
        expectations:
          'Uzgodniono oczekiwania dla każdego kryterium (niżej); szczególny nacisk na terminowość uwag w uzgodnieniach.',
        goals: '',
      },
      expectations: {
        wykorzystywanie_wiedzy:
          'Stosuje aktualne orzecznictwo i wytyczne w opiniach; dzieli się z wydziałem wnioskami ze szkoleń.',
        rzetelnosc:
          'Opinie i uwagi sprawdzone przed przekazaniem, w terminach wyznaczonych w uzgodnieniach.',
        organizacja_pracy:
          'Planuje pracę nad kilkoma projektami naraz; przy zbiegu terminów uzgadnia priorytety z naczelnikiem.',
        wspolpraca:
          'Uzgadnia stanowisko z departamentami merytorycznymi przed konferencją uzgodnieniową.',
        komunikacja:
          'Uwagi do projektów są zwięzłe, z podstawą prawną i propozycją brzmienia przepisu.',
        kreatywnosc:
          'Proponuje alternatywne brzmienie przepisów, gdy projekt budzi wątpliwości.',
      },
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    decisions: {
      wykorzystywanie_wiedzy: 7,
      rzetelnosc: 7,
      organizacja_pracy: 5,
      wspolpraca: 7,
      komunikacja: 5,
      kreatywnosc: 7,
    },
    justification:
      'Oceniana przez cały okres przygotowywała opinie do projektów aktów prawnych terminowo i bez błędów merytorycznych. Wyróżnia ją łączenie wiedzy z kilku dziedzin prawa i proponowanie nowych rozwiązań (m.in. lista kontrolna oceny skutków regulacji). Organizacja pracy i komunikacja na poziomie oczekiwań.',
    iprz: 'Szkolenie z prowadzenia spotkań konsultacyjnych (I półrocze); udział w zespole ds. wdrożenia aktu w sprawie AI jako ekspert; mentoring nowej osoby w wydziale.',
    assessmentTalkOn: r.days(-7),
    signedByEvaluatorOn: signed,
    sentForAckOn: signed,
    acknowledgedOn: acknowledged,
    history: [
      {
        date: confirmed,
        text: 'Rozmowa rozpoczynająca. Zatwierdzono część I (kryterium dodatkowe: Kreatywność).',
      },
      {
        date: signed,
        text: 'Oceniający zatwierdził ocenę na piśmie: pozytywna, „Powyżej oczekiwań” (średnia 6,33). Ocenę przekazano do zapoznania.',
      },
      {
        date: acknowledged,
        text: 'Oceniany zapoznał się z oceną. Biegnie 7-dniowy termin na sprzeciw (art. 83 ust. 1 ustawy o służbie cywilnej).',
      },
      {
        date: acknowledged,
        text: 'Nowy cykl oceny: rozmowa rozpoczynająca w 30 dni od sporządzenia oceny (§7 pkt 1). Sprzeciw nie wstrzymuje nowego cyklu.',
      },
    ],
  });
}

/** Cases of other units: visible only in the HR overview. */
function otherUnitCases(r: Rel): CaseRecord[] {
  const budget = EVALUATORS[1];
  const legal = EVALUATORS[2];
  const signed = r.days(-2);
  const overdueConfirmed = r.months(-24, -6);
  return [
    caseRecord({
      id: 'c-101',
      person: {
        id: 'p-wieczorek',
        firstName: 'Karolina',
        lastName: 'Wieczorek',
        position: 'Starszy referent do spraw rozliczeń dotacji',
        unit: budget.unit,
        employment: 'PRACOWNIK',
        hiredOn: '2021-01-04',
        officeHead: false,
        managesPeople: false,
      },
      evaluatorId: budget.id,
      sheetId: 'C',
      cycleStart: { kind: 'HIRED', date: '2024-11-20' },
      stage: 'ACKNOWLEDGEMENT',
      completedOn: {
        SHEET_SELECTION: '2024-11-20',
        OPENING_TALK: '2024-11-20',
        PART_I_ACK: '2024-11-20',
        OBSERVATION: r.days(-6),
        ASSESSMENT: r.days(-4),
        SIGNATURE: signed,
      },
      partI: {
        ...emptyPartI(),
        assessmentDue: defaultAssessmentDue('2024-11-20'),
        confirmedByEvaluatorOn: '2024-11-20',
        acknowledgedByEmployeeOn: '2024-11-20',
      },
      decisions: {
        wykorzystywanie_wiedzy: 5,
        rzetelnosc: 7,
        organizacja_pracy: 5,
        wspolpraca: 5,
        komunikacja: 5,
      },
      iprz: 'Szkolenie z kontroli rozliczeń dotacji; samodzielne prowadzenie rozliczeń w nowym systemie finansowym.',
      assessmentTalkOn: r.days(-4),
      signedByEvaluatorOn: signed,
      sentForAckOn: signed,
      history: [
        {
          date: signed,
          text: 'Ocenę zatwierdzono i przekazano do zapoznania.',
        },
      ],
    }),
    caseRecord({
      id: 'c-102',
      person: {
        id: 'p-krawczyk',
        firstName: 'Damian',
        lastName: 'Krawczyk',
        position: 'Specjalista do spraw planowania budżetu',
        unit: budget.unit,
        employment: 'URZEDNIK',
        hiredOn: '2018-05-02',
        officeHead: false,
        managesPeople: false,
      },
      evaluatorId: budget.id,
      sheetId: 'C',
      cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.days(-47) },
      stage: 'OPENING_TALK',
      completedOn: { SHEET_SELECTION: r.days(-40) },
      lastReminderOn: r.days(-7),
      history: [
        {
          date: r.days(-47),
          text: 'Sporządzono poprzednią ocenę okresową: pozytywna.',
        },
        {
          date: r.days(-7),
          text: 'Kadry wysłały przypomnienie o rozmowie rozpoczynającej.',
        },
      ],
    }),
    caseRecord({
      id: 'c-103',
      person: {
        id: 'p-gorska',
        firstName: 'Natalia',
        lastName: 'Górska',
        position: 'Radca do spraw legislacji',
        unit: legal.unit,
        employment: 'URZEDNIK',
        hiredOn: '2015-03-02',
        officeHead: false,
        managesPeople: false,
      },
      evaluatorId: legal.id,
      sheetId: 'C',
      cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-24, -10) },
      previousAssessment: previousAssessment(
        { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-25, -10) },
        'na poziomie oczekiwań',
      ),
      stage: 'OBSERVATION',
      completedOn: {
        SHEET_SELECTION: overdueConfirmed,
        OPENING_TALK: overdueConfirmed,
        PART_I_ACK: overdueConfirmed,
      },
      partI: {
        ...emptyPartI(),
        additionalCriteria: ['negocjowanie'],
        assessmentDue: defaultAssessmentDue(r.months(-24, -10)),
        confirmedByEvaluatorOn: overdueConfirmed,
        acknowledgedByEmployeeOn: overdueConfirmed,
      },
    }),
    caseRecord({
      id: 'c-104',
      person: {
        id: 'p-olszewski',
        firstName: 'Bartosz',
        lastName: 'Olszewski',
        position: 'Kierownik zespołu do spraw legislacji gospodarczej',
        unit: legal.unit,
        employment: 'URZEDNIK',
        hiredOn: '2016-09-01',
        officeHead: false,
        managesPeople: true,
      },
      evaluatorId: legal.id,
      cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.days(-12) },
      stage: 'SHEET_SELECTION',
    }),
    caseRecord({
      id: 'c-201',
      person: {
        id: 'p-baran',
        firstName: 'Elżbieta',
        lastName: 'Baran',
        position: 'Prezes urzędu centralnego',
        unit: 'Urząd centralny (dane demonstracyjne)',
        employment: 'URZEDNIK',
        hiredOn: '2019-02-01',
        officeHead: true,
        managesPeople: true,
      },
      evaluatorId: 'ev-zawadzki',
      sheetId: 'A',
      cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-10) },
      stage: 'OBSERVATION',
      completedOn: {
        SHEET_SELECTION: r.months(-10, 5),
        OPENING_TALK: r.months(-10, 12),
        PART_I_ACK: r.months(-10, 13),
      },
      partI: {
        ...emptyPartI(),
        additionalCriteria: ['wystapienia_publiczne'],
        assessmentDue: defaultAssessmentDue(r.months(-10)),
        confirmedByEvaluatorOn: r.months(-10, 12),
        acknowledgedByEmployeeOn: r.months(-10, 13),
      },
    }),
  ];
}

/** Negative assessment: the talk was held, the evaluator is about to sign. */
function negativeSignatureCase(r: Rel): CaseRecord {
  const confirmed = r.months(-24, 3);
  const talk = r.days(-1);
  return caseRecord({
    id: 'c-007',
    person: {
      id: 'p-zielinska',
      firstName: 'Monika',
      lastName: 'Zielińska',
      position: 'Specjalista do spraw obsługi sekretariatu',
      unit: TEAM_UNIT,
      employment: 'PRACOWNIK',
      hiredOn: '2020-02-03',
      officeHead: false,
      managesPeople: false,
    },
    evaluatorId: SUPERVISOR_ID,
    sheetId: 'C',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-24, 2) },
    stage: 'SIGNATURE',
    completedOn: {
      SHEET_SELECTION: confirmed,
      OPENING_TALK: confirmed,
      PART_I_ACK: confirmed,
      OBSERVATION: r.days(-6),
      ASSESSMENT: talk,
    },
    partI: {
      ...emptyPartI(),
      additionalCriteria: ['orientacja_na_klienta'],
      assessmentDue: defaultAssessmentDue(r.months(-24, 2)),
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    decisions: {
      wykorzystywanie_wiedzy: 3,
      rzetelnosc: 1,
      organizacja_pracy: 3,
      wspolpraca: 5,
      komunikacja: 3,
      orientacja_na_klienta: 5,
    },
    justification:
      'Rzetelność 1 pkt: w okresie oceny trzykrotnie nie przekazano pism w terminie ustawowym, mimo uzgodnionego planu naprawczego. Organizacja pracy i komunikacja poniżej oczekiwań: brak sygnalizowania zaległości.',
    iprz: 'Szkolenie z instrukcji kancelaryjnej i EZD; cotygodniowy przegląd zaległości z przełożonym przez 3 miesiące.',
    assessmentTalkOn: talk,
    history: [
      {
        date: talk,
        text: 'Przeprowadzono rozmowę oceniającą. Wynik wstępny: ocena negatywna.',
      },
    ],
  });
}

/** Sheet B, team leader in the assessment stage with a draft. */
function teamLeaderDraftCase(r: Rel): CaseRecord {
  const confirmed = r.months(-23, 20);
  return caseRecord({
    id: 'c-008',
    person: {
      id: 'p-kowalczyk',
      firstName: 'Tomasz',
      lastName: 'Kowalczyk',
      position: 'Kierownik zespołu do spraw usług cyfrowych',
      unit: TEAM_UNIT,
      employment: 'URZEDNIK',
      hiredOn: '2013-05-06',
      officeHead: false,
      managesPeople: true,
    },
    evaluatorId: SUPERVISOR_ID,
    sheetId: 'B',
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: r.months(-23, 10) },
    stage: 'ASSESSMENT',
    completedOn: {
      SHEET_SELECTION: confirmed,
      OPENING_TALK: confirmed,
      PART_I_ACK: confirmed,
      OBSERVATION: r.days(-3),
    },
    partI: {
      ...emptyPartI(),
      additionalCriteria: ['kreatywnosc', 'orientacja_na_klienta'],
      assessmentDue: defaultAssessmentDue(r.months(-23, 10)),
      confirmedByEvaluatorOn: confirmed,
      acknowledgedByEmployeeOn: confirmed,
    },
    decisions: {
      zarzadzanie_ludzmi: 7,
      podejmowanie_decyzji: 7,
      organizacja_pracy: 9,
    },
  });
}
