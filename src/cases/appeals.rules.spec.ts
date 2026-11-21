import { objectionNextSteps } from './objection-guide.rules.js';
import { applyAction } from './actions.rules.js';
import {
  courtAppealDeadline,
  decideObjection,
  fileObjection,
  legalActions,
  objectionBlocker,
  objectionDecisionDeadline,
  recordAckFiction,
} from './appeals.rules.js';
import { CaseRuleError } from './case-rule.error.js';
import type { CaseRecord } from './case.types.js';
import { buildSeed } from './seed/seed.data.js';
import { caseStatus, nextDeadline } from './stages.rules.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;
const DG = { name: 'Barbara Wiśniewska', role: 'dyrektor generalny urzędu' };
const HR = { name: 'Agnieszka Lis', role: 'kadry' };

const conflict = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CaseRuleError);
    return (error as Error).message;
  }
  throw new Error('expected CaseRuleError');
};

/** c-006 acknowledged on `ackOn`. */
const acknowledged = (ackOn: string): CaseRecord => ({
  ...seed('c-006'),
  acknowledgedOn: ackOn,
});

describe('objection terms (art. 83, KC term rules)', () => {
  it('decision term: 14 days from filing, on a working day', () => {
    expect(objectionDecisionDeadline('2026-11-20').date).toBe('2026-12-04');
    // 05.12.2026 is a Saturday -> Monday 07.12.2026
    const shifted = objectionDecisionDeadline('2026-11-21');
    expect(shifted.date).toBe('2026-12-07');
    expect(shifted.legalBasis).toContain('art. 115 KC');
    // 26.12 (holiday, Saturday), 27.12 Sunday -> 28.12.2026
    expect(objectionDecisionDeadline('2026-12-12').date).toBe('2026-12-28');
  });

  it('objection window: 7 days from acknowledgement, last day included', () => {
    const r = acknowledged('2026-11-13');
    expect(objectionBlocker(r, '2026-11-20')).toBeNull();
    expect(objectionBlocker(r, '2026-11-21')).toContain('upłynął 20.11.2026');
  });

  it('objection window ending on a Saturday runs to Monday', () => {
    const r = acknowledged('2026-11-14');
    expect(objectionBlocker(r, '2026-11-23')).toBeNull();
    expect(objectionBlocker(r, '2026-11-24')).toContain('upłynął 23.11.2026');
  });

  it('court appeal: 14 days from a dismissal or from the missed decision term', () => {
    const filed = { id: 'o', round: 1, filedOn: '2026-11-20', text: 'x' };
    expect(
      courtAppealDeadline({ ...filed, decision: null }, '2026-12-04'),
    ).toBeNull();
    expect(
      courtAppealDeadline({ ...filed, decision: null }, '2026-12-05')?.date,
    ).toBe('2026-12-18');
    expect(
      courtAppealDeadline(
        {
          ...filed,
          decision: {
            outcome: 'DISMISS',
            decidedOn: '2026-11-27',
            reason: 'r',
            decidedBy: DG,
          },
        },
        '2026-11-27',
      )?.date,
    ).toBe('2026-12-11');
  });
});

describe('fikcja zapoznania', () => {
  const handedOver = () => seed('c-101'); // signed and sent, not acknowledged

  it('closes the acknowledgement and starts the objection term from the given date', () => {
    const next = recordAckFiction(
      handedOver(),
      { date: '2026-11-20', reason: 'Odmowa podpisu' },
      HR,
      TODAY,
    );
    expect(next.acknowledgedOn).toBe('2026-11-20');
    expect(next.ackFiction).toMatchObject({
      date: '2026-11-20',
      recordedBy: HR,
    });
    expect(caseStatus(next, TODAY)).toBe('OKRES_SPRZECIWU');
    expect(next.history.at(-1)?.event?.type).toBe('ACK_FICTION_RECORDED');
    expect(objectionBlocker(next, '2026-11-27')).toBeNull();
  });

  it('is refused before the hand-over, after acknowledgement and for dates out of range', () => {
    expect(
      conflict(() =>
        recordAckFiction(
          seed('c-001'),
          { date: TODAY, reason: 'x' },
          HR,
          TODAY,
        ),
      ),
    ).toContain('po podpisaniu oceny');
    expect(
      conflict(() =>
        recordAckFiction(
          seed('c-006'),
          { date: TODAY, reason: 'x' },
          HR,
          TODAY,
        ),
      ),
    ).toContain('już odnotowane');
    expect(
      conflict(() =>
        recordAckFiction(
          handedOver(),
          { date: '2026-11-22', reason: 'x' },
          HR,
          TODAY,
        ),
      ),
    ).toContain('musi przypadać');
  });
});

