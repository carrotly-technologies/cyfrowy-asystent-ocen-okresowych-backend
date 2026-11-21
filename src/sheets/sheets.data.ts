import { SHEET_MAPPING } from '../competency-model/data/model.data.js';
import type { Sheet } from './sheet.types.js';

const RO_2016 = 'rozp. PRM z 4.04.2016 (Dz.U. poz. 470)';
const RP_2015 = 'rozp. PRM z 23.07.2015 (Dz.U. poz. 1144)';
const PERIODIC_SCALE = [1, 3, 5, 7, 9];

/**
 * Sheet definitions. Mandatory criteria come from `mapowanie_arkuszy` of the
 * competency model; names and `appliesTo` follow §3 rozp. 2016 and rozp. 2015.
 */
export const SHEETS: readonly Sheet[] = [
  {
    id: 'A',
    name: 'Arkusz A oceny okresowej',
    appliesTo: 'Kierownik urzędu (§3 ust. 2 rozp. 2016)',
    kind: 'PERIODIC',
    scale: PERIODIC_SCALE,
    mandatoryCriteria: SHEET_MAPPING.A.mandatoryCriteria,
    maxAdditionalCriteria: 3,
    legalBasis: `§3 ust. 2, §4 ust. 1, §11 ${RO_2016}`,
  },
  {
    id: 'B',
    name: 'Arkusz B oceny okresowej',
    appliesTo:
      'Osoba na stanowisku polegającym na bezpośrednim kierowaniu pracownikami, innym niż kierownik urzędu (§3 ust. 3 rozp. 2016)',
    kind: 'PERIODIC',
    scale: PERIODIC_SCALE,
    mandatoryCriteria: SHEET_MAPPING.B.mandatoryCriteria,
    maxAdditionalCriteria: 3,
    legalBasis: `§3 ust. 3, §4 ust. 2, §11 ${RO_2016}`,
  },
  {
    id: 'C',
    name: 'Arkusz C oceny okresowej',
    appliesTo:
      'Osoba na pozostałych stanowiskach, bez bezpośredniego kierowania pracownikami (§3 ust. 4 rozp. 2016)',
    kind: 'PERIODIC',
    scale: PERIODIC_SCALE,
    mandatoryCriteria: SHEET_MAPPING.C.mandatoryCriteria,
    maxAdditionalCriteria: 3,
    legalBasis: `§3 ust. 4, §4 ust. 3, §11 ${RO_2016}`,
  },
  {
    id: 'FIRST',
    name: 'Arkusz pierwszej oceny',
    appliesTo:
      'Osoba podejmująca po raz pierwszy pracę w służbie cywilnej, zatrudniona na czas określony 12 miesięcy (art. 35 ust. 3 ustawy o służbie cywilnej)',
    kind: 'FIRST',
    scale: SHEET_MAPPING.first.scale,
    mandatoryCriteria: SHEET_MAPPING.first.elements,
    maxAdditionalCriteria: 0,
    legalBasis: `§2 pkt 1, §9 ust. 1, §10 ${RP_2015}`,
  },
];
