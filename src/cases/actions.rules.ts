import { RO_2016 } from '../assessments/assessment.format.js';
import { suggestSheet } from '../sheets/sheet-suggestion.rules.js';
import { MAX_ADDITIONAL } from '../sheets/sheets.data.js';
import { computeEvaluation, sheetOf, STAGE_NAMES } from './case.rules.js';
import { promotionRequestOf } from './promotion.rules.js';
import { assessmentPeriodOf } from './assessment-period.rules.js';
import { CaseRuleError } from './case-rule.error.js';
import {
  type Actor,
  CASE_ACTIONS,
  type CaseAction,
  type CaseRecord,
} from './case.types.js';
import { formatDatePl } from './dates.js';
import {
  cycleAnchor,
  defaultAssessmentDue,
  objectionDeadline,
  openingTalkDeadline,
  reassessmentAfterNegativeDue,
  USC,
} from './deadlines.rules.js';
import { closeMootDueDateRequests } from './due-date.rules.js';
import { formalCheck } from './formal-check.rules.js';
import { nextCycleStart } from './stages.rules.js';
import { objectionRight } from './objection-terms.rules.js';
import {
  type ObjectionAddressee,
  objectionAddressee,
} from './objection-addressee.rules.js';

export const ACTION_LABELS: Record<CaseAction, string> = {
  ACCEPT_SHEET: 'Zatwierdź arkusz, kryteria i termin oceny',
  CONFIRM_PART_I: 'Potwierdź rozmowę rozpoczynającą (część I)',
  EMPLOYEE_ACK_PART_I: 'Potwierdzam zapoznanie z kryteriami i terminem oceny',
  START_ASSESSMENT: 'Zakończ okres obserwacji i przejdź do oceny',
  COMPLETE_ASSESSMENT_TALK: 'Rozmowa oceniająca przeprowadzona',
  SIGN_ASSESSMENT: 'Podpisz ocenę (podpis oceniającego)',
  SEND_FOR_ACK: 'Przekaż ocenianemu do zapoznania',
  EMPLOYEE_ACK_ASSESSMENT: 'Potwierdzam zapoznanie z oceną',
};

/**
 * Who may perform each action. The assessed person's confirmations are
 * theirs only (§6 ust. 2, §12 rozp. 2016); the evaluator cannot click them.
 */
export const ACTION_ACTOR: Record<CaseAction, Actor> = {
  ACCEPT_SHEET: 'EVALUATOR',
  CONFIRM_PART_I: 'EVALUATOR',
  EMPLOYEE_ACK_PART_I: 'EMPLOYEE',
  START_ASSESSMENT: 'EVALUATOR',
  COMPLETE_ASSESSMENT_TALK: 'EVALUATOR',
  SIGN_ASSESSMENT: 'EVALUATOR',
  SEND_FOR_ACK: 'EVALUATOR',
  EMPLOYEE_ACK_ASSESSMENT: 'EMPLOYEE',
};

/** Why `action` is not allowed now (Polish), or null when it is. */
export function actionBlocker(
  record: CaseRecord,
  action: CaseAction,
  _today: string,
): string | null {
  const stage = record.stage;
  const here = `etapie „${STAGE_NAMES[stage]}”`;
  const elsewhere = (what: string) => `${what} Sprawa jest na ${here}.`;

  if (record.acknowledgedOn) {
    return `Ocena jest zakończona: oceniany zapoznał się z nią ${formatDatePl(record.acknowledgedOn)}.`;
  }

  switch (action) {
    case 'ACCEPT_SHEET':
      return stage === 'SHEET_SELECTION'
        ? null
        : elsewhere('Arkusz i kryteria zostały już zatwierdzone.');
    case 'CONFIRM_PART_I':
      return stage === 'OPENING_TALK'
        ? null
        : elsewhere(
            stage === 'SHEET_SELECTION'
              ? 'Najpierw zatwierdź arkusz, kryteria dodatkowe i termin oceny.'
              : 'Część I jest już potwierdzona przez oceniającego.',
          );
    case 'EMPLOYEE_ACK_PART_I':
      return stage === 'PART_I_ACK'
        ? null
        : elsewhere(
            record.partI.acknowledgedByEmployeeOn
              ? `Oceniany potwierdził część I ${formatDatePl(record.partI.acknowledgedByEmployeeOn)}.`
              : `Najpierw oceniający przeprowadza rozmowę rozpoczynającą i potwierdza część I (§5–§6 ${RO_2016}).`,
          );
    case 'START_ASSESSMENT':
      return stage === 'OBSERVATION'
        ? null
        : elsewhere(
            'Do oceny przechodzi się z okresu obserwacji, po potwierdzeniu części I przez ocenianego.',
          );
    case 'COMPLETE_ASSESSMENT_TALK':
      return stage === 'ASSESSMENT'
        ? null
        : elsewhere(
            'Rozmowę oceniającą odnotowuje się na etapie oceny, po okresie obserwacji.',
          );
    case 'SIGN_ASSESSMENT':
      if (stage !== 'SIGNATURE') {
        return elsewhere(
          `Ocenę podpisuje się po rozmowie oceniającej (§10–§11 ${RO_2016}).`,
        );
      }
      return record.signedByEvaluatorOn
        ? `Ocena została już podpisana ${formatDatePl(record.signedByEvaluatorOn)}.`
        : null;
    case 'SEND_FOR_ACK':
      if (stage !== 'SIGNATURE') {
        return elsewhere('Do zapoznania przekazuje się podpisaną ocenę.');
      }
      return record.signedByEvaluatorOn
        ? null
        : 'Najpierw podpisz ocenę; dopiero podpisaną ocenę przekazuje się do zapoznania.';
    case 'EMPLOYEE_ACK_ASSESSMENT':
      return stage === 'ACKNOWLEDGEMENT'
        ? null
        : elsewhere(
            'Oceniany zapoznaje się z oceną dopiero po jej podpisaniu i przekazaniu.',
          );
  }
}

