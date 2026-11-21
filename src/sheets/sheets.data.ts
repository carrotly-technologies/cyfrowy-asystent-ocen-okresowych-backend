import type { Sheet, SheetTemplate } from './sheet.types.js';

const RO_2016 = 'rozp. PRM z 4.04.2016 (Dz.U. poz. 470)';
// §11 ust. 1 pkt 1 rozp. PRM z 4.04.2016
const PERIODIC_SCALE = [1, 3, 5, 7, 9];
// §5 ust. 2 rozp. PRM z 4.04.2016
const MAX_ADDITIONAL = 3;

const USC_2008 = 'ustawy z dnia 21 listopada 2008 r. o służbie cywilnej';

/** Wording shared by sheets A, B and C (załączniki nr 2–4, rozp. 2016). */
const PERIODIC_TEXTS = {
  title:
    'OCENA OKRESOWA URZĘDNIKA SŁUŻBY CYWILNEJ LUB PRACOWNIKA SŁUŻBY CYWILNEJ',
  partIConfirmation: [
    'przeprowadzenie rozmowy, o której mowa w § 5 ust. 1 rozporządzenia Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej (Dz. U. poz. 470), i omówienie w trakcie tej rozmowy wszystkich wymaganych zagadnień,',
    'zapoznanie ocenianego z kryteriami oceny oraz terminem sporządzenia oceny.',
  ],
  employeeAcknowledgement:
    'Przeprowadzono ze mną rozmowę oceniającą oraz zapoznałem(-łam) się z oceną okresową i wnioskami dotyczącymi indywidualnego programu rozwoju zawodowego.',
  partIIIApplicability: `Wniosek jest wypełniany i dołączany do arkusza oceny okresowej ocenianego tylko w sytuacji skorzystania przez oceniającego z możliwości przewidzianej w art. 89 ust. 1 ${USC_2008}.`,
  partIIINotAttached:
    'Części III nie drukuje się i nie dołącza do arkusza oceny okresowej w przypadku ocenianego będącego pracownikiem służby cywilnej oraz w razie nieskładania wniosku o przyznanie urzędnikowi służby cywilnej kolejnego stopnia służbowego.',
  promotionRequest: {
    beforeName: 'W związku z uzyskaniem przez Panią/Pana',
    afterName: `pozytywnej oceny okresowej, na podstawie art. 89 ust. 1 ${USC_2008} wnioskuję o przyznanie`,
    afterGrade: 'stopnia służbowego.',
  },
} satisfies Partial<SheetTemplate>;

/**
 * Pouczenie of sheets B and C with its footnote 17 (załączniki nr 3 i 4);
 * the 7-day term itself is computed in deadlines.rules.ts (art. 83 ust. 1).
 */
const OBJECTION_TO_DIRECTOR = {
  objectionNotice: `Zgodnie z art. 83 ust. 1 ${USC_2008} od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do dyrektora generalnego urzędu.`,
  objectionNoticeNote:
    'W urzędzie, w którym przepisy nie przewidują tworzenia stanowiska dyrektora generalnego urzędu, sprzeciw składa się do kierownika tego urzędu.',
};

/**
 * Sheet definitions (§3–§4 rozp. PRM z 4.04.2016). Criterion ids refer to
 * src/criteria/data/criteria.data.ts.
 */
export const SHEETS: readonly Sheet[] = [
  {
    id: 'A',
    name: 'Arkusz A oceny okresowej',
    appliesTo: 'Kierownik urzędu (§3 ust. 2 rozp. 2016)',
    scale: PERIODIC_SCALE,
    // §4 ust. 1
    mandatoryCriteria: [
      'zarzadzanie_ludzmi',
      'podejmowanie_decyzji',
      'organizacja_pracy',
      'wspolpraca',
      'komunikacja',
      'zarzadzanie_strategiczne',
    ],
    maxAdditionalCriteria: MAX_ADDITIONAL,
    legalBasis: `§3 ust. 2, §4 ust. 1, §11 ${RO_2016}`,
    // Załącznik nr 2: the notice leaves the addressee blank ("sprzeciw do: …").
    template: {
      annex: 'Załącznik nr 2',
      ...PERIODIC_TEXTS,
      objectionNotice: `Na podstawie art. 83 ust. 1 ${USC_2008} od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do:`,
      objectionNoticeNote: null,
    },
  },
  {
    id: 'B',
    name: 'Arkusz B oceny okresowej',
    appliesTo:
      'Osoba na stanowisku polegającym na bezpośrednim kierowaniu pracownikami, innym niż kierownik urzędu (§3 ust. 3 rozp. 2016)',
    scale: PERIODIC_SCALE,
    // §4 ust. 2
    mandatoryCriteria: [
      'zarzadzanie_ludzmi',
      'podejmowanie_decyzji',
      'organizacja_pracy',
      'wspolpraca',
      'komunikacja',
    ],
    maxAdditionalCriteria: MAX_ADDITIONAL,
    legalBasis: `§3 ust. 3, §4 ust. 2, §11 ${RO_2016}`,
    template: {
      annex: 'Załącznik nr 3',
      ...PERIODIC_TEXTS,
      ...OBJECTION_TO_DIRECTOR,
    },
  },
  {
    id: 'C',
    name: 'Arkusz C oceny okresowej',
    appliesTo:
      'Osoba na pozostałych stanowiskach, bez bezpośredniego kierowania pracownikami (§3 ust. 4 rozp. 2016)',
    scale: PERIODIC_SCALE,
    // §4 ust. 3
    mandatoryCriteria: [
      'wykorzystywanie_wiedzy',
      'rzetelnosc',
      'organizacja_pracy',
      'wspolpraca',
      'komunikacja',
    ],
    maxAdditionalCriteria: MAX_ADDITIONAL,
    legalBasis: `§3 ust. 4, §4 ust. 3, §11 ${RO_2016}`,
    template: {
      annex: 'Załącznik nr 4',
      ...PERIODIC_TEXTS,
      ...OBJECTION_TO_DIRECTOR,
    },
  },
];
