/** Source documents of the assistant's knowledge base. */
export type KnowledgeDocId =
  | 'U'
  | 'RO'
  | 'PO'
  | 'LT'
  | 'QA'
  /** Standardy zarządzania zasobami ludzkimi w służbie cywilnej (2020). */
  | 'SZ'
  /** Use cases of the periodic assessment process (challenge material). */
  | 'UC'
  /** Sheets B and C of the periodic assessment. */
  | 'AB'
  | 'AC';

export interface QaMeta {
  no: number;
  /** F fact, T deadline, P pitfall, N not regulated. */
  type: string;
  question: string;
  /** The raw "Źródło:" line, with the [U]/[RO]/... abbreviations. */
  source: string;
}

/** One retrievable excerpt with a citable reference. */
export interface KnowledgeChunk {
  id: string;
  doc: KnowledgeDocId;
  title: string;
  /** Human citation, e.g. "art. 81 ust. 1 ustawy o służbie cywilnej (s. 39/71)". */
  ref: string;
  text: string;
  /** Legal unit, e.g. "art. 81" or "§ 7". */
  unit?: string;
  page?: number;
  section?: string;
  /** Index-only terms: topic labels and sibling ust. of the same unit. */
  keywords?: string;
  qa?: QaMeta;
}
