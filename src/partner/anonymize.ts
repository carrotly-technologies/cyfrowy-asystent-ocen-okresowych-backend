/**
 * Pseudonymization before any call to an external language model
 * (wymóg wyzwania: "anonimizacja w razie przetwarzania danych poza
 * infrastrukturą użytkownika"; RODO art. 4 pkt 5, art. 25). Known people and
 * units are replaced with tokens such as [OSOBA_1], [JEDNOSTKA_1]; PESEL
 * numbers, e-mails and phone numbers by pattern. The mapping stays on the
 * server and `deanonymize` restores the original values in the answer.
 */

export interface KnownPerson {
  firstName: string;
  lastName: string;
}

export interface AnonymizeEntities {
  people?: KnownPerson[];
  /** Unit / office names, e.g. "Wydział Analiz i Koordynacji". */
  units?: string[];
}

export interface Anonymized {
  text: string;
  /** token → original value. */
  mapping: Record<string, string>;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A regex source for a Polish name in any grammatical case: the stem (the
 * word without a final vowel or ł; for unit names `loose`: without the last
 * letter, since "Wydział" → Wydziale, "Departament" → Departamencie) plus up
 * to 4 letters ("Nowak" → Nowaka,
 * Nowakowi; "Anna" → Anny, Annie, Anną; "Kamińska" → Kamińskiej).
 */
function inflected(word: string, loose = false): string {
  const stem =
    loose && word.length > 4
      ? word.slice(0, -1)
      : word.length > 3
        ? word.replace(/[aeiouyąęół]$/iu, '')
        : word;
  return `${escape(stem)}\\p{L}{0,4}`;
}

/** Letters around a match must not be letters (\b does not know Polish). */
const bounded = (source: string) => `(?<!\\p{L})(?:${source})(?!\\p{L})`;

interface Rule {
  prefix: string;
  pattern: RegExp;
  /** Value stored in the mapping (e.g. the full name in nominative). */
  canonical?: string;
}

const PESEL = /(?<!\d)\d{11}(?!\d)/g;
const EMAIL = /[\p{L}0-9._%+-]+@[\p{L}0-9.-]+\.\p{L}{2,}/gu;
// +48 600 700 800, 600-700-800, 22 123 45 67, 600700800
const PHONE =
  /(?<![\d\w])(?:\+?48[ -]?)?(?:\d{3}[ -]?\d{3}[ -]?\d{3}|\d{2}[ -]?\d{3}[ -]?\d{2}[ -]?\d{2})(?![\d\w])/g;

/**
 * Replaces personal data with tokens. The same value always gets the same
 * token; a person's full name, surname and first name share one token.
 */
export function anonymize(
  text: string,
  entities: AnonymizeEntities = {},
): Anonymized {
  const mapping: Record<string, string> = {};
  const counters: Record<string, number> = {};
  const tokenFor = new Map<string, string>();
  const token = (prefix: string, canonical: string) => {
    const key = `${prefix}:${canonical}`;
    let t = tokenFor.get(key);
    if (!t) {
      counters[prefix] = (counters[prefix] ?? 0) + 1;
      t = `[${prefix}_${counters[prefix]}]`;
      tokenFor.set(key, t);
      mapping[t] = canonical;
    }
    return t;
  };

  const rules: Rule[] = [
    { prefix: 'EMAIL', pattern: EMAIL },
    { prefix: 'PESEL', pattern: PESEL },
    { prefix: 'TELEFON', pattern: PHONE },
  ];
  // Longest unit names first, so "Wydział X, Departament Y" wins over parts.
  const units = [
    ...new Set(
      (entities.units ?? [])
        .flatMap((u) => [u, ...u.split(/,\s*/)])
        .map((u) => u.trim())
        .filter((u) => u.length > 3),
    ),
  ].sort((a, b) => b.length - a.length);
  for (const unit of units) {
    const source = unit
      .split(/\s+/)
      .map((w) => (w.length > 3 ? inflected(w, true) : escape(w)))
      .join('\\s+');
    rules.push({
      prefix: 'JEDNOSTKA',
      pattern: new RegExp(bounded(source), 'giu'),
      canonical: unit,
    });
  }
  const people = (entities.people ?? []).filter(
    (p) => p.firstName && p.lastName,
  );
  // Full names before single names; surnames before first names.
  for (const p of people) {
    const full = `${p.firstName} ${p.lastName}`;
    rules.push({
      prefix: 'OSOBA',
      pattern: new RegExp(
        bounded(
          `${inflected(p.firstName)}\\s+${inflected(p.lastName)}|${inflected(p.lastName)}\\s+${inflected(p.firstName)}`,
        ),
        'gu',
      ),
      canonical: full,
    });
  }
  for (const p of people)
    rules.push({
      prefix: 'OSOBA',
      pattern: new RegExp(bounded(inflected(p.lastName)), 'gu'),
      canonical: `${p.firstName} ${p.lastName}`,
    });
  for (const p of people)
    rules.push({
      prefix: 'OSOBA',
      pattern: new RegExp(bounded(inflected(p.firstName)), 'gu'),
      canonical: `${p.firstName} ${p.lastName}`,
    });

  let out = text;
  for (const rule of rules) {
    out = out.replace(rule.pattern, (match) =>
      // Never re-tokenize inside an existing token.
      /^\[[A-Z]+_\d+\]$/.test(match)
        ? match
        : token(rule.prefix, rule.canonical ?? match),
    );
  }
  return { text: out, mapping };
}

/** Puts the original values back in place of the tokens. */
export function deanonymize(
  text: string,
  mapping: Record<string, string>,
): string {
  return text.replace(/\[([A-Z]+)_(\d+)\]/g, (t) => mapping[t] ?? t);
}
