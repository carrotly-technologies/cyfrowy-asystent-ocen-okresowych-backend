import { FEEDBACK_TIPS, type CaseHints } from './hints.rules.js';
import type { Signal } from './signals.rules.js';

/** Topics of a question, by keyword (stems, lower case, no diacritics needed). */
const TOPICS: { id: string; re: RegExp }[] = [
  { id: 'BURNOUT_RISK', re: /wypal|zmęcz|zmecz|energi|wyczerp|stres/i },
  {
    id: 'OVERLOAD',
    re: /przeciąż|przeciaz|obciąż|obciaz|termin|nadgodzin|za dużo|za duzo/i,
  },
  {
    id: 'MOTIVATION_DROP',
    re: /motywac|zaangażow|zaangazow|satysfakc|zniechęc|zniechec/i,
  },
  { id: 'APPRECIATION', re: /docen|pochwal|pochwał|nagrod|sukces/i },
  {
    id: 'FEEDBACK',
    re: /informacj\w* zwrotn|feedback|powiedzieć|powiedziec|sformułow|sformulow|rozmow\w* oceniaj/i,
  },
  // A supportive talk is about every risk flag (not about appreciation).
  { id: 'SUPPORT', re: /wspier|wsparci|samopoczu|kondycj|dobrostan|rozmow/i },
  { id: 'DEVELOPMENT', re: /rozw[oó]j|rozwoj|szkoleni|iprz|kompetenc|mentor/i },
];

export function questionTopics(question: string): string[] {
  return TOPICS.filter((t) => t.re.test(question)).map((t) => t.id);
}

/**
 * Deterministic answer of the HR partner (no language model): picks the
 * flags, actions and hints that match the question's topics; without a
 * match, a summary of every flag.
 */
export function rulesAnswer(
  question: string,
  name: string | null,
  signals: Signal[],
  hints: CaseHints | null,
): string {
  const topics = questionTopics(question);
  const who = name ?? 'pracownika';
  const lines: string[] = [];
  const relevant = signals.filter(
    (s) =>
      topics.length === 0 ||
      topics.includes(s.kind) ||
      (topics.includes('SUPPORT') && s.kind !== 'APPRECIATION'),
  );
  for (const s of relevant) {
    lines.push(
      `**${s.title}** (${who}). Dlaczego: ${s.reasons.map((r) => r.text).join(' ')}`,
    );
    lines.push(
      'Możliwe działania: ' +
        s.actions.map((a) => `${a.label} – ${a.how}`).join(' '),
    );
  }
  if (
    topics.some((t) =>
      ['OVERLOAD', 'BURNOUT_RISK', 'MOTIVATION_DROP', 'APPRECIATION'].includes(
        t,
      ),
    ) &&
    relevant.length === 0
  )
    lines.push(
      `Dane (puls, obserwacje, zadania) nie pokazują teraz takiego sygnału u: ${who}. Warto mimo to zapytać wprost w rozmowie 1:1.`,
    );
  if (topics.includes('FEEDBACK')) {
    lines.push('Jak przekazać informację zwrotną: ' + FEEDBACK_TIPS.join(' '));
    for (const f of hints?.feedback.slice(0, 2) ?? [])
      lines.push(`Przykład (${f.name}): „${f.text}”`);
  }
  if (topics.includes('DEVELOPMENT')) {
    for (const d of hints?.development ?? [])
      lines.push(
        `Rozwój – ${d.name}: ${d.forms.map((f) => `${f.form}: ${f.text}`).join('; ')}.`,
      );
    if (!hints?.development.length)
      lines.push(
        'Brak kryteriów poniżej poziomu oczekiwań ani przewagi obserwacji do rozwoju; rozważ działania poszerzające mocne strony (nowe wyzwania, mentoring innych).',
      );
  }
  if (lines.length === 0)
    lines.push(
      `Nie widzę teraz sygnałów ryzyka u: ${who}. Utrzymuj regularne rozmowy 1:1 i bieżącą informację zwrotną.`,
    );
  lines.push(
    'Decyzja należy do przełożonego; podpowiedzi nie wpływają na ocenę.',
  );
  return lines.join('\n\n');
}

export const PARTNER_SYSTEM_PROMPT = [
  'Jesteś wirtualnym HR partnerem przełożonego w polskiej służbie cywilnej.',
  'Pomagasz w zarządzaniu ludźmi: dobrostan, przeciążenie, motywacja, docenianie, informacja zwrotna, rozwój.',
  'Odpowiadaj po polsku, zwięźle (do 200 słów), praktycznie, w punktach.',
  'Dane osobowe zastąpiono tokenami w nawiasach kwadratowych, np. [OSOBA_1], [JEDNOSTKA_1]. Używaj tych tokenów dokładnie w tej postaci i nie zgaduj, kim są.',
  'Opieraj się wyłącznie na kontekście. Nie stawiaj diagnoz medycznych ani psychologicznych.',
  'Nigdy nie proponuj ocen cząstkowych ani oceny ogólnej: decyzja należy do przełożonego.',
].join(' ');
