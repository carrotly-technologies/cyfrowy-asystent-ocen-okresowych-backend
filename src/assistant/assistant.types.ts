export type AssistantMode = 'LLM' | 'EXTRACTIVE';

export interface AnswerSource {
  n: number;
  title: string;
  ref: string;
  quote: string;
  /**
   * Link to the original document: "/api/docs/<file>" (relative to the API
   * origin, "#page=N" for a PDF excerpt), an official page, or null when the
   * document has no file.
   */
  url: string | null;
}

export interface AskResponse {
  /** The full text: the short answer first, then the quoted excerpts (in the extractive mode). */
  answer: string;
  /** One or two sentences that answer the question directly (shown first; the excerpts follow). */
  summary?: string;
  grounded: boolean;
  mode: AssistantMode;
  sources: AnswerSource[];
  disclaimer: string;
}

export const DISCLAIMER =
  'Asystent AI pełni wyłącznie funkcję doradczą. Odpowiada na podstawie bazy wiedzy (ustawa o służbie cywilnej, rozporządzenie o ocenach okresowych, poradnik KPRM, standardy ZZL, zestaw Q&A) i nie podejmuje decyzji o ocenie ani poziomie pracownika. Ostateczna decyzja należy do oceniającego. Zweryfikuj odpowiedź w podanych źródłach.';

export const NOT_FOUND =
  'Nie znalazłem tego w bazie wiedzy. Udostępnione źródła (ustawa o służbie cywilnej, rozporządzenie o ocenach okresowych, poradnik KPRM, standardy ZZL, zestaw Q&A) nie zawierają informacji wystarczających do odpowiedzi na to pytanie. Zwróć się do komórki kadr lub dyrektora generalnego urzędu.';
