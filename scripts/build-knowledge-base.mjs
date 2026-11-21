// One-off ingestion: turns the source documents (acts, regulations, KPRM
// guides, deadline notes, Q&A set) into a typed TS module with text chunks
// (src/assistant/data/knowledge.data.ts), so the app needs no runtime reads.
//
// Acts are chunked by legal unit (art./§ + ust.), guides by page (split on
// paragraphs when long), the deadline note by paragraph, Q&A by question.
// The competency model is not ingested here: the app builds its chunks from
// src/competency-model/data/model.data.ts.
//
// Requires `pdftotext` (poppler) and `unzip` on PATH.
// Usage: node scripts/build-knowledge-base.mjs [repo-root]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] ?? resolve(import.meta.dirname, '../..'));
const target = resolve(
  import.meta.dirname,
  '../src/assistant/data/knowledge.data.ts',
);

const P = {
  U: 'cyfrowy-asysten-ocen-okresowych/extracted/1. Akty prawne/1. Akty prawne/3. Ustawa o służbie cywilnej - cała.pdf',
  RO: 'cyfrowy-asysten-ocen-okresowych/extracted/1. Akty prawne/1. Akty prawne/1. Rozporządzenie w sprawie ocen okresowych.pdf',
  RP: 'kompas-kompetencji/extracted/HackNation/Pierwsza ocena w służbie cywilnej/Rozporządzenie o pierwszej ocenie z 2015 r. (1).pdf',
  PO: 'cyfrowy-asysten-ocen-okresowych/extracted/6. Materiały dodatkowe/6. Materiały dodatkowe/Poradnik - oceny okresowe w służbie cywilnej.pdf',
  PP: 'kompas-kompetencji/extracted/HackNation/Pierwsza ocena w służbie cywilnej/Pierwsza ocena w służbie cywilnej - poradnik z 2016 r. (1).pdf',
  LT: 'cyfrowy-asysten-ocen-okresowych/extracted/6. Materiały dodatkowe/6. Materiały dodatkowe/liczenie terminów.docx',
  QA: 'notatki/qa-baza-wiedzy.md',
};

export const DOCS = {
  U: {
    title:
      'Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej (t.j. Dz.U. z 2026 r. poz. 590)',
    of: 'ustawy o służbie cywilnej',
  },
  RO: {
    title:
      'Rozporządzenie Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej (Dz.U. poz. 470)',
    of: 'rozporządzenia w sprawie ocen okresowych (2016)',
  },
  RP: {
    title:
      'Rozporządzenie Prezesa Rady Ministrów z dnia 23 lipca 2015 r. w sprawie szczegółowych warunków i sposobu dokonywania pierwszej oceny w służbie cywilnej (Dz.U. poz. 1144)',
    of: 'rozporządzenia w sprawie pierwszej oceny (2015)',
  },
  PO: {
    title: 'Poradnik KPRM „Oceny okresowe w służbie cywilnej” (2016)',
    of: 'Poradnik „Oceny okresowe w służbie cywilnej”',
  },
  PP: {
    title: 'Poradnik KPRM „Pierwsza ocena w służbie cywilnej” (2016)',
    of: 'Poradnik „Pierwsza ocena w służbie cywilnej”',
  },
  LT: {
    title: 'Zasady obliczania terminów stosowane przy dokonywaniu ocen',
    of: 'Zasady obliczania terminów',
  },
  QA: {
    title: 'Zestaw pytań i odpowiedzi o ocenach w służbie cywilnej',
    of: 'Zestaw Q&A',
  },
};

