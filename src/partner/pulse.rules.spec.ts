import {
  nextPulseDue,
  pulseIndex,
  pulseTrend,
  teamAggregate,
  plIndex,
  toSupervisorPoint,
} from './pulse.rules.js';
import type { PulseResponse } from './pulse.types.js';

type Row = [number, number, number, number, number];
let seq = 0;
export const pulse = (
  date: string,
  [workload, energy, support, clarity, satisfaction]: Row,
  over: Partial<PulseResponse> = {},
): PulseResponse => ({
  id: `r${++seq}`,
  personId: 'p1',
  date,
  answers: { workload, energy, support, clarity, satisfaction },
  comment: null,
  shareComment: false,
  createdAt: `${date}T09:00:00.000Z`,
  ...over,
});
const series = (rows: Row[], start = '2026-09-01') =>
  rows.map((r, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i * 14);
    return pulse(d.toISOString().slice(0, 10), r);
  });

describe('pulseIndex / toSupervisorPoint', () => {
  it('averages the answers to 0.1', () => {
    expect(pulseIndex(pulse('2026-11-01', [4, 4, 5, 4, 5]).answers)).toBe(4.4);
  });

  it('gives the supervisor one overall index, no single answers', () => {
    const p = toSupervisorPoint(pulse('2026-11-01', [1, 5, 5, 5, 5]));
    expect(p).not.toHaveProperty('answers');
    expect(p.index).toBe(4.2);
  });

  it('hides a comment that was not shared', () => {
    const p = toSupervisorPoint(
      pulse('2026-11-01', [3, 3, 3, 3, 3], { comment: 'prywatne' }),
    );
    expect(p.sharedComment).toBeNull();
    expect(p).not.toHaveProperty('hasPrivateComment');
    expect(JSON.stringify(p)).not.toContain('prywatne');
    const shared = toSupervisorPoint(
      pulse('2026-11-01', [3, 3, 3, 3, 3], {
        comment: 'jawne',
        shareComment: true,
      }),
    );
    expect(shared).toMatchObject({
      sharedComment: 'jawne',
    });
  });
});

describe('pulseTrend', () => {
  it('needs two responses', () => {
    expect(pulseTrend([pulse('2026-11-01', [3, 3, 3, 3, 3])]).kind).toBe(
      'NO_DATA',
    );
  });

  it('detects a sudden drop and the questions that fell', () => {
    const t = pulseTrend(
      series([
        [4, 4, 4, 4, 4],
        [4, 4, 4, 4, 4],
        [4, 4, 4, 4, 4],
        [2, 1, 4, 4, 4],
      ]),
    );
    expect(t.kind).toBe('SUDDEN_DROP');
    expect(t.droppedQuestions).toEqual(['workload', 'energy']);
  });

  it('detects a gradual decline (3 decreases in a row)', () => {
    expect(
      pulseTrend(
        series([
          [4, 4, 4, 4, 5],
          [4, 4, 4, 4, 4],
          [3, 4, 4, 3, 4],
          [3, 3, 4, 3, 3],
          [3, 3, 3, 3, 2],
          [2, 3, 3, 2, 2],
        ]),
      ).kind,
    ).toBe('GRADUAL_DECLINE');
  });

  it('detects improvement and stability', () => {
    expect(
      pulseTrend(
        series([
          [3, 3, 3, 3, 3],
          [3, 3, 4, 3, 3],
          [4, 4, 4, 4, 4],
          [4, 4, 4, 4, 4],
        ]),
      ).kind,
    ).toBe('IMPROVING');
    expect(
      pulseTrend(
        series([
          [3, 3, 4, 3, 3],
          [3, 4, 4, 3, 3],
        ]),
      ).kind,
    ).toBe('STABLE');
  });
});

describe('nextPulseDue', () => {
  it('is 14 days after the last response, never in the past', () => {
    expect(nextPulseDue([], '2026-11-21')).toBe('2026-11-21');
    expect(
      nextPulseDue([pulse('2026-11-13', [3, 3, 3, 3, 3])], '2026-11-21'),
    ).toBe('2026-11-27');
    expect(
      nextPulseDue([pulse('2026-10-01', [3, 3, 3, 3, 3])], '2026-11-21'),
    ).toBe('2026-11-21');
  });
});

describe('teamAggregate', () => {
  const today = '2026-11-21';
  it('hides periods with fewer than 3 respondents', () => {
    const rows = [
      pulse('2026-11-20', [4, 4, 4, 4, 4], { personId: 'a' }),
      pulse('2026-11-19', [2, 2, 2, 2, 2], { personId: 'b' }),
    ];
    const [last] = teamAggregate(rows, today, 1);
    expect(last).toMatchObject({ respondents: 2, averages: null, index: null });
    expect(last.hiddenReason).toContain('mniej niż 3');
  });

  it('averages the latest answer of each person in a period', () => {
    const rows = [
      pulse('2026-11-10', [1, 1, 1, 1, 1], { personId: 'a' }),
      pulse('2026-11-20', [4, 4, 4, 4, 4], { personId: 'a' }),
      pulse('2026-11-19', [2, 2, 2, 2, 2], { personId: 'b' }),
      pulse('2026-11-18', [3, 3, 3, 3, 3], { personId: 'c' }),
      pulse('2026-11-01', [5, 5, 5, 5, 5], { personId: 'd' }),
    ];
    const periods = teamAggregate(rows, today, 2);
    expect(periods[1]).toMatchObject({
      from: '2026-11-08',
      to: '2026-11-21',
      respondents: 3,
      index: 3,
    });
    expect(periods[0].respondents).toBe(1);
  });
});

describe('plIndex', () => {
  it('uses a decimal comma', () => {
    expect(plIndex(3.75)).toBe('3,8');
    expect(plIndex(4)).toBe('4');
  });
});
