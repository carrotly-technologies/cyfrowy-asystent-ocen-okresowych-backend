import { displayName, formatPl, listPoints } from './assessment.format.js';

describe('formatPl', () => {
  it.each([
    [4.2, '4,20'],
    [4.1, '4,10'],
    [4, '4,00'],
    [55 / 7, '7,85'],
    [38 / 6, '6,33'],
  ])('formats %d as %s (truncated)', (value, expected) => {
    expect(formatPl(value)).toBe(expected);
  });
});

describe('displayName', () => {
  it('turns upper-case Polish names into sentence case', () => {
    expect(displayName('RZETELNOŚĆ')).toBe('Rzetelność');
    expect(
      displayName('ORGANIZACJA PRACY i ORIENTACJA NA OSIĄGANIE CELÓW'),
    ).toBe('Organizacja pracy i orientacja na osiąganie celów');
  });
});

describe('listPoints', () => {
  it('joins with "lub"', () => {
    expect(listPoints([3, 5, 7])).toBe('3, 5 lub 7');
  });
});
