import { RO_2016 } from '../assessments/assessment.format.js';
import { CRITERIA_CATALOGUE } from '../criteria/data/criteria.data.js';

/**
 * Formal check of the justification: a declared OVERALL level ("ogólny poziom
 * …", "ocena okresowa na poziomie …", "łącznie: powyżej oczekiwań") must match
 * the level computed from the average (§11 ust. 1 pkt 2 rozp. 2016; samples
 * E5, E7 of the Poradnik get this wrong). Levels of single criteria
 * ("komunikacja na poziomie oczekiwań") are not a declaration of the overall
 * level and are ignored.
 */

/** A word that makes a sentence speak about the overall level. */
const OVERALL =
  /(?<!\p{L})(ogóln\p{L}*|całościow\p{L}*|łączn\p{L}*|końcow\p{L}*|ocen\p{L}* okresow\p{L}*|średni\p{L}*|poziom\p{L}* ogóln\p{L}*)/iu;

function labels(): string[] {
  return CRITERIA_CATALOGUE.scale
    .map((s) => s.label.toLowerCase())
    .sort((a, b) => b.length - a.length);
}

/**
 * The overall level declared in the text (lower case), or null. Takes the
 * first sentence with an "overall" word followed by a level label; the longest
 * label wins ("znacznie powyżej" over "powyżej").
 */
export function declaredOverallLevel(text: string): string | null {
  for (const sentence of text.toLowerCase().split(/[.;!?\n]+/)) {
    const overall = OVERALL.exec(sentence);
    if (!overall) continue;
    const rest = sentence.slice(overall.index);
    let best: { at: number; label: string } | null = null;
    for (const label of labels()) {
      const at = rest.indexOf(label);
      if (at < 0) continue;
      // The longest label starting at the earliest position.
      if (
        !best ||
        at < best.at ||
        (at === best.at && label.length > best.label.length)
      ) {
        best = { at, label };
      }
    }
    // "powyżej oczekiwań" inside "znacznie powyżej oczekiwań": prefer the longer one.
    if (best) {
      const longer = labels().find(
        (l) =>
          l.length > best!.label.length &&
          l.endsWith(best!.label) &&
          rest.includes(l),
      );
      return longer ?? best.label;
    }
  }
  return null;
}

export interface LevelTextCheck {
  id: 'LEVEL_TEXT';
  ok: boolean;
  message: string;
  legalBasis: string;
}

/** null when there is nothing to compare (no text or no computed level). */
export function levelTextCheck(
  justification: string,
  computedLevel: string | null | undefined,
): LevelTextCheck | null {
  if (!justification.trim() || !computedLevel) return null;
  const computed = computedLevel.toLowerCase();
  const declared = declaredOverallLevel(justification);
  const ok = !declared || declared === computed;
  return {
    id: 'LEVEL_TEXT',
    ok,
    message: !declared
      ? 'Uzasadnienie nie podaje innego poziomu ogólnego niż wyliczony ze średniej.'
      : ok
        ? 'Poziom ogólny opisany w uzasadnieniu jest zgodny z wyliczonym ze średniej.'
        : `W uzasadnieniu jako poziom ogólny wpisano „${declared}”, a wyliczony ze średniej to „${computed}”. Popraw uzasadnienie albo oceny cząstkowe.`,
    legalBasis: `§11 ust. 1 pkt 2 ${RO_2016}`,
  };
}