describe('sprzeciw and the decision of the dyrektor generalny', () => {
  const filed = () => fileObjection(seed('c-006'), 'Nie zgadzam się.', TODAY);

  it('filing puts the case under review with the 14-day decision term', () => {
    const next = filed();
    expect(caseStatus(next, TODAY)).toBe('SPRZECIW_W_ROZPATRZENIU');
    expect(nextDeadline(next, TODAY)?.date).toBe('2026-12-07');
    expect(next.history.at(-1)?.event).toEqual({
      type: 'OBJECTION_FILED',
      notify: ['DIRECTOR', 'EVALUATOR', 'HR'],
    });
    expect(conflict(() => fileObjection(next, 'again', TODAY))).toContain(
      'już wniesiony',
    );
    expect(legalActions(next, TODAY, 'DIRECTOR')).toContain('DECIDE_OBJECTION');
    expect(legalActions(next, TODAY, 'EMPLOYEE')).not.toContain(
      'FILE_OBJECTION',
    );
  });

  it('dismissal closes the case and points to the labour court', () => {
    const next = decideObjection(
      filed(),
      { outcome: 'DISMISS', reason: 'Ocena zasadna' },
      DG,
      TODAY,
    );
    expect(caseStatus(next, TODAY)).toBe('ZAKONCZONA');
    expect(next.history.at(-1)?.text).toContain('sądu pracy w terminie 14 dni');
    expect(
      conflict(() =>
        decideObjection(next, { outcome: 'REDO', reason: 'x' }, DG, TODAY),
      ),
    ).toContain('nie ma sprzeciwu');
  });

  it('change: new scores, back to signature, re-acknowledgement, no second objection', () => {
    let next = decideObjection(
      filed(),
      {
        outcome: 'CHANGE',
        reason: 'Zawyżono wymagania',
        decisions: { organizacja_pracy: 7 },
      },
      DG,
      TODAY,
    );
    expect(next.stage).toBe('SIGNATURE');
    expect(next.signedByEvaluatorOn).toBeNull();
    expect(next.decisions.organizacja_pracy).toBe(7);
    expect(next.assessmentVersions?.[0]).toMatchObject({
      status: 'CHANGED',
      round: 1,
    });
    expect(caseStatus(next, TODAY)).toBe('W_TOKU');
    next = [
      'SIGN_ASSESSMENT',
      'SEND_FOR_ACK',
      'EMPLOYEE_ACK_ASSESSMENT',
    ].reduce((r, a) => applyAction(r, a as never, TODAY), next);
    expect(next.acknowledgedOn).toBe(TODAY);
    expect(objectionBlocker(next, TODAY)).toContain('zmieniona');
  });

  it('ponowne sporządzenie: cancels the assessment, back to ASSESSMENT, may be objected again', () => {
    let next = decideObjection(
      filed(),
      { outcome: 'REDO', reason: 'Brak rozmowy oceniającej' },
      DG,
      TODAY,
    );
    expect(next.stage).toBe('ASSESSMENT');
    expect(next.assessmentTalkOn).toBeNull();
    expect(next.acknowledgedOn).toBeNull();
    expect(next.assessmentVersions?.[0]).toMatchObject({
      status: 'CANCELLED',
      result: 'POSITIVE',
    });
    next = [
      'COMPLETE_ASSESSMENT_TALK',
      'SIGN_ASSESSMENT',
      'SEND_FOR_ACK',
      'EMPLOYEE_ACK_ASSESSMENT',
    ].reduce((r, a) => applyAction(r, a as never, TODAY), next);
    expect(objectionBlocker(next, TODAY)).toBeNull();
    next = fileObjection(next, 'Druga ocena też błędna.', TODAY);
    expect(next.objections?.map((o) => o.round)).toEqual([1, 2]);
    expect(caseStatus(next, TODAY)).toBe('SPRZECIW_W_ROZPATRZENIU');
  });
});

