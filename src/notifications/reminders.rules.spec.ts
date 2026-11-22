import type { CaseRecord } from '../cases/case.types.js';
import { buildSeed } from '../cases/seed/seed.data.js';
import { buildIcs } from './ics.js';
import { InMemoryNotificationsRepository } from './notifications.repository.js';
import { recipientsOf } from './notifications.service.js';
import { USER_SEED } from '../auth/users.seed.js';
import {
  manualAckReminder,
  caseReminders,
  dueSoonBucket,
  generateReminders,
  historyEventDrafts,
  resolvedNotificationKeys,
} from './reminders.rules.js';

const TODAY = '2026-11-21';
const seed = (id: string): CaseRecord =>
  structuredClone(buildSeed(TODAY).find((c) => c.id === id)!);

describe('scheduler reminders', () => {
  it.each([
    [45, null],
    [30, 30],
    [20, 30],
    [14, 14],
    [8, 14],
    [7, 7],
    [0, 7],
    [-1, null],
  ])('dueSoonBucket(%d) = %s', (days, bucket) => {
    expect(dueSoonBucket(days)).toBe(bucket);
  });

  it('the main case (due in ~2 weeks) reminds the evaluator and the evaluee once', () => {
    const drafts = caseReminders(seed('c-001'), TODAY);
    const due = drafts.filter((d) => d.type === 'ASSESSMENT_DUE_SOON');
    expect(due.map((d) => d.audience).sort()).toEqual([
      'EMPLOYEE',
      'EVALUATOR',
    ]);
  });

  it('pending part I confirmation goes to the evaluee', () => {
    expect(caseReminders(seed('c-002'), TODAY)).toContainEqual(
      expect.objectContaining({ type: 'PENDING_ACK', audience: 'EMPLOYEE' }),
    );
  });

  it('criteria reminder before the opening-talk deadline (§7)', () => {
    const types = caseReminders(seed('c-005'), TODAY).map((d) => d.type);
    expect(types).toContain('CRITERIA_REMINDER');
  });

  it('overdue deadlines go to the evaluator and HR, once per stage and date', () => {
    const record = seed('c-001');
    const overdue = caseReminders(record, '2027-06-01').filter(
      (d) => d.type === 'DEADLINE_OVERDUE',
    );
    expect(overdue.map((d) => d.audience).sort()).toEqual(['EVALUATOR', 'HR']);
    const later = caseReminders(record, '2027-06-02').filter(
      (d) => d.type === 'DEADLINE_OVERDUE',
    );
    expect(later[0].key).toBe(overdue[0].key);
  });

  it('objection period running for the evaluee; its end announced afterwards', () => {
    const record = seed('c-006');
    expect(caseReminders(record, TODAY).map((d) => d.type)).toContain(
      'OBJECTION_PERIOD',
    );
    const after = caseReminders(record, '2026-12-05').map((d) => d.type);
    expect(after).toContain('OBJECTION_PERIOD_ENDED');
    expect(after).not.toContain('OBJECTION_PERIOD');
  });

  it('obligatory next grade goes to HR, the evaluator and the DG (art. 89 ust. 2)', () => {
    const audiences = caseReminders(seed('c-006'), TODAY)
      .filter((d) => d.type === 'OBLIGATORY_GRADE')
      .map((d) => d.audience);
    expect(audiences).toEqual(['HR', 'EVALUATOR', 'DIRECTOR']);
  });

  it('the objection reminder names the addressee (sheet A: the assessor)', () => {
    const record = { ...seed('c-006'), sheetId: 'A' as const };
    const draft = caseReminders(record, TODAY).find(
      (d) => d.type === 'OBJECTION_PERIOD',
    );
    expect(draft?.body).toContain('do osoby, która dokonała oceny okresowej');
    expect(
      caseReminders(seed('c-006'), TODAY).find(
        (d) => d.type === 'OBJECTION_PERIOD',
      )?.body,
    ).toContain('do dyrektora generalnego urzędu');
  });

  it('PROMOTION_REQUESTED history events reach HR and the DG', () => {
    const record = {
      ...seed('c-006'),
      history: [
        {
          date: TODAY,
          text: 'Wniosek.',
          event: {
            type: 'PROMOTION_REQUESTED' as const,
            notify: ['HR', 'DIRECTOR'] as ('HR' | 'DIRECTOR')[],
          },
        },
      ],
    };
    expect(
      historyEventDrafts(record, TODAY).map((d) => [d.type, d.audience]),
    ).toEqual([
      ['CASE_EVENT', 'HR'],
      ['CASE_EVENT', 'DIRECTOR'],
    ]);
  });

  it('archived cycles produce nothing', () => {
    expect(caseReminders(seed('c-000'), TODAY)).toEqual([]);
  });

  it('keys are deterministic: two runs give the same keys', () => {
    const keys = (d: ReturnType<typeof generateReminders>) =>
      d.map((x) => `${x.audience}|${x.key}`).sort();
    expect(keys(generateReminders(buildSeed(TODAY), TODAY))).toEqual(
      keys(generateReminders(buildSeed(TODAY), TODAY)),
    );
  });

  it('the store keeps one notification per user and key (idempotency)', async () => {
    const repo = new InMemoryNotificationsRepository();
    const n = {
      id: '1',
      userId: 'u',
      key: 'k',
      caseId: null,
      type: 'SCHEDULER_RUN' as const,
      title: 't',
      body: 'b',
      createdOn: TODAY,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    expect(await repo.insertIfAbsent(n)).toBe(true);
    expect(await repo.insertIfAbsent({ ...n, id: '2' })).toBe(false);
    expect(await repo.insertIfAbsent({ ...n, id: '3', userId: 'v' })).toBe(
      true,
    );
    expect(await repo.listForUser('u')).toHaveLength(1);
    expect(await repo.markAllRead('u', 'now')).toBe(1);
  });

  it('recipients: evaluator, evaluee, HR of a case', () => {
    const users = USER_SEED.map(({ passwordHash: _p, ...u }) => u);
    const record = seed('c-001');
    expect(recipientsOf(users, 'EVALUATOR', record).map((u) => u.id)).toEqual([
      'u-kaminska',
    ]);
    expect(recipientsOf(users, 'EMPLOYEE', record).map((u) => u.id)).toEqual([
      'u-nowak',
    ]);
    expect(recipientsOf(users, 'HR', record).map((u) => u.id)).toEqual([
      'u-lis',
    ]);
  });
});

describe('ics', () => {
  it('builds a calendar event with escaped text', () => {
    const ics = buildIcs({
      uid: 'x@y',
      date: '2026-12-01',
      time: '09:30',
      durationMinutes: 60,
      summary: 'Rozmowa; oceniająca',
      location: 'Pokój 101, II piętro',
      description: 'a',
      stamp: '2026-11-21T10:00:00.000Z',
    });
    expect(ics).toContain('DTSTART;TZID=Europe/Warsaw:20261201T093000');
    expect(ics).toContain('DTEND;TZID=Europe/Warsaw:20261201T103000');
    expect(ics).toContain('TZID:Europe/Warsaw');
    expect(ics).toContain('SUMMARY:Rozmowa\\; oceniająca');
    expect(ics).toContain('LOCATION:Pokój 101\\, II piętro');
  });
});

describe('manualAckReminder', () => {
  it('reminds about part I or the assessment only when the evaluee has something to confirm', () => {
    const seed = buildSeed('2026-11-21');
    const partI = seed.find((c) => c.stage === 'PART_I_ACK')!;
    expect(manualAckReminder(partI, '2026-11-21', 'J. K.')).toMatchObject({
      audience: 'EMPLOYEE',
      key: `${partI.id}:REMIND_PART_I:2026-11-21`,
    });
    const sheet = seed.find((c) => c.stage === 'SHEET_SELECTION')!;
    expect(manualAckReminder(sheet, '2026-11-21', 'J. K.')).toBeNull();
  });
});

describe('resolvedNotificationKeys', () => {
  const blank = (r: CaseRecord): CaseRecord => ({
    ...r,
    partI: {
      ...r.partI,
      confirmedByEvaluatorOn: null,
      acknowledgedByEmployeeOn: null,
    },
    completedOn: {},
    signedByEvaluatorOn: null,
    acknowledgedOn: null,
    talkInvitations: [
      {
        id: 'i1',
        kind: 'OPENING',
        date: TODAY,
        time: '10:00',
        place: 'p',
        note: '',
        createdOn: TODAY,
      },
      {
        id: 'i2',
        kind: 'ASSESSMENT',
        date: TODAY,
        time: '10:00',
        place: 'p',
        note: '',
        createdOn: TODAY,
      },
    ],
  });

  it('nothing is done before the actions', () => {
    expect(resolvedNotificationKeys(blank(seed('c-001')))).toEqual({
      exact: [],
      prefixes: [],
    });
  });

  it('part I confirmed by the employee resolves "Potwierdź część I"; the opening talk invitation is done after part I', () => {
    const r = blank(seed('c-001'));
    r.partI.confirmedByEvaluatorOn = TODAY;
    r.partI.acknowledgedByEmployeeOn = TODAY;
    expect(resolvedNotificationKeys(r)).toEqual({
      exact: ['c-001:TALK:i1'],
      prefixes: ['c-001:ACK_PART_I:', 'c-001:REMIND_PART_I:'],
    });
  });

  it('a signed and acknowledged assessment resolves the assessment talk invitation and "Zapoznaj się z oceną"', () => {
    const r = blank(seed('c-001'));
    r.signedByEvaluatorOn = TODAY;
    r.acknowledgedOn = TODAY;
    const keys = resolvedNotificationKeys(r);
    expect(keys.exact).toEqual(['c-001:TALK:i2']);
    expect(keys.prefixes).toEqual([
      'c-001:ACK:',
      'c-001:REMIND_ACK:',
      'c-001:ACK_WAITING:',
    ]);
  });
});
