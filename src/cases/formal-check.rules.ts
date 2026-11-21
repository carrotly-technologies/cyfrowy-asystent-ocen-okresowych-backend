import { listPoints, RO_2016 } from '../assessments/assessment.format.js';
import {
  caseCriteria,
  computeEvaluation,
  criterionName,
  sheetOf,
} from './case.rules.js';
import type { CaseRecord, FormalCheckItem } from './case.types.js';
import { formatDatePl } from './dates.js';
import { USC } from './deadlines.rules.js';
import { promotionRequestCheck } from './promotion.rules.js';

const quoted = (ids: readonly string[]) =>
  ids.map((id) => `„${criterionName(id)}”`).join(', ');

/**
 * Formal check before the evaluator signs the assessment (notatki/formularze.md
 * sections 1.2 and 2: the forms block approval on these). Every item is
 * returned, so the UI can show ✓ and ✗; signing requires all `ok`.
 */
export function formalCheck(
  record: CaseRecord,
  today: string,
): FormalCheckItem[] {
  const sheet = sheetOf(record);
  if (!sheet) {
    return [
      {
        id: 'SHEET_SELECTED',
        ok: false,
        message: 'Nie wybrano arkusza oceny: wybierz arkusz A, B albo C.',
        legalBasis: `§3 ${RO_2016}`,
      },
    ];
  }
  const criteria = caseCriteria(record);
  const evaluation = computeEvaluation(record, today);
  const items: FormalCheckItem[] = [];

  {
    const confirmed =
      record.partI.confirmedByEvaluatorOn !== null &&
      record.partI.acknowledgedByEmployeeOn !== null;
    items.push({
      id: 'PART_I_CONFIRMED',
      ok: confirmed,
      message: confirmed
        ? `Część I zatwierdzona, oceniany zapoznał się z kryteriami ${formatDatePl(record.partI.acknowledgedByEmployeeOn!)}.`
        : 'Część I nie została zatwierdzona lub oceniany nie potwierdził zapoznania z kryteriami.',
      legalBasis: `§5 ust. 3, §6 ${RO_2016}`,
    });
  }

  const missing = criteria.filter((id) => record.decisions[id] == null);
  items.push({
    id: 'ALL_CRITERIA_DECIDED',
    ok: missing.length === 0,
    message:
      missing.length === 0
        ? `Wszystkie kryteria (${criteria.length}) mają ocenę cząstkową.`
        : `Brak oceny cząstkowej: ${quoted(missing)}.`,
    legalBasis: `§11 ust. 1 pkt 1 ${RO_2016}`,
  });

  const outOfScale = Object.entries(record.decisions)
    .filter(([, points]) => !sheet.scale.includes(points))
    .map(([id]) => id);
  items.push({
    id: 'POINTS_IN_SCALE',
    ok: outOfScale.length === 0,
    message:
      outOfScale.length === 0
        ? `Oceny cząstkowe mieszczą się w skali arkusza (${listPoints(sheet.scale)} pkt).`
        : `Ocena spoza skali ${listPoints(sheet.scale)} pkt: ${quoted(outOfScale)}.`,
    legalBasis: `§11 ust. 1 pkt 1 ${RO_2016}`,
  });

  {
    const additional = record.partI.additionalCriteria;
    const allowed = new Set(criteria);
    const foreign = Object.keys(record.decisions).filter(
      (id) => !allowed.has(id),
    );
    const mandatoryDup = additional.filter((id) =>
      sheet.mandatoryCriteria.includes(id),
    );
    const consistent =
      foreign.length === 0 &&
      mandatoryDup.length === 0 &&
      additional.length <= sheet.maxAdditionalCriteria &&
      new Set(additional).size === additional.length;
    const problems: string[] = [];
    if (foreign.length > 0) {
      problems.push(
        `oceniono kryteria nieustalone w części I: ${quoted(foreign)}`,
      );
    }
    if (mandatoryDup.length > 0) {
      problems.push(
        `kryteria obowiązkowe wpisane jako dodatkowe: ${quoted(mandatoryDup)}`,
      );
    }
    if (additional.length > sheet.maxAdditionalCriteria) {
      problems.push(
        `więcej niż ${sheet.maxAdditionalCriteria} kryteria dodatkowe`,
      );
    }
    items.push({
      id: 'ADDITIONAL_CRITERIA_CONSISTENT',
      ok: consistent,
      message: consistent
        ? additional.length === 0
          ? 'Brak kryteriów dodatkowych; część II obejmuje tylko kryteria obowiązkowe arkusza.'
          : `Kryteria dodatkowe w części II są te same co w części I: ${quoted(additional)}.`
        : `Niezgodność kryteriów części I i II: ${problems.join('; ')}.`,
      legalBasis: `§2 ust. 2, §5 ust. 2 ${RO_2016}`,
    });
  }

  items.push({
    id: 'ASSESSMENT_TALK_HELD',
    ok: record.assessmentTalkOn !== null,
    message: record.assessmentTalkOn
      ? `Rozmowę oceniającą przeprowadzono ${formatDatePl(record.assessmentTalkOn)}.`
      : 'Przed sporządzeniem oceny na piśmie przeprowadź rozmowę oceniającą.',
    legalBasis: `§10 ${RO_2016}`,
  });

  const justified = record.justification.trim().length > 0;
  const negative = evaluation?.result === 'NEGATIVE';
  items.push({
    id: 'JUSTIFICATION_IF_NEGATIVE',
    ok: justified || evaluation?.result === 'POSITIVE',
    message: justified
      ? 'Uzasadnienie oceny jest wpisane.'
      : evaluation === null
        ? 'Wynik oceny nie jest jeszcze znany. Uzasadnienie jest obowiązkowe, jeśli ocena będzie negatywna.'
        : negative
          ? 'Ocena jest negatywna: wpisz uzasadnienie (pole obowiązkowe).'
          : 'Ocena jest pozytywna: uzasadnienie jest opcjonalne, ale zalecane.',
    legalBasis: `§11 ust. 3–4 ${RO_2016}`,
  });

  const hasIprz = record.iprz.trim().length > 0;
  {
    items.push({
      id: 'IPRZ_REQUIRED',
      ok: hasIprz,
      message: hasIprz
        ? 'Wnioski dotyczące indywidualnego programu rozwoju zawodowego są wpisane.'
        : 'Wpisz wnioski do IPRZ: są wymagane niezależnie od wyniku oceny.',
      // art. 81 ust. 5: the assessment contains the IPRZ conclusions; art. 108 ust. 1 pkt 1:
      // the IPRZ itself is then set taking them into account.
      legalBasis: `art. 81 ust. 5 ${USC}; §11 ust. 1 pkt 5 ${RO_2016}; art. 108 ust. 1 pkt 1 ${USC}`,
    });
    items.push(promotionRequestCheck(record, evaluation));
  }

  return items;
}
