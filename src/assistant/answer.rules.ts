import type { AnswerSource } from './assistant.types.js';
import { chunkUrl } from './documents.js';
import { NOT_FOUND } from './assistant.types.js';
import type { KnowledgeBase, SearchHit } from './knowledge-base.js';
import type { KnowledgeDocId } from './knowledge.types.js';
import type { ChatMessage } from './llm.client.js';
import { tokenize } from './text-normalize.js';

/** Below these the knowledge base is treated as not covering the question. */
export const MIN_SCORE = 6;
export const MIN_COVERAGE = 0.5;
/** A Q&A entry is put first only when it matches this well. */
const QA_MIN_SCORE = 9;
const QA_MIN_COVERAGE = 0.6;
const MAX_SOURCES = 5;
const QUOTE_MAX = 420;

export interface Retrieval {
  hits: SearchHit[];
  grounded: boolean;
}

export const isConfident = (hit: SearchHit | undefined): boolean =>
  Boolean(hit && hit.score >= MIN_SCORE && hit.coverage >= MIN_COVERAGE);

/**
 * Best-matching Q&A entry first (when it matches well), then primary sources
 * (acts, guides, HR standards, deadline notes, use cases).
 */
export function retrieve(
  kb: KnowledgeBase,
  question: string,
  exclude: KnowledgeDocId[] = [],
): Retrieval {
  const qa = exclude.includes('QA')
    ? []
    : kb
        .searchQaQuestions(question, 1)
        .filter(
          (h) => h.score >= QA_MIN_SCORE && h.coverage >= QA_MIN_COVERAGE,
        );
  const primary = kb.search(question, {
    k: MAX_SOURCES - qa.length,
    exclude: ['QA', ...exclude],
  });
  const hits = [...qa, ...primary];
  const grounded = hits.some(isConfident);
  return { hits: grounded ? hits : [], grounded };
}

/** For a Q&A chunk, its answer (with the sources it names); else the text. */
function quotable(hit: SearchHit): string {
  if (hit.chunk.qa) {
    const [, answer, source] =
      /Odpowiedź: ([\s\S]*?)\nŹródło: ([\s\S]*)$/.exec(hit.chunk.text) ?? [];
    return answer ? `${answer} (Źródło: ${source})` : hit.chunk.text;
  }
  return hit.chunk.text;
}