const pdfPages = (rel) =>
  execFileSync('pdftotext', ['-layout', resolve(root, rel), '-'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\f')
    .map((page) => page.split('\n'));

const NOISE = [
  /©Kancelaria Sejmu/,
  /^\s*\d{4}-\d{2}-\d{2}\s*$/,
  /^\s*Dziennik Ustaw\s+–\s*\d+\s*–\s+Poz\. \d+/,
  /^\s*\d{1,3}\s*$/,
  /Dokument podpisany|przez Marek Głuch|Data: 2015\.08\.12|\d\d:\d\d:\d\d CEST/,
  /^\s*[a-z.]{1,4}\s*$/,
  /\.{8,}/,
];

/** Drops the right-hand margin notes of the consolidated act. */
const cutMargin = (line, col) => {
  if (line.search(/\S/) >= col - 6) return '';
  const m = /\S(\s{3,})\S/g;
  let match;
  while ((match = m.exec(line))) {
    const start = match.index + 1 + match[1].length;
    if (start >= col) return line.slice(0, match.index + 1);
  }
  if (line.search(/\S/) >= col) return '';
  return line;
};

const clean = (lines, marginCol) =>
  lines
    .map((l) => (marginCol ? cutMargin(l, marginCol) : l))
    .filter((l) => !NOISE.some((re) => re.test(l)));

/**
 * The 2015 regulation PDF puts list markers ("1)", "2)") on their own lines,
 * followed by the item texts; this re-attaches them. Also drops the stray
 * letters of the e-signature watermark (".go", "v.p", "rcl", "ww").
 */
function fixLists(text) {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+(\.go|v\.p|rcl|ww|w\.)\s*$/, ''))
    .filter((l) => !/^\s*(\.go|v\.p|rcl|ww|w\.|l)\s*$/.test(l));
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const markers = [];
    let j = i;
    while (j < lines.length) {
      if (/^\s*\d+\)\s*$/.test(lines[j])) markers.push(lines[j].trim());
      else if (lines[j].trim()) break;
      j++;
    }
    // A marker glued to the first item ("4) zaliczenie...") closes the run.
    const glued =
      markers.length > 0 && /^\s*(\d+\))\s+(.+)$/.exec(lines[j] ?? '');
    if (glued && Number(glued[1].slice(0, -1)) === markers.length + 1) {
      markers.push(glued[1]);
      lines[j] = glued[2];
    }
    if (markers.length === 0) {
      out.push(lines[i]);
      continue;
    }
    const items = [];
    let k = j;
    while (k < lines.length && items.length < markers.length) {
      if (lines[k].trim()) items.push(lines[k].trim());
      k++;
    }
    if (
      items.length === markers.length &&
      items.every((t) => !/^\d+\)/.test(t))
    ) {
      markers.forEach((m, n) => out.push(`${m} ${items[n]}`));
      i = k - 1;
    } else {
      out.push(...lines.slice(i, j));
      i = j - 1;
    }
  }
  return out.join('\n');
}

