import { docsUrl } from '../docs/docs-files.js';
import type { KnowledgeChunk, KnowledgeDocId } from './knowledge.types.js';

/** Official consolidated text of the civil service act in ISAP (Sejm). */
export const CIVIL_SERVICE_ACT_ISAP_URL =
  'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20082271505';

export const NO_SOURCE_FILE = 'brak pliku źródłowego';

export interface SourceDocument {
  /** A KnowledgeDocId for the documents the assistant answers from. */
  id: string;
  title: string;
  /** One line under the title: what the document covers. */
  description: string;
  /** Path in docs/, or null when the document is not in the repo. */
  file: string | null;
  /** Where to open it when there is no file in docs/. */
  externalUrl?: string;
  /** Whether the assistant answers from it (it is in the knowledge base). */
  indexed: boolean;
  note?: string;
}

/** Every document of docs/ plus the knowledge-base documents not in it. */
export const SOURCE_DOCUMENTS: SourceDocument[] = [
  {
    id: 'U',
    title:
      'Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej (tekst jednolity)',
    description:
      'tekst jednolity Dz.U. z 2026 r. poz. 590: art. 81–83 (ocena okresowa, sprzeciw), art. 89, art. 108',
    file: 'akty-prawne/ustawa-o-sluzbie-cywilnej.pdf',
    externalUrl: CIVIL_SERVICE_ACT_ISAP_URL,
    indexed: true,
  },
  {
    id: 'ustawa-wyciag',
    title: 'Ustawa o służbie cywilnej – wyciąg przepisów o ocenach okresowych',
    description: 'art. 81–83 i powiązane przepisy w jednym miejscu',
    file: 'akty-prawne/ustawa-o-sluzbie-cywilnej-wyciag.docx',
    indexed: false,
    note: 'treść w bazie z pełnego tekstu ustawy',
  },
  {
    id: 'SZ',
    title:
      'Standardy zarządzania zasobami ludzkimi w służbie cywilnej (zarządzenie nr 6 Szefa Służby Cywilnej z 2020 r.)',
    description:
      'organizacja ZZL, informacja zwrotna, work-life balance, szkolenia i rozwój, zarządzanie wiedzą',
    file: 'akty-prawne/standardy-zzl-w-sluzbie-cywilnej.pdf',
    indexed: true,
    note: 'tekst do bazy wiedzy z OCR skanu',
  },
  {
    id: 'RO',
    title:
      'Rozporządzenie PRM z 4 kwietnia 2016 r. w sprawie ocen okresowych (Dz.U. poz. 470)',
    description:
      'warunki i sposób przeprowadzania ocen okresowych (Dz.U. poz. 470), wzory arkuszy A, B, C',
    file: 'ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf',
    indexed: true,
  },
  {
    id: 'PO',
    title: 'Poradnik KPRM „Oceny okresowe w służbie cywilnej”',
    description: 'ocena okresowa: interpretacje i przykłady',
    file: 'ocena-okresowa/poradnik-oceny-okresowe.pdf',
    indexed: true,
  },
  {
    id: 'AB',
    title: 'Arkusz B oceny okresowej (stanowiska kierujące pracownikami)',
    description: 'wzór arkusza dla osób kierujących zespołem',
    file: 'ocena-okresowa/arkusz-oceny-b.docx',
    indexed: true,
  },
  {
    id: 'AC',
    title: 'Arkusz C oceny okresowej (pozostałe stanowiska)',
    description: 'wzór arkusza dla pozostałych członków korpusu',
    file: 'ocena-okresowa/arkusz-oceny-c.docx',
    indexed: true,
  },
  {
    id: 'LT',
    title: 'Zasady obliczania terminów stosowane przy dokonywaniu ocen',
    description: 'jak liczyć terminy w procedurze ocen',
    file: 'materialy-dodatkowe/zasady-obliczania-terminow.docx',
    indexed: true,
  },
  {
    id: 'UC',
    title: 'Przypadki użycia procesu oceny okresowej (opis)',
    description: 'etapy procesu, przypomnienia, zmiany terminów, wnioski',
    file: 'przypadki-uzycia/przypadki-uzycia-opis.docx',
    indexed: true,
  },
  {
    id: 'use-cases-warunki',
    title: 'Przypadki użycia – warunki brzegowe',
    description: 'warunki brzegowe wybranych przypadków użycia',
    file: 'przypadki-uzycia/przypadki-uzycia-warunki-brzegowe.docx',
    indexed: false,
    note: 'w bazie razem z opisem przypadków użycia',
  },
  {
    id: 'QA',
    title: 'Zestaw pytań i odpowiedzi o ocenach w służbie cywilnej',
    description: 'zestaw przygotowany przez zespół do weryfikacji asystenta',
    file: null,
    indexed: true,
    note: NO_SOURCE_FILE,
  },
  {
    id: 'wykaz-kryteriow',
    title:
      'Wykaz kryteriów oceny (zał. nr 1 do rozporządzenia w sprawie ocen okresowych)',
    description: 'kryteria obowiązkowe i do wyboru dla arkuszy A, B, C',
    file: 'model-kompetencji/wykaz-kryteriow-oceny-zal-1-rozporzadzenie-2016.pdf',
    indexed: false,
    note: 'treść w bazie jako załącznik rozporządzenia z 2016 r.',
  },
];

const byId = new Map(SOURCE_DOCUMENTS.map((d) => [d.id, d]));

/** Where a document opens: its file in docs/, an official page, or nowhere. */
export function documentUrl(doc: SourceDocument): string | null {
  if (doc.file) return docsUrl(doc.file);
  return doc.externalUrl ?? null;
}

/** The link of a knowledge-base excerpt, on its page for a local PDF. */
export function chunkUrl(chunk: KnowledgeChunk): string | null {
  const doc = byId.get(chunk.doc);
  if (!doc) return null;
  const url = documentUrl(doc);
  if (url && doc.file?.endsWith('.pdf') && chunk.page) {
    return `${url}#page=${chunk.page}`;
  }
  return url;
}

export interface DocumentListItem {
  id: string;
  title: string;
  description: string;
  url: string | null;
  indexed: boolean;
  note: string | null;
}

/** Every source document with its link (GET /api/docs). */
export const listDocuments = (): DocumentListItem[] =>
  SOURCE_DOCUMENTS.map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    url: documentUrl(d),
    indexed: d.indexed,
    note: d.note ?? null,
  }));

/** Ids of the knowledge-base documents, for checks. */
export const INDEXED_DOCUMENT_IDS = SOURCE_DOCUMENTS.filter(
  (d) => d.indexed,
).map((d) => d.id as KnowledgeDocId);
