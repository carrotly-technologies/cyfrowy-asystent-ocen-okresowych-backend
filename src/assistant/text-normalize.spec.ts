import { foldDiacritics, stem, tokenize } from './text-normalize.js';

describe('text normalization', () => {
  it('lowercases and strips Polish diacritics', () => {
    expect(foldDiacritics('Zażółć GĘŚLĄ jaźń')).toBe('zazolc gesla jazn');
  });

  it('maps inflected forms to one stem', () => {
    const forms = ['ocena', 'oceny', 'ocenie', 'oceną', 'ocenę'];
    const stems = new Set(forms.map((f) => stem(foldDiacritics(f))));
    expect(stems.size).toBe(1);
    expect(tokenize('okresowej')).toEqual(tokenize('okresowa'));
    expect(tokenize('sprzeciwu')).toEqual(tokenize('sprzeciw'));
  });

  it('drops stopwords and keeps numbers', () => {
    expect(tokenize('Czy ocenę sporządza się co 24 miesiące?')).toEqual([
      ...tokenize('ocenę sporządza'),
      '24',
      ...tokenize('miesiące'),
    ]);
  });
});
