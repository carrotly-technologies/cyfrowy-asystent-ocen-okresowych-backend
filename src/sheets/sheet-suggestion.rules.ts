import type { SheetId } from './sheet.types.js';

const RO_2016 = 'rozp. PRM z 4.04.2016 (Dz.U. poz. 470)';

/** What the rule needs to know about the assessed person's position. */
export interface PositionFacts {
  /** The position is "kierownik urzędu" (head of the office). */
  officeHead: boolean;
  /** The work consists in directly managing employees. */
  managesPeople: boolean;
}

export interface SheetSuggestion {
  sheetId: SheetId;
  reason: string;
  legalBasis: string;
  /** Always true: the evaluator confirms or changes the sheet. */
  isSuggestionOnly: true;
}

/**
 * Sheet for the position (§3 ust. 2–4 rozp. 2016): A for the head of the
 * office, B for a position that consists in directly managing employees,
 * C for every other position. Only a suggestion; the evaluator confirms it.
 */
export function suggestSheet(facts: PositionFacts): SheetSuggestion {
  if (facts.officeHead) {
    return {
      sheetId: 'A',
      reason: 'Oceniany zajmuje stanowisko kierownika urzędu.',
      legalBasis: `§3 ust. 2 ${RO_2016}`,
      isSuggestionOnly: true,
    };
  }
  if (facts.managesPeople) {
    return {
      sheetId: 'B',
      reason:
        'Praca ocenianego polega na bezpośrednim kierowaniu pracownikami (stanowisko inne niż kierownik urzędu).',
      legalBasis: `§3 ust. 3 ${RO_2016}`,
      isSuggestionOnly: true,
    };
  }
  return {
    sheetId: 'C',
    reason:
      'Oceniany nie kieruje bezpośrednio pracownikami i nie jest kierownikiem urzędu.',
    legalBasis: `§3 ust. 4 ${RO_2016}`,
    isSuggestionOnly: true,
  };
}