/** Actions allowed right now for `actor` (all actors when omitted). */
export function availableActions(
  record: CaseRecord,
  today: string,
  actor?: Actor,
): CaseAction[] {
  return CASE_ACTIONS.filter(
    (a) =>
      (!actor || ACTION_ACTOR[a] === actor) &&
      actionBlocker(record, a, today) === null,
  );
}

/**
 * The process state machine. Returns the updated copy of the record, or
 * throws CaseRuleError with a Polish explanation of why the transition is not
 * legal now. Who may act is checked by the caller (ACTION_ACTOR).
 */
export function applyAction(
  record: CaseRecord,
  action: CaseAction,
  today: string,
  addressee: ObjectionAddressee = objectionAddressee(record),
): CaseRecord {
  const blocker = actionBlocker(record, action, today);
  if (blocker) {
    const allowed = availableActions(record, today).map(
      (a) => `„${ACTION_LABELS[a]}”`,
    );
    throw new CaseRuleError(
      `Akcja „${ACTION_LABELS[action]}” jest teraz niedostępna. ${blocker}${allowed.length > 0 ? ` Dostępne teraz: ${allowed.join(', ')}.` : ''}`,
    );
  }

  const next = structuredClone(record);
  const log = (text: string) => next.history.push({ date: today, text });

  switch (action) {
    case 'ACCEPT_SHEET': {
      const suggestion = suggestSheet(next.person);
      next.sheetId ??= suggestion.sheetId;
      next.partI.assessmentDue ??= dueFor(next);
      next.stage = 'OPENING_TALK';
      next.completedOn.SHEET_SELECTION = today;
      log(
        `Oceniający zatwierdził arkusz ${next.sheetId}${next.sheetId === suggestion.sheetId ? ' (zgodnie z propozycją systemu)' : ` (propozycja systemu: ${suggestion.sheetId})`}, kryteria dodatkowe ${next.partI.additionalCriteria.length}/${sheetOf(next)?.maxAdditionalCriteria ?? MAX_ADDITIONAL} i termin oceny ${formatDatePl(next.partI.assessmentDue)}.`,
      );
      break;
    }
    case 'CONFIRM_PART_I':
      next.partI.confirmedByEvaluatorOn = today;
      next.partI.assessmentDue ??= dueFor(next);
      next.stage = 'PART_I_ACK';
      next.completedOn.OPENING_TALK = today;
      log(
        `Oceniający potwierdził przeprowadzenie rozmowy rozpoczynającej i zapoznanie ocenianego z kryteriami oraz terminem oceny (${formatDatePl(next.partI.assessmentDue)}). Część I czeka na potwierdzenie ocenianego.`,
      );
      break;
    case 'EMPLOYEE_ACK_PART_I':
      next.partI.acknowledgedByEmployeeOn = today;
      next.stage = 'OBSERVATION';
      next.completedOn.PART_I_ACK = today;
      log(
        `Oceniany potwierdził rozmowę rozpoczynającą i zapoznanie z kryteriami. Od tej daty biegnie okres oceny; oryginał części I trafia do akt osobowych, kopia do ocenianego (§6 ust. 3 ${RO_2016}).`,
      );
      break;
    case 'START_ASSESSMENT':
      next.stage = 'ASSESSMENT';
      next.completedOn.OBSERVATION = today;
      log('Zakończono okres obserwacji; otwarto ocenę (część II arkusza).');
      break;
    case 'COMPLETE_ASSESSMENT_TALK':
      // The evaluator may have entered the actual date of the talk (§10).
      next.assessmentTalkOn ??= today;
      next.stage = 'SIGNATURE';
      next.completedOn.ASSESSMENT = today;
      log(
        `Przeprowadzono rozmowę oceniającą (§10 ${RO_2016}). Sporządzając ocenę, oceniający bierze pod uwagę wnioski z tej rozmowy (§11 ust. 2).`,
      );
      break;
    case 'SIGN_ASSESSMENT': {
      const errors = formalCheck(record, today).filter((item) => !item.ok);
      if (errors.length > 0) {
        throw new CaseRuleError(
          `Nie można podpisać oceny: kontrola formalna wykazała ${errors.length} ${errors.length === 1 ? 'błąd' : errors.length < 5 ? 'błędy' : 'błędów'}. ${errors.map((e) => e.message).join(' ')}`,
          errors,
        );
      }
      next.signedByEvaluatorOn = today;
      // The period printed on the sheet is fixed by the signature.
      next.assessmentPeriod = assessmentPeriodOf(next, today);
      // The default answer becomes the signed one (NIE after a negative result).
      next.promotionRequest = promotionRequestOf(
        next,
        computeEvaluation(next, today),
      );
      log('Oceniający podpisał ocenę na piśmie. Pola oceny są zablokowane.');
      closeMootDueDateRequests(next, today);
      // Use case "wysłanie powiadomienia o złożeniu wniosku o przyznanie
      // kolejnego stopnia służbowego": part III attached to a signed assessment.
      if (next.promotionRequest.attached === 'YES') {
        next.history.push({
          date: today,
          text: `Do oceny dołączono wniosek o przyznanie kolejnego stopnia służbowego${next.promotionRequest.requestedGrade ? ` (${next.promotionRequest.requestedGrade})` : ''} (część III arkusza, art. 89 ust. 1 ${USC}). Wniosek trafia do kadr i dyrektora generalnego urzędu.`,
          event: { type: 'PROMOTION_REQUESTED', notify: ['HR', 'DIRECTOR'] },
        });
      }
      break;
    }
    case 'SEND_FOR_ACK':
      next.sentForAckOn = today;
      next.stage = 'ACKNOWLEDGEMENT';
      next.completedOn.SIGNATURE = today;
      log('Ocenę przekazano ocenianemu do zapoznania.');
      break;
    case 'EMPLOYEE_ACK_ASSESSMENT': {
      next.acknowledgedOn = today;
      next.completedOn.ACKNOWLEDGEMENT = today;
      const objection = objectionDeadline(today, addressee.to);
      log(
        objectionRight(next).open
          ? `Oceniany zapoznał się z oceną. Sprzeciw do ${addressee.to} można wnieść do ${formatDatePl(objection.date!)} (7 dni od zapoznania; ${addressee.legalBasis}).`
          : `Oceniany zapoznał się ze zmienioną oceną. Od oceny zmienionej w wyniku uwzględnienia sprzeciwu nie przysługuje kolejny sprzeciw (art. 83 ust. 4 ${USC}).`,
      );
      const cycle = nextCycleStart(next, today);
      if (cycle) {
        const talk = openingTalkDeadline(cycle);
        log(
          cycle.kind === 'PREVIOUS_NEGATIVE'
            ? `Nowy cykl oceny (po ocenie negatywnej): rozmowa rozpoczynająca do ${formatDatePl(talk.date!)} (7 dni od sporządzenia oceny, §7 pkt 2 ${RO_2016}); ponowna ocena po upływie 6 miesięcy od zapoznania, od ${formatDatePl(reassessmentAfterNegativeDue(today))} (art. 81 ust. 9 ${USC}).`
            : `Nowy cykl oceny: rozmowa rozpoczynająca do ${formatDatePl(talk.date!)} (30 dni od sporządzenia oceny, §7 pkt 1 ${RO_2016}).`,
        );
      }
      break;
    }
  }
  return next;
}

/**
 * Default "termin sporządzenia oceny": 24 months from the start of the cycle
 * (art. 81 ust. 4: employment or the previous assessment), or after 6 months
 * from acknowledging a negative one (art. 81 ust. 9).
 */
export function dueFor(record: CaseRecord): string {
  return record.cycleStart.kind === 'PREVIOUS_NEGATIVE'
    ? reassessmentAfterNegativeDue(record.cycleStart.acknowledgedOn)
    : defaultAssessmentDue(cycleAnchor(record.cycleStart));
}
