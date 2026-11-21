export type ScalePoints = 1 | 3 | 5 | 7 | 9;

/** One point of the 1–9 scale with its label as on the sheet. */
export interface ScaleLevel {
  points: ScalePoints;
  label: string;
}

/** One criterion of "Wykaz kryteriów oceny" (załącznik nr 1 do rozp. 2016). */
export interface Criterion {
  id: string;
  /** Number in the annex (1–14). */
  number: number;
  /** Display name, e.g. "Organizacja pracy i orientacja na osiąganie celów". */
  name: string;
  /** The bullet points of the "OPIS" column, verbatim. */
  description: string[];
}

/** GET /api/criteria. */
export interface CriteriaCatalogue {
  title: string;
  legalBasis: string;
  scale: ScaleLevel[];
  criteria: Criterion[];
}
