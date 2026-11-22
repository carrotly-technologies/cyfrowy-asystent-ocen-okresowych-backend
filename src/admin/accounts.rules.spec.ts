import {
  accountId,
  suggestLogin,
  temporaryPassword,
} from './accounts.rules.js';

describe('accounts rules', () => {
  it('temporary password: 12 chars with lower, upper, digit and special', () => {
    for (let i = 0; i < 50; i++) {
      const p = temporaryPassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[2-9]/);
      expect(p).toMatch(/[!@#%*+\-?]/);
    }
  });

  it('temporary passwords differ between calls', () => {
    const set = new Set(Array.from({ length: 20 }, () => temporaryPassword()));
    expect(set.size).toBe(20);
  });

  it('account id from login', () => {
    expect(accountId('J.Testowy')).toBe('u-j-testowy');
  });

  it('suggests i.nazwisko without diacritics', () => {
    expect(suggestLogin('Łukasz', 'Wiśniewski-Żak')).toBe('l.wisniewski-zak');
  });
});
