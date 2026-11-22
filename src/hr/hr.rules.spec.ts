import { canRemind } from './hr.rules.js';

describe('canRemind', () => {
  it('no reminder for a finished case, the objection period or an objection under review', () => {
    expect(canRemind('ZAKONCZONA')).toBe(false);
    expect(canRemind('OKRES_SPRZECIWU')).toBe(false);
    expect(canRemind('SPRZECIW_W_ROZPATRZENIU')).toBe(false);
  });
  it('reminds while the assessment is in progress or awaits acknowledgement', () => {
    expect(canRemind('W_TOKU')).toBe(true);
    expect(canRemind('DO_ZAPOZNANIA')).toBe(true);
  });
});
