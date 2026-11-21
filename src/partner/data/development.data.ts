/**
 * Forms of development per assessment criterion (ids of
 * src/criteria/data/criteria.data.ts), suggested for criteria with a low
 * partial score or with development observations. Forms follow the Poradnik
 * KPRM "Oceny okresowe w służbie cywilnej" (rozdz. 6.2.5.4 wnioski do IPRZ:
 * szkolenia, warsztaty, coaching z bezpośrednim przełożonym, doskonalenie w
 * działaniu, samokształcenie) and the "Standardy ZZL w SC" (szkolenie,
 * samodoskonalenie, wymiana doświadczeń, wizyty studyjne). Example catalogue:
 * each office replaces it with its own training offer.
 */

export interface DevelopmentForm {
  /** E.g. "szkolenie", "warsztaty", "coaching", "doskonalenie w działaniu". */
  form: string;
  text: string;
}

export interface CriterionDevelopment {
  /** One line on how to use this in everyday team management. */
  dailyManagement: string;
  forms: DevelopmentForm[];
}

export const DEVELOPMENT_CATALOGUE: Record<string, CriterionDevelopment> = {
  komunikacja: {
    dailyManagement:
      'Przed wysłaniem ważnego pisma proś o krótkie streszczenie „w trzech zdaniach”; dawaj informację zwrotną od razu po spotkaniu.',
    forms: [
      { form: 'szkolenie', text: 'Prosty język w urzędzie / redagowanie pism' },
      {
        form: 'warsztaty',
        text: 'Komunikacja z interesantem i trudne rozmowy',
      },
      {
        form: 'doskonalenie w działaniu',
        text: 'Przygotowanie i poprowadzenie krótkiej prezentacji dla zespołu',
      },
    ],
  },
  kreatywnosc: {
    dailyManagement:
      'Zostaw przestrzeń na propozycje usprawnień na spotkaniach zespołu i wracaj do nich z decyzją.',
    forms: [
      { form: 'warsztaty', text: 'Metody kreatywnego rozwiązywania problemów' },
      {
        form: 'wymiana doświadczeń',
        text: 'Wizyta studyjna w innym urzędzie (dobre praktyki)',
      },
    ],
  },
  negocjowanie: {
    dailyManagement:
      'Przed uzgodnieniami omów z pracownikiem cele i pole manewru; po spotkaniu podsumujcie, co zadziałało.',
    forms: [
      { form: 'szkolenie', text: 'Negocjacje w administracji publicznej' },
      {
        form: 'coaching',
        text: 'Coaching z bezpośrednim przełożonym przed trudnymi uzgodnieniami',
      },
    ],
  },
  organizacja_pracy: {
    dailyManagement:
      'Ustalajcie terminy cząstkowe dla dużych spraw i krótki przegląd priorytetów raz w tygodniu.',
    forms: [
      {
        form: 'szkolenie',
        text: 'Zarządzanie sobą w czasie i planowanie pracy',
      },
      {
        form: 'coaching',
        text: 'Coaching z bezpośrednim przełożonym: sygnalizowanie kolizji terminów',
      },
      {
        form: 'doskonalenie w działaniu',
        text: 'Prowadzenie harmonogramu spraw wydziału przez kwartał',
      },
    ],
  },
  orientacja_na_klienta: {
    dailyManagement:
      'Omawiaj z pracownikiem przykłady pism i rozmów z interesantami; doceniaj sprawy załatwione „za pierwszym razem”.',
    forms: [
      {
        form: 'szkolenie',
        text: 'Obsługa interesanta i standardy obsługi klienta',
      },
      {
        form: 'warsztaty',
        text: 'Projektowanie usług z perspektywy użytkownika',
      },
    ],
  },
  podejmowanie_decyzji: {
    dailyManagement:
      'Stopniowo powierzaj decyzje w mniejszych sprawach i omawiaj ich uzasadnienie.',
    forms: [
      { form: 'szkolenie', text: 'Podejmowanie decyzji i analiza ryzyka' },
      { form: 'mentoring', text: 'Mentoring doświadczonej osoby decyzyjnej' },
    ],
  },
  sytuacje_kryzysowe: {
    dailyManagement:
      'Ustal jasne zasady eskalacji i zastępstw; po trudnej sytuacji zrób krótkie omówienie bez szukania winnych.',
    forms: [
      {
        form: 'szkolenie',
        text: 'Radzenie sobie ze stresem i zarządzanie kryzysowe',
      },
      {
        form: 'doskonalenie w działaniu',
        text: 'Udział w ćwiczeniach zarządzania kryzysowego',
      },
    ],
  },
  rzetelnosc: {
    dailyManagement:
      'Wprowadź listę kontrolną przed przekazaniem dokumentu i zasadę „drugiej pary oczu” w ważnych sprawach.',
    forms: [
      {
        form: 'doskonalenie w działaniu',
        text: 'Lista kontrolna jakości dokumentów',
      },
      {
        form: 'coaching',
        text: 'Coaching z bezpośrednim przełożonym: samokontrola przed wysłaniem',
      },
    ],
  },
  myslenie_analityczne: {
    dailyManagement:
      'Proś o wnioski z podstawą i ograniczeniami danych; doceniaj rozróżnienie ustaleń od przypuszczeń.',
    forms: [
      {
        form: 'szkolenie',
        text: 'Analiza danych i wnioskowanie (np. arkusz kalkulacyjny, analiza regulacji)',
      },
      {
        form: 'samokształcenie',
        text: 'Lektura literatury fachowej i orzecznictwa',
      },
    ],
  },
  wykorzystywanie_wiedzy: {
    dailyManagement:
      'Zachęcaj do dzielenia się wiedzą (krótkie notatki ze szkoleń dla zespołu).',
    forms: [
      {
        form: 'szkolenie',
        text: 'Szkolenie specjalistyczne z obszaru zadań stanowiska',
      },
      {
        form: 'samokształcenie',
        text: 'Konferencje, prasa branżowa, e-learning',
      },
      {
        form: 'wymiana doświadczeń',
        text: 'Prezentacja wniosków ze szkolenia na spotkaniu wydziału',
      },
    ],
  },
  wspolpraca: {
    dailyManagement:
      'Planuj zadania wymagające współpracy w parach i jasno określaj role.',
    forms: [
      { form: 'warsztaty', text: 'Praca zespołowa i rozwiązywanie konfliktów' },
      {
        form: 'coaching',
        text: 'Coaching z bezpośrednim przełożonym, doskonalenie w działaniu',
      },
    ],
  },
  wystapienia_publiczne: {
    dailyManagement:
      'Dawaj okazje do krótkich wystąpień na forum wewnętrznym, z informacją zwrotną po każdym.',
    forms: [
      { form: 'szkolenie', text: 'Wystąpienia publiczne i autoprezentacja' },
      {
        form: 'doskonalenie w działaniu',
        text: 'Prezentacja na spotkaniu departamentu',
      },
    ],
  },
  zarzadzanie_ludzmi: {
    dailyManagement:
      'Regularne rozmowy 1:1 z członkami zespołu i bieżąca informacja zwrotna.',
    forms: [
      {
        form: 'szkolenie',
        text: 'Zarządzanie zespołem, motywowanie i delegowanie',
      },
      { form: 'coaching', text: 'Coaching z bezpośrednim przełożonym' },
      { form: 'mentoring', text: 'Mentoring doświadczonego kierownika' },
    ],
  },
  zarzadzanie_strategiczne: {
    dailyManagement:
      'Włączaj w planowanie celów rocznych i omawiaj powiązanie zadań z celami urzędu.',
    forms: [
      {
        form: 'szkolenie',
        text: 'Zarządzanie strategiczne i planowanie w administracji',
      },
      {
        form: 'development center',
        text: 'Development center dla kadry kierowniczej',
      },
    ],
  },
};

/** Partial score below this is "poniżej oczekiwań" (skala 1–9: 5 = na poziomie oczekiwań, § 11 rozp. 2016). */
export const EXPECTED_LEVEL_POINTS = 5;
