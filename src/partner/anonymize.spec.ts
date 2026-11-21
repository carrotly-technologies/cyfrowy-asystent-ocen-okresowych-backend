import { anonymize, deanonymize } from './anonymize.js';

const entities = {
  people: [
    { firstName: 'Anna', lastName: 'Nowak' },
    { firstName: 'Joanna', lastName: 'Kamińska' },
  ],
  units: ['Wydział Analiz i Koordynacji, Departament Spraw Cyfrowych'],
};

describe('anonymize', () => {
  it('replaces names in any grammatical case with one token per person', () => {
    const { text, mapping } = anonymize(
      'Anna Nowak spóźniła się. Rozmawiałam z Anną o tym; pani Nowak przeprosiła. Kamińska wie.',
      entities,
    );
    expect(text).toBe(
      '[OSOBA_1] spóźniła się. Rozmawiałam z [OSOBA_1] o tym; pani [OSOBA_1] przeprosiła. [OSOBA_2] wie.',
    );
    expect(mapping).toEqual({
      '[OSOBA_1]': 'Anna Nowak',
      '[OSOBA_2]': 'Joanna Kamińska',
    });
  });

  it('does not touch a name inside another word', () => {
    expect(anonymize('Joanna i Anna', entities).text).toBe(
      '[OSOBA_2] i [OSOBA_1]',
    );
    expect(anonymize('nowakowski? nie, Nowakowski', { people: [] }).text).toBe(
      'nowakowski? nie, Nowakowski',
    );
  });

  it('replaces PESEL, e-mail and phone numbers', () => {
    const { text, mapping } = anonymize(
      'PESEL 90010112345, mail a.nowak@urzad.gov.pl, tel. +48 600 700 800 lub 22 123 45 67.',
    );
    expect(text).toBe(
      'PESEL [PESEL_1], mail [EMAIL_1], tel. [TELEFON_1] lub [TELEFON_2].',
    );
    expect(mapping['[PESEL_1]']).toBe('90010112345');
    expect(mapping['[EMAIL_1]']).toBe('a.nowak@urzad.gov.pl');
  });

  it('replaces unit names, also in other cases and their parts', () => {
    const { text, mapping } = anonymize(
      'W Wydziale Analiz i Koordynacji, a także w Departamencie Spraw Cyfrowych.',
      entities,
    );
    expect(text).toBe('W [JEDNOSTKA_1], a także w [JEDNOSTKA_2].');
    expect(mapping['[JEDNOSTKA_1]']).toBe('Wydział Analiz i Koordynacji');
  });

  it('deanonymize restores the values and leaves unknown tokens', () => {
    const a = anonymize('Anna Nowak, tel. 600700800', entities);
    expect(deanonymize(`Porozmawiaj z ${'[OSOBA_1]'} [X_9]`, a.mapping)).toBe(
      'Porozmawiaj z Anna Nowak [X_9]',
    );
    expect(deanonymize(a.text, a.mapping)).toBe('Anna Nowak, tel. 600700800');
  });
});
