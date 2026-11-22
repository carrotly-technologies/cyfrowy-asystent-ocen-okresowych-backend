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
    // +24 months from employment (hired 2026-11-06), not from today (art. 81 ust. 4)
    expect(r.partI.assessmentDue).toBe('2028-11-06');
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
      date: '2026-11-30',
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
      applyPatch(seed('c-001'), { partI: { topics: { duties: 'x' } } }, TODAY),
    );
    expect(error.message).toContain('Część I jest zablokowana');
  });

  it('additional criteria cannot change after part I was confirmed (409)', () => {
    const confirmed = run(seed('c-005'), 'CONFIRM_PART_I');
    for (const record of [seed('c-001'), confirmed]) {
      expect(
        conflict(() =>
          applyPatch(
            record,
            { partI: { additionalCriteria: ['kreatywnosc'] } },
            TODAY,
          ),
        ).message,
      ).toContain(
        'Kryteria dodatkowe można zmienić tylko przed potwierdzeniem części I',
      );
    }
  });

  it('at the opening talk the evaluator adds and removes additional criteria (history, expectations)', () => {
    let r = seed('c-005');
    expect(r.stage).toBe('OPENING_TALK');
    r = applyPatch(
      r,
      {
        partI: {
          additionalCriteria: ['kreatywnosc', 'negocjowanie'],
          expectations: {
            kreatywnosc: 'Nowe rozwiązania.',
            negocjowanie: 'Ugoda.',
          },
        },
      },
      TODAY,
    );
    expect(r.partI.additionalCriteria).toEqual(['kreatywnosc', 'negocjowanie']);
    expect(r.history.at(-1)).toEqual({
      date: TODAY,
      text: 'Zmieniono kryteria dodatkowe: dodano „Kreatywność”, „Negocjowanie” (kryteria dodatkowe 2/3).',
    });

    r = applyPatch(
      r,
      {
        partI: { additionalCriteria: ['kreatywnosc', 'myslenie_analityczne'] },
      },
      TODAY,
    );
    expect(r.partI.additionalCriteria).toEqual([
      'kreatywnosc',
      'myslenie_analityczne',
    ]);
    // the removed criterion's expectations go with it
    expect(r.partI.expectations).toEqual({ kreatywnosc: 'Nowe rozwiązania.' });
    expect(r.history.at(-1)?.text).toMatch(
      /^Zmieniono kryteria dodatkowe: dodano „Myślenie analityczne”; usunięto „Negocjowanie” \(kryteria dodatkowe 2\/3\)\.$/,
    );

    // same list again: no new history entry
    const entries = r.history.length;
    r = applyPatch(
      r,
      {
        partI: { additionalCriteria: ['kreatywnosc', 'myslenie_analityczne'] },
      },
      TODAY,
    );
    expect(r.history).toHaveLength(entries);

    r = run(r, 'CONFIRM_PART_I');
    expect(r.partI.additionalCriteria).toHaveLength(2);
  });

  it('at the opening talk the limit of the sheet still applies (400)', () => {
    expect(() =>
      applyPatch(
        seed('c-005'),
        {
          partI: {
            additionalCriteria: [
              'kreatywnosc',
              'negocjowanie',
              'myslenie_analityczne',
              'orientacja_na_klienta',
            ],
          },
        },
        TODAY,
      ),
    ).toThrow(/najwyżej 3/);
  });

  it('part II is locked before the assessment stage; notatki robocze are not (field schema A/B/C)', () => {
    for (const patch of [
      { decisions: { wykorzystywanie_wiedzy: 7 } },
      { deviationNotes: { wykorzystywanie_wiedzy: 'x' } },
      { justification: 'x' },
      { iprz: 'x' },
      { previousAssessment: { level: 'na poziomie oczekiwań' } },
      { promotionRequest: { attached: 'NO' as const } },
    ]) {
      expect(
        conflict(() => applyPatch(seed('c-003'), patch, TODAY)).message,
      ).toContain('od etapu „Rozmowa oceniająca i ocena”');
    }
    const r = applyPatch(
      seed('c-003'),
      { workingNotes: 'Do omówienia: wizyta w Brukseli.' },
      TODAY,
    );
    expect(r.workingNotes).toBe('Do omówienia: wizyta w Brukseli.');
  });

  it('part II is editable from the assessment stage until signing', () => {
    const r = applyPatch(
      seed('c-001'),
      {
        decisions: { wykorzystywanie_wiedzy: 7 },
        justification: 'Uzasadnienie.',
        iprz: 'Szkolenie.',
        promotionRequest: { attached: 'NO' },
      },
      TODAY,
    );
    expect(r).toMatchObject({
      stage: 'ASSESSMENT',
      decisions: { wykorzystywanie_wiedzy: 7 },
      justification: 'Uzasadnienie.',
    });
  });

  it('criteria leaving part I are dropped from part II (part I made again, §9 ust. 1)', () => {
    let r: CaseRecord = {
      ...decideAll(seed('c-001')),
      stage: 'OPENING_TALK',
    };
    expect(r.decisions.myslenie_analityczne).toBe(5);
    r = applyPatch(r, { partI: { additionalCriteria: [] } }, TODAY);
    expect(r.decisions.myslenie_analityczne).toBeUndefined();
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

describe('legal audit fixes', () => {
  it('ACCEPT_SHEET after a positive assessment: 24 months from that assessment', () => {
    const r = run(seed('c-104'), 'ACCEPT_SHEET');
    // previous assessment 2026-11-09 -> 2028-11-09 (art. 81 ust. 4), not 2028-11-21
    expect(r.partI.assessmentDue).toBe('2028-11-09');
  });

  it('SIGN_ASSESSMENT with part III attached notifies HR and the DG (PROMOTION_REQUESTED)', () => {
    let r = decideAll(seed('c-001'), 9);
    r = applyPatch(
      r,
      {
        iprz: 'Plan.',
        justification: 'Uzasadnienie.',
        promotionRequest: {
          attached: 'YES',
          appointedYear: 2018,
          currentGrade: 'III',
          gradeGrantedOn: '2021-05-04',
          requestedGrade: 'IV',
          motivation: 'Wyróżniające wyniki.',
        },
      },
      TODAY,
    );
    r = run(r, 'COMPLETE_ASSESSMENT_TALK', 'SIGN_ASSESSMENT');
    const event = r.history.find(
      (h) => h.event?.type === 'PROMOTION_REQUESTED',
    );
    expect(event?.event?.notify).toEqual(['HR', 'DIRECTOR']);
    expect(event?.text).toContain('art. 89 ust. 1');
  });

  it('a negative result defaults the promotion question to NIE and signs without an answer', () => {
    let r = decideAll(seed('c-001'), 3);
    r = applyPatch(r, { iprz: 'Plan.', justification: 'Uzasadnienie.' }, TODAY);
    expect(r.promotionRequest.attached).toBeNull();
    r = run(r, 'COMPLETE_ASSESSMENT_TALK', 'SIGN_ASSESSMENT');
    expect(r.promotionRequest.attached).toBe('NO');
    expect(r.history.some((h) => h.event?.type === 'PROMOTION_REQUESTED')).toBe(
      false,
    );
  });

  it('the evaluator sets the assessment talk date and the period until signing', () => {
    let r = applyPatch(
      seed('c-001'),
      {
        assessmentTalkOn: '2026-11-19',
        assessmentPeriod: { from: '2024-12-05' },
      },
      TODAY,
    );
    r = run(r, 'COMPLETE_ASSESSMENT_TALK');
    expect(r.assessmentTalkOn).toBe('2026-11-19'); // kept, not overwritten with today
    expect(() =>
      applyPatch(r, { assessmentTalkOn: '2026-11-30' }, TODAY),
    ).toThrow(/przyszłości/);
    expect(() =>
      applyPatch(seed('c-003'), { assessmentTalkOn: '2026-11-19' }, TODAY),
    ).toThrow(CaseRuleError);
    r = decideAll(r, 7);
    r = applyPatch(
      r,
      { iprz: 'Plan.', promotionRequest: { attached: 'NO' } },
      TODAY,
    );
    r = run(r, 'SIGN_ASSESSMENT');
    expect(r.assessmentPeriod).toEqual({ from: '2024-12-05', to: TODAY });
    expect(() =>
      applyPatch(r, { assessmentPeriod: { to: '2026-11-20' } }, TODAY),
    ).toThrow(/zablokowane/);
  });
});