describe('history text', () => {
  it('does not double the full stop after a reason', () => {
    const filed = fileObjection(seed('c-006'), 'x', TODAY);
    const next = decideObjection(
      filed,
      { outcome: 'DISMISS', reason: 'Ocena zasadna.' },
      DG,
      TODAY,
    );
    expect(next.history.at(-1)?.text).toContain(
      'Uzasadnienie: Ocena zasadna. Oceniany',
    );
  });
});

describe('objectionNextSteps ("Co dalej?")', () => {
  it('lists the 7-day, 14-day and labour-court steps with legal basis', () => {
    const steps = objectionNextSteps('dyrektora generalnego urzędu');
    expect(steps).toHaveLength(3);
    expect(steps[0].text).toContain('7 dni');
    expect(steps[0].text).toContain('dyrektora generalnego urzędu');
    expect(steps[1].text).toContain('14 dni');
    expect(steps[2].text).toContain('sądu pracy');
    expect(steps[2].legalBasis).toContain('art. 83 ust. 5');
  });
});

describe('objection addressee in the post-assessment path', () => {
  const sheetA = (): CaseRecord => ({ ...seed('c-006'), sheetId: 'A' });

  it('sheet A: the evaluator decides, the DG does not; notify without DIRECTOR', () => {
    const next = fileObjection(sheetA(), 'Nie zgadzam się.', TODAY);
    expect(next.history.at(-1)?.text).toContain(
      'do osoby, która dokonała oceny okresowej',
    );
    expect(next.history.at(-1)?.event?.notify).toEqual(['EVALUATOR', 'HR']);
    expect(legalActions(next, TODAY, 'EVALUATOR')).toContain(
      'DECIDE_OBJECTION',
    );
    expect(legalActions(next, TODAY, 'DIRECTOR')).not.toContain(
      'DECIDE_OBJECTION',
    );
    const decided = decideObjection(
      next,
      { outcome: 'DISMISS', reason: 'Ocena zasadna' },
      { name: 'Oceniający', role: 'oceniający' },
      TODAY,
    );
    expect(decided.history.at(-1)?.text).toMatch(/^Oceniający \(osoba/);
  });

  it('court term counts from the delivery of the decision (art. 83 ust. 5)', () => {
    const filed = fileObjection(seed('c-006'), 'Nie zgadzam się.', TODAY);
    const decided = decideObjection(
      filed,
      {
        outcome: 'DISMISS',
        reason: 'Ocena zasadna',
        deliveredOn: '2026-11-30',
      },
      DG,
      TODAY,
    );
    const objection = decided.objections!.at(-1)!;
    expect(objection.decision?.deliveredOn).toBe('2026-11-30');
    // 30.11 + 14 days = 14.12.2026 (Monday)
    expect(courtAppealDeadline(objection, TODAY)?.date).toBe('2026-12-14');
    expect(decided.history.at(-1)?.text).toContain('doręczenie 30.11.2026');
    // default: delivered on the decision day
    const sameDay = decideObjection(
      filed,
      { outcome: 'DISMISS', reason: 'Ocena zasadna' },
      DG,
      TODAY,
    ).objections!.at(-1)!;
    expect(sameDay.decision?.deliveredOn).toBe(TODAY);
    expect(
      conflict(() =>
        decideObjection(
          filed,
          { outcome: 'DISMISS', reason: 'x', deliveredOn: '2026-11-01' },
          DG,
          TODAY,
        ),
      ),
    ).toContain('Data doręczenia');
  });
});
