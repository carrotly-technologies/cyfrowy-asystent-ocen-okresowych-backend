import type { CriteriaCatalogue } from '../criteria.types.js';

/**
 * "Wykaz kryteriów oceny": załącznik nr 1 do rozp. PRM z 4.04.2016 w sprawie
 * warunków i sposobu przeprowadzania ocen okresowych (Dz.U. 2016 poz. 470).
 * Texts are verbatim from the annex. When the law changes, edit this file
 * only (ids are stable keys stored in cases; keep them when renaming).
 *
 * The scale labels follow §11 ust. 1 pkt 1 of the same regulation.
 */
export const CRITERIA_CATALOGUE: CriteriaCatalogue = {
  title: 'Wykaz kryteriów oceny',
  legalBasis: 'załącznik nr 1 do rozp. PRM z 4.04.2016 (Dz.U. poz. 470)',
  // §11 ust. 1 pkt 1 rozp. PRM z 4.04.2016
  scale: [
    { points: 1, label: 'Znacznie poniżej oczekiwań' },
    { points: 3, label: 'Poniżej oczekiwań' },
    { points: 5, label: 'Na poziomie oczekiwań' },
    { points: 7, label: 'Powyżej oczekiwań' },
    { points: 9, label: 'Znacznie powyżej oczekiwań' },
  ],
  criteria: [
    {
      id: 'komunikacja',
      number: 1,
      name: 'Komunikacja',
      description: [
        'Koncentrowanie się na wypowiedzi rozmówcy i dbanie o wzajemne zrozumienie.',
        'Wypowiadanie się w sposób jasny i precyzyjny, dostosowany do sytuacji i rozmówcy (dobieranie stylu, języka i treści).',
        'Formułowanie jasnych i precyzyjnych wypowiedzi pisemnych dostosowanych do sytuacji i odbiorcy (dobieranie stylu, języka i treści).',
        'Przedstawianie przekonujących argumentów odpowiednio do sytuacji.',
      ],
    },
    {
      id: 'kreatywnosc',
      number: 2,
      name: 'Kreatywność',
      description: [
        'Proponowanie lub tworzenie nowych rozwiązań.',
        'Nieschematyczne podejście do zadań.',
      ],
    },
    {
      id: 'negocjowanie',
      number: 3,
      name: 'Negocjowanie',
      description: [
        'Przygotowywanie się do negocjacji, w szczególności opracowanie projektu stanowiska, zakresu możliwych ustępstw i argumentacji.',
        'Stosowanie technik i strategii negocjacyjnych.',
        'Osiągnięcie efektu negocjacji akceptowanego przez przełożonych.',
      ],
    },
    {
      id: 'organizacja_pracy',
      number: 4,
      name: 'Organizacja pracy i orientacja na osiąganie celów',
      description: [
        'Określanie sposobu realizacji zadań/celów.',
        'Realizowanie zadań/celów w kolejności uwzględniającej ich wagę i pilność (ustalanie priorytetów działania).',
        'Dobieranie niezbędnych zasobów umożliwiających realizację zadań/celów.',
        'Dostosowywanie się do zmieniających się okoliczności.',
        'Wytrwałość i zaangażowanie w realizację zadań/celów.',
      ],
    },
    {
      id: 'orientacja_na_klienta',
      number: 5,
      name: 'Orientacja na klienta/interesanta',
      description: [
        'Taktowne zachowanie, wyrażające szacunek i zrozumienie dla drugiej osoby.',
        'Reagowanie na potrzeby klienta/interesanta, w szczególności rozpoznawanie jego potrzeb i proponowanie rozwiązań.',
      ],
    },
    {
      id: 'podejmowanie_decyzji',
      number: 6,
      name: 'Podejmowanie decyzji i odpowiedzialność',
      description: [
        'Wypracowywanie alternatywnych rozwiązań na podstawie analizy informacji, w szczególności potencjalnego ryzyka.',
        'Podejmowanie decyzji (decyzyjność).',
        'Przyjmowanie odpowiedzialności za efekty podjętych decyzji.',
      ],
    },
    {
      id: 'sytuacje_kryzysowe',
      number: 7,
      name: 'Radzenie sobie w sytuacjach kryzysowych',
      description: [
        'Rozpoznawanie sytuacji kryzysowych i informowanie o nich zainteresowanych.',
        'Podejmowanie działań mających na celu rozwiązanie kryzysu.',
        'Wyciąganie wniosków z sytuacji kryzysowych.',
      ],
    },
    {
      id: 'rzetelnosc',
      number: 8,
      name: 'Rzetelność',
      description: [
        'Wykonywanie zadań zgodnie z obowiązującymi standardami (przepisami, zasadami, procedurami) oraz dbałość o jakość rezultatów.',
        'Dotrzymywanie zobowiązań (realizacja zadań) w wyznaczonym czasie.',
      ],
    },
    {
      id: 'myslenie_analityczne',
      number: 9,
      name: 'Myślenie analityczne',
      description: [
        'Rozróżnianie informacji istotnych i nieistotnych.',
        'Dostrzeganie zależności między informacjami.',
        'Formułowanie wniosków.',
      ],
    },
    {
      id: 'wykorzystywanie_wiedzy',
      number: 10,
      name: 'Wykorzystywanie wiedzy i doskonalenie zawodowe',
      description: [
        'Wykorzystywanie wiedzy przy realizacji zadań na zajmowanym stanowisku pracy.',
        'Doskonalenie wiedzy i umiejętności niezbędnych do wykonywania zadań na zajmowanym stanowisku pracy, w szczególności wyszukiwanie i pozyskiwanie wiedzy, korzystanie z dobrych praktyk i doświadczeń innych.',
        'Korzystanie z dostępnych źródeł informacji, rozwiązań i technologii.',
      ],
    },
    {
      id: 'wspolpraca',
      number: 11,
      name: 'Współpraca',
      description: [
        'Włączanie się w działania realizowane razem z innymi osobami, jeśli istnieje taka możliwość.',
        'Dbanie o przepływ informacji.',
        'Dbanie o dobrą atmosferę i otwartość we współpracy.',
        'Dostrzeganie wkładu pracy innych osób.',
        'Branie pod uwagę zdania innych osób.',
        'Dzielenie się wiedzą i doświadczeniem.',
      ],
    },
    {
      id: 'wystapienia_publiczne',
      number: 12,
      name: 'Wystąpienia publiczne',
      description: [
        'Wykorzystywanie różnych środków przekazu (np. narzędzi multimedialnych) i dbałość o sposób prezentacji (w tym autoprezentacji).',
        'Nawiązywanie i utrzymywanie kontaktu z audytorium.',
        'Zarządzanie czasem wystąpienia, w szczególności przestrzeganie ram czasowych, elastyczne reagowanie na potrzeby audytorium.',
        'Radzenie sobie ze stresem i emocjami, w szczególności wywołanymi krytyką i trudnymi pytaniami.',
      ],
    },
    {
      id: 'zarzadzanie_ludzmi',
      number: 13,
      name: 'Zarządzanie ludźmi',
      description: [
        'Przydzielanie zakresu odpowiedzialności, zadań i uprawnień pracownikom (delegowanie zadań).',
        'Monitorowanie realizacji zadań oraz w razie potrzeby podejmowanie działań korygujących lub zapobiegawczych.',
        'Motywowanie pracowników.',
        'Udzielanie pracownikom informacji zwrotnej opartej na ocenie ich zaangażowania i sposobu realizacji zadań.',
        'Rozwiązywanie konfliktów.',
        'Wspieranie pracowników w rozwoju zawodowym, w szczególności identyfikowanie potrzeb rozwojowych, proponowanie działań rozwojowych oraz monitorowanie ich realizacji.',
      ],
    },
    {
      id: 'zarzadzanie_strategiczne',
      number: 14,
      name: 'Zarządzanie strategiczne',
      description: [
        'Tworzenie wizji oraz wyznaczanie celów strategicznych w oparciu o całościowe i perspektywiczne widzenie organizacji, otoczenia oraz strategie rozwoju.',
        'Formułowanie celów operacyjnych na podstawie celów strategicznych.',
        'Analiza ryzyka planowanych działań o charakterze strategicznym.',
      ],
    },
  ],
};

export function findCriterion(id: string) {
  return CRITERIA_CATALOGUE.criteria.find((c) => c.id === id);
}

/** "Rzetelność"; undefined when the id is not in the catalogue. */
export function knownCriterionName(id: string): string | undefined {
  return findCriterion(id)?.name;
}

/** "Rzetelność"; the id itself when unknown. */
export function criterionName(id: string): string {
  return knownCriterionName(id) ?? id;
}