const squash = (text) =>
  fixLists(text)
    // The consolidated act glues these ("niewcześniej niż").
    .replace(/\bnie(wcześniej|później)\b/g, 'nie $1')
    .replace(/\u00ad|\ufeff/g, '')
    .replace(/(\p{Ll})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Editorial topic labels per legal unit (index-only keywords, never quoted),
// in the vocabulary of the KPRM guides, so that questions phrased like the
// guides ("rozmowa rozpoczynająca") reach paragraphs that only say "czynności,
// o których mowa w § 5 i § 6".
const TOPICS = {
  RO: {
    '§ 2':
      'kryteria obowiązkowe i dodatkowe, wybór kryteriów dodatkowych, oceniający bezpośredni przełożony',
    '§ 3':
      'arkusz A arkusz B arkusz C, który arkusz, wybór arkusza oceny, kierownik urzędu, kierowanie pracownikami, pozostałe stanowiska',
    '§ 4':
      'kryteria obowiązkowe arkusz A arkusz B arkusz C, różnice między arkuszami',
    '§ 5':
      'rozmowa rozpoczynająca proces oceny, ustalenie kryteriów, oczekiwania, cele, maksymalnie 3 kryteria dodatkowe, część I arkusza',
    '§ 6':
      'po rozmowie rozpoczynającej, podpis ocenianego, oryginał arkusza do akt osobowych, kopia części I arkusza',
    '§ 7':
      'termin rozmowy rozpoczynającej i ustalenia kryteriów, 30 dni od poprzedniej oceny lub zatrudnienia, 7 dni po ocenie negatywnej, ponowna ocena',
    '§ 8': 'zmiana terminu oceny, zawiadomienie o nowym terminie, pismo',
    '§ 9':
      'zmiana stanowiska, zmiana zakresu obowiązków, zmiana oceniającego, zmiana przełożonego, ponowne ustalenie kryteriów, termin nie ulega zmianie',
    '§ 10': 'rozmowa oceniająca, kiedy, co omawia się, kierunki rozwoju, IPRZ',
    '§ 11':
      'sporządzenie oceny na piśmie, oceny cząstkowe, skala ocen 1 3 5 7 9, średnia arytmetyczna, ogólny poziom spełniania kryteriów, przedziały średniej, ocena pozytywna negatywna, uzasadnienie, wnioski IPRZ, wniosek o stopień służbowy',
    '§ 12':
      'zapoznanie ocenianego z oceną, podpis, oryginał do akt osobowych, kopia arkusza, odmowa podpisu',
    '§ 13': 'przepisy przejściowe, stare przepisy',
  },
  RP: {
    '§ 2':
      'elementy pierwszej oceny, kryteria pierwszej oceny, postawa, zaangażowanie, egzamin, sprawozdanie',
    '§ 3':
      'rozmowa wstępna, 21 dni od nawiązania stosunku pracy, termin rozmowy wstępnej, zastępstwo',
    '§ 4':
      'termin na złożenie sprawozdania, po 8 miesiącach, arkusz pierwszej oceny część I II',
    '§ 5':
      'nowy termin sprawozdania, nieobecność usprawiedliwiona, przedłużenie umowy, delegacja',
    '§ 6': 'sprawozdanie, 7 miesięcy, treść sprawozdania',
    '§ 7':
      'dokonanie pierwszej oceny, rozmowa oceniająca, oceny cząstkowe, ocena łączna średnia',
    '§ 8':
      'rozmowa oceniająca pierwsza ocena, po złożeniu sprawozdania, kierujący komórką',
    '§ 9': 'skala pierwszej oceny 3 5 7 punktów',
    '§ 10':
      'warunki pozytywnej pierwszej oceny, ocena negatywna, egzamin ze służby przygotowawczej, sprawozdanie w terminie, najwyżej jedna ocena 3 punkty, średnia co najmniej 5, uzasadnienie, wnioski rozwojowe, wynik pierwszej oceny',
    '§ 11': 'zapoznanie z pierwszą oceną, akta osobowe, kopia arkusza',
  },
  U: {
    'art. 35':
      'umowa na czas określony 12 miesięcy, nowy pracownik, przedłużenie umowy nieobecność, pierwsza ocena negatywna rozwiązanie umowy',
    'art. 36': 'służba przygotowawcza, egzamin',
    'art. 37': 'pierwsza ocena, kto podlega pierwszej ocenie',
    'art. 38':
      'pierwsza ocena termin, 8 miesięcy, miesiąc przed upływem umowy, kto dokonuje, kierujący komórką, pozytywna ocena umowa na czas nieokreślony',
    'art. 81': 'ocena okresowa',
    'art. 81 ust. 1':
      'kto podlega ocenie okresowej, kto ocenia, bezpośredni przełożony, umowa na czas nieokreślony',
    'art. 81 ust. 3':
      'czego dotyczy ocena okresowa, opis stanowiska, na piśmie, zapoznanie',
    'art. 81 ust. 4':
      'jak często sporządza się ocenę okresową, częstotliwość, termin oceny, co 24 miesiące',
    'art. 81 ust. 5': 'IPRZ indywidualny program rozwoju zawodowego, wnioski',
    'art. 81 ust. 6':
      'zmiana stanowiska, istotna zmiana zakresu obowiązków, ocena przed terminem, 6 miesięcy',
    'art. 81 ust. 7':
      'nieobecność dłuższa niż miesiąc, przedłużenie terminu oceny, zwolnienie lekarskie, urlop',
    'art. 81 ust. 8':
      'zmiana terminu oceny przez oceniającego, zmiana oceniającego, wniosek ocenianego',
    'art. 81 ust. 9': 'ocena negatywna, ponowna ocena po 6 miesiącach',
    'art. 83': 'sprzeciw od oceny okresowej',
    'art. 83 ust. 1':
      'termin sprzeciwu, 7 dni, do kogo sprzeciw, dyrektor generalny urzędu',
    'art. 83 ust. 3': 'rozpatrzenie sprzeciwu, 14 dni',
    'art. 83 ust. 4':
      'uwzględnienie sprzeciwu, zmiana oceny, ocena po raz drugi',
    'art. 83 ust. 5': 'odwołanie do sądu pracy, 14 dni',
    'art. 71': 'rozwiązanie stosunku pracy, dwie kolejne negatywne oceny',
    'art. 86': 'stopnie służbowe urzędników',
    'art. 89': 'kolejny stopień służbowy, dwie najwyższe oceny, wynagrodzenie',
  },
};

const chunks = [];
const push = (doc, ref, text, extra = {}) => {
  const body = squash(text);
  if (body.length < 25) return;
  chunks.push({
    id: `${doc}-${chunks.filter((c) => c.doc === doc).length + 1}`,
    doc,
    title: DOCS[doc].title,
    ref,
    text: body,
    ...extra,
  });
};

// ---------------------------------------------------------------- acts

/**
 * Splits an act into units (art. / §) and their ust. Lines are tagged with the
 * PDF page so the ref can carry it. Stops at the annexes, which are chunked by
 * page.
 */
function ingestAct(doc, { unitRe, unitLabel, pageLabel, marginCol, annexRe }) {
  const pages = pdfPages(P[doc]);
  const lines = [];
  let annexFrom = null;
  pages.forEach((page, i) => {
    for (const line of clean(page, marginCol)) {
      if (annexFrom === null && annexRe && annexRe.test(line)) annexFrom = i;
      if (annexFrom === null) lines.push({ line, page: i + 1 });
    }
  });

  let chapter = '';
  let unit = null; // { no, ust: [{ no, page, lines }] }
  const flush = () => {
    if (!unit) return;
    const many = unit.ust.length > 1;
    for (const [idx, u] of unit.ust.entries()) {
      const ust = many || u.no !== null ? ` ust. ${u.no ?? 1}` : '';
      const label = `${unitLabel} ${unit.no}${ust}`;
      const ref = `${label} ${DOCS[doc].of} (${pageLabel(u.page)})`;
      const head =
        many && idx > 0
          ? `${unitLabel === 'art.' ? 'Art.' : '§'} ${unit.no}. `
          : '';
      const unitId = `${unitLabel} ${unit.no}`;
      push(doc, ref, (head + u.lines.join('\n')).trim(), {
        unit: unitId,
        keywords:
          [TOPICS[doc]?.[unitId], TOPICS[doc]?.[label]]
            .filter(Boolean)
            .join(', ') || undefined,
        page: u.page,
        section: chapter || undefined,
      });
    }
    unit = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const { line, page } = lines[i];
    const chap = /^\s*Rozdział (\d+[a-z]*)\s*$/.exec(line);
    if (chap) {
      flush();
      const title = (
        lines[i + 2]?.line.trim() ? lines[i + 2] : lines[i + 1]
      )?.line.trim();
      chapter = `Rozdział ${chap[1]}${title ? ` ${title}` : ''}`;
      continue;
    }
    const m = unitRe.exec(line);
    if (m) {
      flush();
      const rest = line.slice(m.index + m[0].length);
      const ust = /^(\d+[a-z]*)\.\s/.exec(rest);
      unit = {
        no: m[1],
        ust: [{ no: ust ? ust[1] : null, page, lines: [line.trim()] }],
      };
      continue;
    }
    if (!unit) continue;
    const ust = /^\s{3,}(\d+[a-z]*)\.\s+\S/.exec(line);
    if (ust && unit.ust[0].no !== null) {
      unit.ust.push({ no: ust[1], page, lines: [line.trim()] });
    } else {
      unit.ust.at(-1).lines.push(line.trim());
    }
  }
  flush();

  if (annexFrom !== null) {
    let annex = '';
    for (let i = annexFrom; i < pages.length; i++) {
      const text = clean(pages[i]).join('\n');
      const no = /Załącznik nr (\d+)/.exec(text);
      if (no) annex = `zał. nr ${no[1]}`;
      for (const part of splitLong(text, 1800)) {
        push(
          doc,
          `${annex || 'załączniki'} do ${DOCS[doc].of} (${pageLabel(i + 1)})`,
          part,
          {
            unit: annex || 'załączniki',
            page: i + 1,
          },
        );
      }
    }
  }
}

// -------------------------------------------------------------- guides

function splitLong(text, max) {
  if (text.length <= max) return [text];
  const paras = text.split(/\n\s*\n/);
  const out = [];
  let cur = '';
  for (const p of paras) {
    if (cur && cur.length + p.length > max) {
      out.push(cur);
      cur = '';
    }
    cur += (cur ? '\n\n' : '') + p;
  }
  if (cur) out.push(cur);
  return out;
}

const HEADING = /^\s*(\d+(?:\.\d+){0,3})\.\s+(\p{Lu}[^\n]{3,90})$/u;

function ingestGuide(doc, { skipPages = [] } = {}) {
  const pages = pdfPages(P[doc]);
  let heading = '';
  pages.forEach((page, i) => {
    const no = i + 1;
    if (skipPages.includes(no)) return;
    const lines = clean(page);
    const firstHeading = heading;
    for (const l of lines) {
      const h = HEADING.exec(l);
      if (h && !/\d{4}/.test(h[2]) && l.trim().length < 100) {
        heading = `rozdz. ${h[1]} „${h[2].trim()}”`;
      }
    }
    const text = lines.join('\n');
    for (const part of splitLong(text, 1800)) {
      push(doc, `${DOCS[doc].of}, s. ${no}`, part, {
        page: no,
        section: firstHeading || heading || undefined,
      });
    }
  });
}

// ---------------------------------------------------------------- docx

function ingestDeadlines() {
  const xml = execFileSync(
    'unzip',
    ['-p', resolve(root, P.LT), 'word/document.xml'],
    {
      encoding: 'utf8',
    },
  );
  const paras = xml
    .split('</w:p>')
    .map((p) => p.replace(/<w:br[^>]*>/g, '\n').replace(/<[^>]+>/g, ''))
    .map((p) =>
      p
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/PRZYKŁAD:/g, '\nPRZYKŁAD: ')
        .trim(),
    )
    .filter(Boolean);
  let section = 'Terminy';
  let pkt = 0;
  for (const p of paras) {
    if (/^Nieobecności:?$/.test(p)) {
      section = 'Nieobecności';
      pkt = 0;
      continue;
    }
    if (/^Zasady obliczania terminów/.test(p)) continue;
    pkt += 1;
    push('LT', `${DOCS.LT.of}, „${section}” pkt ${pkt}`, `${section}: ${p}`, {
      section,
    });
  }
}

