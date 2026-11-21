import {
  ACTION_ACTOR,
  applyAction,
  availableActions,
} from './actions.rules.js';
import { CaseRuleError } from './case-rule.error.js';
import type { CaseAction, CaseRecord } from './case.types.js';
import { applyPatch } from './patch.rules.js';
import { buildSeed } from './seed/seed.data.js';
import { buildStages, caseStatus, nextDeadline } from './stages.rules.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;

const run = (record: CaseRecord, ...actions: CaseAction[]) =>
  actions.reduce((r, a) => applyAction(r, a, TODAY), record);

const conflict = (fn: () => unknown): CaseRuleError => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CaseRuleError);
    return error as CaseRuleError;
  }
  throw new Error('expected CaseRuleError');
};

/** Decides every criterion of the main case (sheet C + myślenie analityczne). */
const decideAll = (record: CaseRecord, points = 5) =>
  applyPatch(
    record,
    {
      decisions: {
        wykorzystywanie_wiedzy: points,
        rzetelnosc: points,
        organizacja_pracy: points,
        wspolpraca: points,
        komunikacja: points,
        myslenie_analityczne: points,
      },
    },
    TODAY,
  );

describe('periodic state machine', () => {
  it('runs the whole path from the sheet choice to the next cycle', () => {
    let r = seed('c-004');
    expect(r.stage).toBe('SHEET_SELECTION');
    expect(availableActions(r, TODAY)).toEqual(['ACCEPT_SHEET']);

    r = applyPatch(
      r,
      { partI: { additionalCriteria: ['myslenie_analityczne'] } },
      TODAY,
    );
    r = run(r, 'ACCEPT_SHEET');
    expect(r.sheetId).toBe('C'); // the rule's suggestion (no subordinates)
    expect(r.partI.assessmentDue).toBe('2028-11-21'); // +24 months
    expect(r.stage).toBe('OPENING_TALK');

    r = run(r, 'CONFIRM_PART_I');
    expect(r.stage).toBe('PART_I_ACK');
    expect(availableActions(r, TODAY, 'EVALUATOR')).toEqual([]);
    expect(availableActions(r, TODAY, 'EMPLOYEE')).toEqual([
      'EMPLOYEE_ACK_PART_I',
    ]);

    r = run(r, 'EMPLOYEE_ACK_PART_I', 'START_ASSESSMENT');
    expect(r.stage).toBe('ASSESSMENT');
    r = decideAll(r);
    r = run(r, 'COMPLETE_ASSESSMENT_TALK');
    expect(r.stage).toBe('SIGNATURE');
    expect(r.assessmentTalkOn).toBe(TODAY);
    r = applyPatch(r, { iprz: 'Szkolenie z analizy ryzyka.' }, TODAY);
    r = run(r, 'SIGN_ASSESSMENT');
    expect(r.signedByEvaluatorOn).toBe(TODAY);
    expect(availableActions(r, TODAY)).toEqual(['SEND_FOR_ACK']);

    r = run(r, 'SEND_FOR_ACK');
    expect(r.stage).toBe('ACKNOWLEDGEMENT');
    expect(caseStatus(r, TODAY)).toBe('DO_ZAPOZNANIA');
    r = run(r, 'EMPLOYEE_ACK_ASSESSMENT');
    expect(caseStatus(r, TODAY)).toBe('OKRES_SPRZECIWU');
    expect(nextDeadline(r, TODAY)).toMatchObject({
      date: '2026-11-30', // 28.11 is a Saturday
      legalBasis: expect.stringContaining('art. 83 ust. 1'),
    });
    expect(r.history.at(-1)!.text).toContain('Nowy cykl oceny');
    expect(buildStages(r, TODAY).every((s) => s.status === 'DONE')).toBe(true);
    expect(caseStatus(r, '2026-12-01')).toBe('ZAKONCZONA');
    expect(nextDeadline(r, '2026-12-01')?.label).toContain('Nowy cykl');
  });

  it('keeps a sheet chosen by the evaluator instead of the suggestion', () => {
    let r = applyPatch(seed('c-004'), { sheetId: 'B' }, TODAY);
    r = run(r, 'ACCEPT_SHEET');
    expect(r.sheetId).toBe('B');
    expect(r.history.at(-1)!.text).toContain('propozycja systemu: C');
  });

  it('a negative assessment starts a 7-day opening talk and a 6-month re-assessment', () => {
    let r = decideAll(seed('c-001'), 3);
    r = applyPatch(
      r,
      {
        iprz: 'Plan.',
        justification: 'Uzasadnienie.',
        promotionRequest: { attached: 'NO' },
      },
      TODAY,
    );
    r = run(
      r,
      'COMPLETE_ASSESSMENT_TALK',
      'SIGN_ASSESSMENT',
      'SEND_FOR_ACK',
      'EMPLOYEE_ACK_ASSESSMENT',
    );
    const text = r.history.at(-1)!.text;
    expect(text).toContain('§7 pkt 2');
    expect(text).toContain('art. 81 ust. 9');
  });

  it('marks stages DONE / CURRENT / UPCOMING / LOCKED', () => {
    const stages = buildStages(seed('c-001'), TODAY);
    expect(stages.map((s) => s.status)).toEqual([
      'DONE',
      'DONE',
      'DONE',
      'DONE',
      'CURRENT',
      'UPCOMING',
      'LOCKED',
    ]);
    expect(stages[4].deadline).toMatchObject({
      date: '2026-12-04',
      state: 'SOON',
    });
  });

  it('assigns the confirmations of the assessed person to EMPLOYEE', () => {
    expect(ACTION_ACTOR.EMPLOYEE_ACK_PART_I).toBe('EMPLOYEE');
    expect(ACTION_ACTOR.EMPLOYEE_ACK_ASSESSMENT).toBe('EMPLOYEE');
    expect(ACTION_ACTOR.SIGN_ASSESSMENT).toBe('EVALUATOR');
  });
});

