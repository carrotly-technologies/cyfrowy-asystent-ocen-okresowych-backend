import { displayName, RO_2016 } from '../assessments/assessment.format.js';
import type { OspAnalysis } from '../cases/case.types.js';
import { COMPETENCY_MODEL } from '../competency-model/data/model.data.js';
import { SHEETS } from '../sheets/sheets.data.js';
import type { OspSource } from './osp.data.js';

const name = (id: string) => {
  const competency = COMPETENCY_MODEL.competencies.find((c) => c.id === id);
  return competency ? displayName(competency.name) : id;
};

/**
 * Deterministic PROPOSAL from a job description; the supervisor decides.
 * - Sheet from "Liczba podległych pracowników" (§3 rozp. 2016): no
 *   subordinates -> C, direct management -> B. Sheet A (head of the office)
 *   cannot be told from this field, so it is never suggested.
 * - Additional criteria candidates: the OSP's soft competencies that are not
 *   mandatory on the suggested sheet (§5 ust. 2: max 3, chosen by the
 *   character of the duties in the OSP).
 */
export function analyseOsp(osp: OspSource): OspAnalysis {
  const subordinates = osp.subordinates.toLocaleLowerCase('pl-PL');
  let suggestedSheet: OspAnalysis['suggestedSheet'] = null;

  if (subordinates.includes('brak podległych')) {
    suggestedSheet = {
      sheetId: 'C',
      reason: `Liczba podległych pracowników w OSP: „${osp.subordinates}”. Stanowisko nie polega na bezpośrednim kierowaniu pracownikami, więc właściwy jest arkusz C.`,
      legalBasis: `§3 ust. 4 ${RO_2016}`,
    };
  } else if (
    subordinates.includes('kieruje') ||
    subordinates.includes('kierujące')
  ) {
    suggestedSheet = {
      sheetId: 'B',
      reason: `Liczba podległych pracowników w OSP: „${osp.subordinates}”. Stanowisko polega na bezpośrednim kierowaniu pracownikami, więc właściwy jest arkusz B. Pole OSP obejmuje też samo koordynowanie pracy: potwierdź, że osoba jest bezpośrednim przełożonym zespołu.`,
      legalBasis: `§3 ust. 3 ${RO_2016}`,
    };
  }

  const mandatory = new Set(
    suggestedSheet
      ? (SHEETS.find((s) => s.id === suggestedSheet.sheetId)
          ?.mandatoryCriteria ?? [])
      : [],
  );
  const additionalCandidates = suggestedSheet
    ? osp.softCompetencies
        .filter((id) => !mandatory.has(id))
        .map((criterionId) => ({
          criterionId,
          reason: `OSP wymienia „${name(criterionId)}” wśród kompetencji miękkich, a w arkuszu ${suggestedSheet.sheetId} nie jest to kryterium obowiązkowe. Propozycja kryterium dodatkowego (najwyżej 3, §5 ust. 2 ${RO_2016}).`,
          ospQuote: osp.softCompetenciesQuote,
        }))
    : [];

  return { suggestedSheet, additionalCandidates };
}