/** The window of sentences of `text` that best matches the question. */
export function selectQuote(
  text: string,
  question: string,
  max = QUOTE_MAX,
): string {
  const flat = text
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (flat.length <= max) return flat;
  const sentences = flat.split(/(?<=[.;])\s+(?=[\p{Lu}\d(„-])/u);
  const terms = new Set(tokenize(question));
  const weight = sentences.map(
    (s) => tokenize(s).filter((t) => terms.has(t)).length,
  );
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < sentences.length; i++) {
    let len = 0;
    let score = 0;
    for (
      let j = i;
      j < sentences.length && len + sentences[j].length <= max;
      j++
    ) {
      len += sentences[j].length + 1;
      // Ties go to the window that starts at a matching sentence.
      score += weight[j] * (j === i ? 1.01 : 1);
    }
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  let out = sentences.slice(best).join(' ');
  if (out.length > max) {
    const cut = out.slice(0, max);
    const space = cut.lastIndexOf(' ');
    out = `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
  }
  const prefix = best > 0 ? '… ' : '';
  return prefix + out;
}

export function toSources(hits: SearchHit[], question: string): AnswerSource[] {
  return hits.map((hit, i) => ({
    n: i + 1,
    title: hit.chunk.title,
    ref: hit.chunk.ref,
    quote: selectQuote(quotable(hit), question, hit.chunk.qa ? 900 : QUOTE_MAX),
    url: chunkUrl(hit.chunk),
  }));
}

const RATING_REQUEST = new RegExp(
  [
    // "jaką ocenę / ile punktów / jaki poziom ... dać / przyznać / wystawić"
    '(jak[aąi]|któr[aąy]|ile)[^?]{0,60}(ocen|punkt|poziom)[^?]{0,60}(dać|dac|przyzna|wystawi|postawi|dostać|dostac|należy mu|należy jej)',
    // "oceń go / oceń pracownika / wystaw mu"
    '(^|\\s)(oceń|ocen) (go|ją|ja|pracownika|pracowniczkę)',
    '(^|\\s)wystaw (mu|jej)',
    // "czy dać mu 7 punktów", "czy zasługuje na 9"
    'czy[^?]{0,40}(dać|dac|przyznać|przyznac)[^?]{0,20}\\d',
    'zasługuje na[^?]{0,20}(\\d|ocen|punkt)',
  ].join('|'),
  'iu',
);

/** "Which rating should I give X?" — the assistant must not decide that. */
export const asksForRatingDecision = (question: string): boolean =>
  RATING_REQUEST.test(question);

export const RATING_REFUSAL =
  'Nie mogę rozstrzygnąć, jaką ocenę lub poziom przyznać pracownikowi – to decyzja oceniającego. Mogę natomiast wyjaśnić zasady oceniania i wskazać przepisy.';

/** The first one or two sentences of a text (at most `max` characters), as a direct short answer. */
export function shortAnswer(text: string, max = 320): string {
  const flat = text
    .replace(/^…\s*/, '')
    .replace(/\s*\(Źródło:[\s\S]*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = flat.split(/(?<=[.!?])\s+(?=[\p{Lu}\d„])/u);
  let out = sentences[0] ?? flat;
  if (sentences[1] && out.length + sentences[1].length < max)
    out = `${out} ${sentences[1]}`;
  if (out.length > max) {
    const cut = out.slice(0, max);
    out = `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
  }
  return out;
}

/** The quoted excerpts listed under the short answer. */
export function excerptLines(sources: AnswerSource[], from = 0): string[] {
  return sources
    .slice(from, from + 3)
    .map((s) => `[${s.n}] ${s.ref}: „${s.quote}”`);
}

/**
 * Answer without a language model: a short answer first (the matching Q&A answer, or the opening of the best
 * excerpt), then the excerpts it comes from.
 */
export function extractiveAnswer(
  question: string,
  retrieval: Retrieval,
  sources: AnswerSource[],
): { answer: string; summary: string | undefined } {
  if (!retrieval.grounded) return { answer: NOT_FOUND, summary: undefined };
  const lead = asksForRatingDecision(question) ? `${RATING_REFUSAL}\n\n` : '';
  const summary = lead.trim() || `${shortAnswer(sources[0].quote)} [1]`;
  const lines = [summary, '', 'Na podstawie:', ...excerptLines(sources)];
  return { answer: lines.join('\n'), summary };
}

export const SYSTEM_PROMPT = `Jesteś wewnętrznym asystentem AI urzędu administracji rządowej, który pomaga przełożonym i pracownikom w ocenach okresowych w służbie cywilnej oraz w zarządzaniu ludźmi w zespole.
Zasady, których musisz przestrzegać:
1. Odpowiadaj wyłącznie po polsku i wyłącznie na podstawie ponumerowanych fragmentów źródeł podanych w wiadomości. Nie korzystaj z wiedzy spoza nich.
2. Każde zdanie z faktem, terminem lub regułą opatrz numerem fragmentu w nawiasie kwadratowym, np. [1] albo [2][3]. Nie wymyślaj numerów spoza listy.
3. Jeżeli fragmenty nie zawierają odpowiedzi, napisz dokładnie: "Nie znalazłem tego w bazie wiedzy." i nie zgaduj. Jeżeli źródła mówią, że dana kwestia nie jest uregulowana, powiedz to wprost.
4. Pełnisz funkcję doradczą. Nigdy nie rozstrzygaj, jaką ocenę, poziom ani liczbę punktów ma otrzymać konkretny pracownik – to decyzja oceniającego. Możesz wyjaśnić zasady i wskazać, co wziąć pod uwagę. Wspominaj o tym tylko wtedy, gdy pytanie dotyczy oceny konkretnej osoby — w pozostałych odpowiedziach nie dopisuj tego zastrzeżenia.
5. Przepis aktu prawnego ma pierwszeństwo przed poradnikiem; zestaw Q&A to opracowanie źródeł.
6. Pisz zwięźle i konkretnie (do ok. 200 słów), podawaj liczby dni i miesięcy dokładnie tak, jak w źródłach.
7. Zacznij od jednego–dwóch zdań, które wprost odpowiadają na pytanie; szczegóły i wyjątki podaj dopiero potem.`;

export function buildMessages(
  question: string,
  hits: SearchHit[],
  extraContext?: string,
): ChatMessage[] {
  const excerpts = hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.chunk.title} — ${h.chunk.ref}\n${quotable(h).slice(0, 2000)}`,
    )
    .join('\n\n');
  const user = [
    `Fragmenty źródeł:\n\n${excerpts}`,
    extraContext
      ? `Kontekst sprawy (dane z systemu, nie są źródłem prawa):\n${extraContext}`
      : '',
    `Pytanie: ${question}`,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}

/** Drops citations to excerpts that were not given to the model. */
export function sanitizeCitations(text: string, count: number): string {
  return text.replace(/\[(\d+)\]/g, (m, n: string) =>
    Number(n) >= 1 && Number(n) <= count ? m : '',
  );
}

export const saysNotFound = (text: string): boolean =>
  /nie znalazłem tego w bazie wiedzy/i.test(text);
