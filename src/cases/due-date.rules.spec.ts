import { CaseRuleError } from './case-rule.error.js';
import type { CaseRecord } from './case.types.js';
import {
  changeDueDate,
  decideDueDateRequest,
  closeMootDueDateRequests,
  dueDateRequestRule,
  dueDateRequestsView,
  fileDueDateRequest,
  pendingDueDateRequest,
} from './due-date.rules.js';
import { buildSeed } from './seed/seed.data.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  buildSeed(TODAY).find((c) => c.id === id)!;
const EV = { name: 'Joanna Kamińska', role: 'oceniający' };

const conflict = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(CaseRuleError);
    return (error as Error).message;
  }
  throw new Error('expected CaseRuleError');
};

describe('wniosek o zmianę terminu oceny: 6-month condition (art. 81 ust. 8)', () => {
  const withStart = (cycleStart: CaseRecord['cycleStart']): CaseRecord => ({
    ...seed('c-003'),
    cycleStart,
    dueDateRequests: [],
  });

  it('after a previous assessment: more than 6 months since it was made', () => {
    const r = withStart({
      kind: 'PREVIOUS_POSITIVE',
      assessedOn: '2026-05-21',
    });
    expect(dueDateRequestRule(r, '2026-11-21')).toMatchObject({
      eligible: false,
    });
    expect(dueDateRequestRule(r, '2026-11-21').reason).toContain(
      'od 22.11.2026',
    );
    expect(dueDateRequestRule(r, '2026-11-22').eligible).toBe(true);
  });

  it('first assessment: the period since employment longer than 6 months', () => {
    const r = withStart({ kind: 'HIRED', date: '2026-08-31' });
    // 31.08 + 6 months = 28.02.2027 (R2: last day of the month)
    expect(dueDateRequestRule(r, '2027-02-28').eligible).toBe(false);
    expect(dueDateRequestRule(r, '2027-03-01').eligible).toBe(true);
  });

  it('never after a negative assessment, after signing or with a pending request', () => {
    expect(
      dueDateRequestRule(
        withStart({
          kind: 'PREVIOUS_NEGATIVE',
          assessedOn: '2025-01-10',
          acknowledgedOn: '2025-01-12',
        }),
        TODAY,
      ).reason,
    ).toContain('art. 81 ust. 9');
    expect(dueDateRequestRule(seed('c-006'), TODAY).reason).toContain(
      'sporządzona',
    );
    expect(dueDateRequestRule(seed('c-302'), TODAY).reason).toContain(
      'czeka na rozpatrzenie',
    );
    expect(dueDateRequestRule(seed('c-001'), TODAY).eligible).toBe(true);
    expect(dueDateRequestRule(seed('c-002'), TODAY).eligible).toBe(false);
  });
});

describe('request and decision', () => {
  it('approval moves the due date through changeDueDate', () => {
    const filed = fileDueDateRequest(
      seed('c-001'),
      { reason: 'Delegacja', proposedDate: '2027-01-15' },
      TODAY,
    );
    expect(filed.dueDateRequests?.[0].status).toBe('PENDING');
    const approved = decideDueDateRequest(filed, { approve: true }, EV, TODAY);
    expect(approved.partI.assessmentDue).toBe('2027-01-15');
    expect(approved.dueDateRequests?.[0]).toMatchObject({
      status: 'APPROVED',
      newDate: '2027-01-15',
    });
    expect(approved.dueDateChanges?.[0]).toMatchObject({
      from: seed('c-001').partI.assessmentDue,
      to: '2027-01-15',
    });
    expect(approved.history.map((h) => h.event?.type)).toContain(
      'DUE_DATE_CHANGED',
    );
  });

  it('rejection needs a reason and keeps the date', () => {
    const r = seed('c-302');
    expect(
      conflict(() => decideDueDateRequest(r, { approve: false }, EV, TODAY)),
    ).toContain('uzasadnienie');
    const rejected = decideDueDateRequest(
      r,
      { approve: false, note: 'Termin ustawowy' },
      EV,
      TODAY,
    );
    expect(rejected.partI.assessmentDue).toBe(r.partI.assessmentDue);
    expect(rejected.dueDateRequests?.[0].status).toBe('REJECTED');
    expect(
      conflict(() =>
        decideDueDateRequest(
          rejected,
          { approve: true, newDate: '2027-01-15' },
          EV,
          TODAY,
        ),
      ),
    ).toContain('nie ma wniosku');
  });

  it('changeDueDate refuses a past date and a signed assessment', () => {
    expect(
      conflict(() =>
        changeDueDate(seed('c-001'), '2026-11-20', 'x', EV, TODAY),
      ),
    ).toContain('wcześniejszy');
    expect(
      conflict(() =>
        changeDueDate(seed('c-006'), '2027-01-15', 'x', EV, TODAY),
      ),
    ).toContain('sporządzona');
  });
});

describe('wniosek o zmianę terminu po sporządzeniu oceny: bezprzedmiotowy', () => {
  const withPending = (signed: string | null): CaseRecord => ({
    ...seed('c-003'),
    cycleStart: { kind: 'PREVIOUS_POSITIVE', assessedOn: '2025-11-21' },
    signedByEvaluatorOn: signed,
    dueDateRequests: [
      {
        id: 'r1',
        filedOn: '2026-11-20',
        reason: 'nieobecność',
        proposedDate: '2027-01-15',
        status: 'PENDING',
        decidedOn: null,
        decisionNote: null,
        newDate: null,
        decidedBy: null,
      },
    ],
  });

  it('stays pending until the assessment is signed', () => {
    const r = withPending(null);
    expect(pendingDueDateRequest(r)?.id).toBe('r1');
    expect(dueDateRequestsView(r)[0].status).toBe('PENDING');
  });

  it('after signing: no decision possible, shown and closed as moot with a history line', () => {
    const r = withPending('2026-11-21');
    expect(pendingDueDateRequest(r)).toBeUndefined();
    expect(dueDateRequestsView(r)[0]).toMatchObject({ status: 'MOOT' });
    const next = structuredClone(r);
    closeMootDueDateRequests(next, TODAY);
    expect(next.dueDateRequests![0]).toMatchObject({
      status: 'MOOT',
      decidedOn: TODAY,
    });
    expect(next.history.at(-1)!.text).toContain('bezprzedmiotowy');
  });
});