describe('illegal transitions', () => {
  it.each<[string, CaseAction, string]>([
    ['c-004', 'CONFIRM_PART_I', 'Najpierw zatwierdź arkusz'],
    ['c-001', 'ACCEPT_SHEET', 'już zatwierdzone'],
    ['c-004', 'SIGN_ASSESSMENT', 'po rozmowie oceniającej'],
    ['c-001', 'CONFIRM_PART_I', 'już potwierdzona'],
    ['c-001', 'EMPLOYEE_ACK_ASSESSMENT', 'po jej podpisaniu'],
    ['c-005', 'EMPLOYEE_ACK_PART_I', 'Najpierw oceniający'],
    ['c-007', 'SEND_FOR_ACK', 'Najpierw podpisz ocenę'],
    ['c-006', 'SEND_FOR_ACK', 'Ocena jest zakończona'],
  ])('%s: %s -> 409 (%s)', (id, action, fragment) => {
    const error = conflict(() => applyAction(seed(id), action, TODAY));
    expect(error.message).toContain(fragment);
    expect(error.message).toMatch(/^Akcja „.+” jest teraz niedostępna\./);
  });

  it('lists the actions that are available instead', () => {
    const error = conflict(() =>
      applyAction(seed('c-005'), 'START_ASSESSMENT', TODAY),
    );
    expect(error.message).toContain(
      'Dostępne teraz: „Potwierdź rozmowę rozpoczynającą (część I)”',
    );
  });

  it('SIGN_ASSESSMENT is refused with the failing formal checks', () => {
    const r = run(seed('c-001'), 'COMPLETE_ASSESSMENT_TALK');
    const error = conflict(() => applyAction(r, 'SIGN_ASSESSMENT', TODAY));
    expect(error.formalCheck?.map((f) => f.id)).toEqual([
      'ALL_CRITERIA_DECIDED',
      'JUSTIFICATION_IF_NEGATIVE',
      'IPRZ_REQUIRED',
      'PROMOTION_REQUEST',
    ]);
  });

  it('the seeded negative assessment can be signed', () => {
    const r = run(seed('c-007'), 'SIGN_ASSESSMENT');
    expect(r.signedByEvaluatorOn).toBe(TODAY);
  });
});

describe('patch locks and validation', () => {
  it('part I is locked after the evaluator confirmed it', () => {
    const error = conflict(() =>
      applyPatch(seed('c-001'), { partI: { additionalCriteria: [] } }, TODAY),
    );
    expect(error.message).toContain('Część I jest zablokowana');
  });

  it('part II is a draft during the observation period', () => {
    const r = applyPatch(
      seed('c-003'),
      {
        decisions: { wykorzystywanie_wiedzy: 7 },
        deviationNotes: { wykorzystywanie_wiedzy: 'Notatka robocza.' },
        justification: 'Uzasadnienie robocze.',
        iprz: 'Szkolenie z negocjacji.',
        previousAssessment: { level: 'na poziomie oczekiwań' },
        promotionRequest: { attached: 'NO' },
      },
      TODAY,
    );
    expect(r).toMatchObject({
      stage: 'OBSERVATION',
      decisions: { wykorzystywanie_wiedzy: 7 },
      justification: 'Uzasadnienie robocze.',
      promotionRequest: { attached: 'NO' },
    });
  });

  it('criteria leaving part I are dropped from part II', () => {
    let r = applyPatch(
      seed('c-005'),
      {
        partI: { additionalCriteria: ['kreatywnosc'] },
        decisions: { komunikacja: 5, kreatywnosc: 7 },
      },
      TODAY,
    );
    expect(r.decisions).toEqual({ komunikacja: 5, kreatywnosc: 7 });
    r = applyPatch(r, { partI: { additionalCriteria: [] } }, TODAY);
    expect(r.decisions).toEqual({ komunikacja: 5 });
  });

  it('part II needs a sheet', () => {
    const error = conflict(() =>
      applyPatch(seed('c-004'), { iprz: 'x' }, TODAY),
    );
    expect(error.message).toContain('gdy wybrany jest arkusz');
  });

  it('part II is locked after the evaluator signed', () => {
    const signed = run(seed('c-007'), 'SIGN_ASSESSMENT');
    for (const patch of [
      { decisions: { komunikacja: 7 } },
      { justification: 'Po podpisie.' },
      { iprz: 'Po podpisie.' },
    ]) {
      expect(
        conflict(() => applyPatch(signed, patch, TODAY)).message,
      ).toContain('zablokowane');
    }
  });

  it('rejects more than 3, mandatory, duplicated or unknown additional criteria (400)', () => {
    expect(() =>
      applyPatch(
        seed('c-005'),
        {
          partI: {
            additionalCriteria: [
              'kreatywnosc',
              'negocjowanie',
              'myslenie_analityczne',
              'komunikacja',
            ],
          },
        },
        TODAY,
      ),
    ).toThrow(/najwyżej 3.*obowiązkowe w arkuszu C/s);
    expect(() =>
      applyPatch(
        seed('c-005'),
        { partI: { additionalCriteria: ['kreatywnosc', 'kreatywnosc'] } },
        TODAY,
      ),
    ).toThrow(/więcej niż raz/);
  });

  it('rejects points outside the sheet scale', () => {
    expect(() =>
      applyPatch(seed('c-001'), { decisions: { komunikacja: 4 } }, TODAY),
    ).toThrow('1, 3, 5, 7 lub 9');
  });
});
