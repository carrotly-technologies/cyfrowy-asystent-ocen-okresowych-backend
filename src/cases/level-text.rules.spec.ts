import { declaredOverallLevel, levelTextCheck } from './level-text.rules.js';
import { formalCheck } from './formal-check.rules.js';
import { buildSeed } from './seed/seed.data.js';

describe('level in the justification (§11 ust. 1 pkt 2)', () => {
  it('ignores levels of single criteria', () => {
    expect(
      declaredOverallLevel(
        'Wyróżnia ją łączenie wiedzy. Organizacja pracy i komunikacja na poziomie oczekiwań.',
      ),
    ).toBeNull();
  });

  it('reads a declared overall level, the longest label first', () => {
    expect(
      declaredOverallLevel(
        'Ogólny poziom realizacji zadań: na poziomie oczekiwań.',
      ),
    ).toBe('na poziomie oczekiwań');
    expect(
      declaredOverallLevel('Ocena okresowa: znacznie powyżej oczekiwań.'),
    ).toBe('znacznie powyżej oczekiwań');
    expect(declaredOverallLevel('Średnio powyżej oczekiwań.')).toBe(
      'powyżej oczekiwań',
    );
  });

  it('blocks only a contradicting overall declaration', () => {
    expect(
      levelTextCheck('Ogólnie na poziomie oczekiwań.', 'Powyżej oczekiwań')?.ok,
    ).toBe(false);
    expect(
      levelTextCheck(
        'Komunikacja na poziomie oczekiwań, rzetelność wzorowa.',
        'Powyżej oczekiwań',
      )?.ok,
    ).toBe(true);
    expect(levelTextCheck('', 'Powyżej oczekiwań')).toBeNull();
  });

  it('seed c-006 (overall "powyżej", a criterion "na poziomie") passes the formal check', () => {
    const c006 = buildSeed('2026-11-21').find((c) => c.id === 'c-006')!;
    const items = formalCheck(c006, '2026-11-21');
    expect(items.find((i) => i.id === 'LEVEL_TEXT')).toMatchObject({
      ok: true,
    });
  });
});
