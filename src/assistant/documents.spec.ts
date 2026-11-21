import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_DIR } from '../docs/docs-files.js';
import { KNOWLEDGE_CHUNKS } from './data/knowledge.data.js';
import {
  chunkUrl,
  INDEXED_DOCUMENT_IDS,
  listDocuments,
  NO_SOURCE_FILE,
  SOURCE_DOCUMENTS,
} from './documents.js';
import type { KnowledgeChunk } from './knowledge.types.js';

const chunk = (doc: string, page?: number) =>
  ({ id: 'x', doc, title: '', ref: '', text: '', page }) as KnowledgeChunk;

describe('source documents', () => {
  it('points every file at an existing file in docs/', () => {
    for (const d of SOURCE_DOCUMENTS.filter((d) => d.file)) {
      expect(existsSync(join(DOCS_DIR, d.file!)), d.file!).toBe(true);
    }
  });

  it('lists every original in docs/ (not the text versions)', () => {
    const files = new Set(SOURCE_DOCUMENTS.map((d) => d.file));
    for (const f of [
      'ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf',
      'model-kompetencji/wykaz-kryteriow-oceny-zal-1-rozporzadzenie-2016.pdf',
      'akty-prawne/ustawa-o-sluzbie-cywilnej.pdf',
      'akty-prawne/standardy-zzl-w-sluzbie-cywilnej.pdf',
      'przypadki-uzycia/przypadki-uzycia-opis.docx',
      'materialy-dodatkowe/zasady-obliczania-terminow.docx',
    ]) {
      expect(files.has(f)).toBe(true);
    }
  });

  it('has an entry for every document of the knowledge base', () => {
    const docs = new Set(KNOWLEDGE_CHUNKS.map((c) => c.doc));
    expect([...docs].sort()).toEqual([...INDEXED_DOCUMENT_IDS].sort());
  });

  it('links PDF excerpts to their page', () => {
    expect(chunkUrl(chunk('RO', 2))).toBe(
      '/api/docs/ocena-okresowa/rozporzadzenie-oceny-okresowe-2016.pdf#page=2',
    );
    expect(chunkUrl(chunk('SZ', 3))).toBe(
      '/api/docs/akty-prawne/standardy-zzl-w-sluzbie-cywilnej.pdf#page=3',
    );
    expect(chunkUrl(chunk('AC'))).toBe(
      '/api/docs/ocena-okresowa/arkusz-oceny-c.docx',
    );
  });

  it('links the act to its local PDF and leaves documents without a file unlinked', () => {
    expect(chunkUrl(chunk('U', 39))).toBe(
      '/api/docs/akty-prawne/ustawa-o-sluzbie-cywilnej.pdf#page=39',
    );
    expect(chunkUrl(chunk('QA'))).toBeNull();
    const qa = listDocuments().find((d) => d.id === 'QA');
    expect(qa).toMatchObject({
      url: null,
      indexed: true,
      note: NO_SOURCE_FILE,
    });
  });

  it('marks the criteria catalogue PDF as not indexed', () => {
    const notIndexed = listDocuments()
      .filter((d) => !d.indexed)
      .map((d) => d.id);
    expect(notIndexed).toEqual(expect.arrayContaining(['wykaz-kryteriow']));
  });
});