// ------------------------------------------------------------------ Q&A

const QA_ABBR = {
  '[U]': 'ustawa o służbie cywilnej',
  '[UW]': 'wyciąg z ustawy (nieaktualny)',
  '[RO]': 'rozporządzenie o ocenach okresowych 2016',
  '[RP]': 'rozporządzenie o pierwszej ocenie 2015',
  '[PO]': 'poradnik o ocenach okresowych',
  '[PP]': 'poradnik o pierwszej ocenie',
  '[LT]': 'zasady liczenia terminów',
  '[SZ]': 'standardy ZZL',
};

function ingestQa() {
  const md = readFileSync(resolve(root, P.QA), 'utf8');
  const blocks = md.split(/\n(?=\*\*\d+\. \[)/).slice(1);
  for (const block of blocks) {
    const head = /^\*\*(\d+)\. \[([A-Z])\] (.+?)\*\*\n/.exec(block);
    if (!head) continue;
    const body = block
      .slice(head[0].length)
      .split(/\n## /)[0]
      .replace(/\*\*/g, '')
      .trim();
    const [answer, source = ''] = body.split(/\nŹródło: /);
    const expanded = source
      .split('\n')[0]
      .replace(/\[[A-Z]+\]/g, (abbr) => `${QA_ABBR[abbr] ?? abbr}:`);
    push(
      'QA',
      `${DOCS.QA.of}, pyt. ${head[1]}`,
      `Pytanie: ${head[3]}\nOdpowiedź: ${answer.trim()}\nŹródło: ${expanded}`,
      {
        qa: {
          no: Number(head[1]),
          type: head[2],
          question: head[3],
          source: source.split('\n')[0],
        },
      },
    );
  }
}

// ----------------------------------------------------------------- run

ingestAct('U', {
  unitRe: /^\s*Art\. (\d+[a-z]*)\.\s/,
  unitLabel: 'art.',
  pageLabel: (p) => `s. ${p}/71`,
  marginCol: 84,
});
ingestAct('RO', {
  unitRe: /^[a-z\s]{0,8}§ (\d+[a-z]*)\.\s/,
  unitLabel: '§',
  pageLabel: (p) => `Dz.U. s. ${p}`,
  annexRe: /Załączniki do rozporządzenia Prezesa Rady Ministrów/,
});
ingestAct('RP', {
  unitRe: /^[a-z\s]{0,8}§ (\d+[a-z]*)\.\s/,
  unitLabel: '§',
  pageLabel: (p) => `Dz.U. s. ${p}`,
  annexRe: /^\s*Załączniki\s*$/,
});
ingestGuide('PO', { skipPages: [1, 2] });
ingestGuide('PP', { skipPages: [1, 2] });
ingestDeadlines();
ingestQa();

const counts = Object.fromEntries(
  Object.keys(DOCS).map((d) => [d, chunks.filter((c) => c.doc === d).length]),
);
const out = `// GENERATED by scripts/build-knowledge-base.mjs from the source documents.
// Do not edit by hand; re-run the script instead. Texts are verbatim extracts.
/* oxlint-disable */
import type { KnowledgeChunk } from '../knowledge.types.js';

export const KNOWLEDGE_CHUNKS: KnowledgeChunk[] = [
${chunks.map((c) => `  ${JSON.stringify(c)},`).join('\n')}
];
`;
writeFileSync(target, out);
console.log(`Wrote ${chunks.length} chunks to ${target}`, counts);
