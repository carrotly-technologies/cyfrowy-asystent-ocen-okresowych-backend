import type { SheetId } from '../sheets/sheet.types.js';
import { USC } from './deadlines.rules.js';

/**
 * To whom the assessed person files the sprzeciw (and who decides it):
 * - art. 83 ust. 1 ustawy: to the dyrektor generalny urzędu (sheets B, C);
 * - art. 83 ust. 2: persons of art. 81 ust. 2 pkt 1, 2 and 4 (dyrektor
 *   generalny, kierujący departamentem assessed by the DG, wojewódzki lekarz
 *   weterynarii) file it to the person who made the assessment. Sheet A
 *   (załącznik nr 2) leaves the addressee blank ("sprzeciw do: …");
 * - footnote 17 of sheets B and C: in an office without a dyrektor generalny
 *   the objection goes to the kierownik urzędu.
 */

/** Who decides the objection in the application. */
export type ObjectionDecider = 'EVALUATOR' | 'DIRECTOR';

export interface ObjectionAddressee {
  /** EVALUATOR: the case's evaluator; DIRECTOR: the DIRECTOR role (DG or kierownik urzędu). */
  decider: ObjectionDecider;
  /** Genitive, after "sprzeciw do …". */
  to: string;
  /** Nominative, at the start of a sentence ("… nie uwzględnił sprzeciwu"). */
  who: string;
  legalBasis: string;
}

/** What the rule needs from the case. */
export interface ObjectionAddresseeFacts {
  sheetId: SheetId | null;
  /** The assessment was made by the dyrektor generalny (art. 81 ust. 2 pkt 2). */
  assessedByDirectorGeneral?: boolean;
}

/** What the rule needs from the office (env, src/config/office.ts). */
export interface ObjectionAddresseeOffice {
  /** Sheet A: the configured addressee in the genitive (OBJECTION_RECIPIENT_A). */
  objectionRecipient?: string | null;
  /** false: the office has no dyrektor generalny (OFFICE_HAS_DIRECTOR_GENERAL). */
  hasDirectorGeneral?: boolean;
}

export const DIRECTOR_GENERAL_TO = 'dyrektora generalnego urzędu';
export const ASSESSOR_TO = 'osoby, która dokonała oceny okresowej';

export function objectionAddressee(
  facts: ObjectionAddresseeFacts,
  office: ObjectionAddresseeOffice = {},
): ObjectionAddressee {
  if (facts.sheetId === 'A') {
    return {
      decider: 'EVALUATOR',
      to: office.objectionRecipient ?? ASSESSOR_TO,
      who: 'Oceniający (osoba, która dokonała oceny okresowej)',
      legalBasis: `art. 83 ust. 2 ${USC} (arkusz A, załącznik nr 2)`,
    };
  }
  if (facts.assessedByDirectorGeneral) {
    return {
      decider: 'DIRECTOR',
      to: `${DIRECTOR_GENERAL_TO}, który dokonał oceny`,
      who: 'Dyrektor generalny urzędu',
      legalBasis: `art. 83 ust. 2 ${USC}`,
    };
  }
  if (office.hasDirectorGeneral === false) {
    return {
      decider: 'DIRECTOR',
      to: 'kierownika urzędu',
      who: 'Kierownik urzędu',
      legalBasis: `art. 83 ust. 1 ${USC}; przypis 17 arkuszy B i C (urząd bez dyrektora generalnego)`,
    };
  }
  return {
    decider: 'DIRECTOR',
    to: DIRECTOR_GENERAL_TO,
    who: 'Dyrektor generalny urzędu',
    legalBasis: `art. 83 ust. 1 ${USC}`,
  };
}
