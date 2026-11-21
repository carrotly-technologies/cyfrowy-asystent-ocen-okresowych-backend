import { tokenize } from './text-normalize.js';

/** Adjacent pairs weigh less than single words (tuned on the Q&A eval). */
const BIGRAM_WEIGHT = 0.25;

/** Unigrams plus adjacent pairs, so phrases like "rozmowa oceniająca" count. */
export function terms(text: string): string[] {
  const words = tokenize(text);
  const pairs = words.slice(1).map((w, i) => `${words[i]}_${w}`);
  return [...words, ...pairs];
}

export interface Bm25Hit {
  index: number;
  score: number;
  /** Share of distinct query terms present in the document (0..1). */
  coverage: number;
}

/** Okapi BM25 over pre-tokenized documents, all in memory. */
export class Bm25Index {
  private readonly tf: Map<string, number>[];
  private readonly lengths: number[];
  private readonly df = new Map<string, number>();
  private readonly avgLength: number;

  constructor(
    docs: string[],
    private readonly k1 = 1.2,
    private readonly b = 0.6,
  ) {
    this.tf = docs.map((doc) => {
      const counts = new Map<string, number>();
      for (const term of terms(doc)) {
        counts.set(term, (counts.get(term) ?? 0) + 1);
      }
      for (const term of counts.keys()) {
        this.df.set(term, (this.df.get(term) ?? 0) + 1);
      }
      return counts;
    });
    this.lengths = this.tf.map((counts) =>
      [...counts.values()].reduce((a, c) => a + c, 0),
    );
    this.avgLength =
      this.lengths.reduce((a, l) => a + l, 0) / Math.max(1, docs.length);
  }

  idf(term: string): number {
    const n = this.tf.length;
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  search(
    query: string,
    k: number,
    filter: (index: number) => boolean = () => true,
  ): Bm25Hit[] {
    const unigrams = new Set(tokenize(query));
    const queryTerms = [...new Set(terms(query))].filter((t) => this.df.has(t));
    if (queryTerms.length === 0) return [];
    const idf = new Map(queryTerms.map((t) => [t, this.idf(t)]));
    const hits: Bm25Hit[] = [];
    this.tf.forEach((counts, index) => {
      if (!filter(index)) return;
      let score = 0;
      let matched = 0;
      const norm =
        this.k1 *
        (1 - this.b + (this.b * this.lengths[index]) / this.avgLength);
      for (const term of queryTerms) {
        const f = counts.get(term);
        if (!f) continue;
        if (unigrams.has(term)) matched += 1;
        const w = unigrams.has(term) ? 1 : BIGRAM_WEIGHT;
        score += w * (idf.get(term) ?? 0) * ((f * (this.k1 + 1)) / (f + norm));
      }
      if (score > 0) {
        hits.push({ index, score, coverage: matched / unigrams.size });
      }
    });
    return hits.sort((a, b) => b.score - a.score).slice(0, k);
  }
}
