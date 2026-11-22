import { randomInt } from 'node:crypto';

/** Letters and digits without look-alikes (0/O, 1/l/I). */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SPECIALS = '!@#%*+-?';

/**
 * A one-time temporary password: 12 characters, at least one lower, upper,
 * digit and special character. Shown once to HR, never stored in plain text.
 */
export function temporaryPassword(random = randomInt): string {
  const pick = (chars: string) => chars[random(chars.length)];
  const chars = [
    pick('abcdefghijkmnpqrstuvwxyz'),
    pick('ABCDEFGHJKLMNPQRSTUVWXYZ'),
    pick('23456789'),
    pick(SPECIALS),
    ...Array.from({ length: 8 }, () => pick(ALPHABET)),
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Account id from the login: `u-` + login without characters outside a-z0-9-. */
export function accountId(login: string): string {
  return `u-${login.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/** Suggested login „i.nazwisko” without Polish diacritics. */
export function suggestLogin(firstName: string, lastName: string): string {
  const plain = (s: string) =>
    s
      .toLowerCase()
      .replace(/ł/g, 'l')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-]+/g, '');
  return `${plain(firstName).slice(0, 1)}.${plain(lastName)}`;
}
