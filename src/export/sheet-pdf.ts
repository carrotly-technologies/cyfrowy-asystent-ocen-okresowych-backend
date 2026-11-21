import type { Content, TableCell } from 'pdfmake';
import type { TDocumentDefinitions } from './pdf-renderer.js';
import { PERIODIC_BANDS } from '../assessments/evaluate.rules.js';
import type { CaseDetail } from '../cases/case.types.js';
import { formatDatePl } from '../cases/dates.js';
import {
  CRITERIA_CATALOGUE,
  criterionName,
} from '../criteria/data/criteria.data.js';
import { SHEETS } from '../sheets/sheets.data.js';

/**
 * Sheet A, B or C (załączniki nr 2–4 rozp. PRM z 4.04.2016) as a pdfmake
 * document: every field of the official template, in order, filled from the
 * case. The fixed wording comes from src/sheets/sheets.data.ts, so a change
 * of the template is a change of data, not of this layout.
 */

const ESIGN = '/podpisano elektronicznie/';
const DOTS = '…………………………';
const SPACED = (word: string) => word.split('').join(' ');

const d = (iso: string | null | undefined) => (iso ? formatDatePl(iso) : '');
const x = (on: boolean) => ({
  text: on ? 'X' : '',
  alignment: 'center' as const,
  bold: true,
});
const label = (text: string): TableCell => ({ text, style: 'label' });
const group = (text: string, colSpan: number): TableCell => ({
  text,
  style: 'group',
  colSpan,
});
const filler = (n: number): TableCell[] =>
  Array.from({ length: n - 1 }, () => ({ text: '' }));

function signatures(cells: { value: string; caption: string }[]): Content {
  return {
    margin: [0, 10, 0, 4],
    columns: cells.map((c) => ({
      stack: [
        { text: c.value || ' ', alignment: 'center', fontSize: 9 },
        { text: DOTS, alignment: 'center', color: '#666' },
        { text: c.caption, alignment: 'center', fontSize: 7, italics: true },
      ],
    })),
  };
}

function ptsWord(n: number): string {
  return n === 1 ? 'punkt' : n < 5 ? 'punkty' : 'punktów';
}

/** Filename `ocena-<nazwisko>-<data>.pdf` (ASCII, for every browser and OS). */
export function sheetPdfFilename(detail: CaseDetail, today: string): string {
  const ascii = detail.person.lastName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .toLowerCase();
  const date = detail.signedByEvaluatorOn ?? today;
  return `ocena-${ascii}-${date}.pdf`;
}

export function sheetDocument(detail: CaseDetail): TDocumentDefinitions {
  const sheet = SHEETS.find((s) => s.id === (detail.sheetId ?? 'C'))!;
  const t = sheet.template;
  const p = detail.person;
  const e = detail.evaluator;
  const isA = sheet.id === 'A';
  const place = detail.office.city;
  const extra = detail.partI.additionalCriteria;
  const ev = detail.evaluation;
  const request = detail.promotionRequest;
  const urzednik = p.employment === 'URZEDNIK';
  const prev = detail.previousAssessment;
  const scaleHead = sheet.scale.map(
    (pts) =>
      CRITERIA_CATALOGUE.scale.find((s) => s.points === pts)?.label ?? '',
  );

  // ---- Part I ----
  const personRows: TableCell[][] = [
    [label('NAZWA URZĘDU'), { text: detail.office.name }],
    [group('DANE OCENIANEGO', 2), ''],
    [label('Imię'), p.firstName],
    [label('Nazwisko'), p.lastName],
    // Sheet A (kierownik urzędu) has no „Komórka organizacyjna”.
    ...(isA ? [] : [[label('Komórka organizacyjna'), p.unit]]),
    [label('Stanowisko pracy'), p.position],
    [group('DANE OCENIAJĄCEGO', 2), ''],
    [label('Imię'), e.firstName],
    [label('Nazwisko'), e.lastName],
    ...(isA ? [] : [[label('Komórka organizacyjna'), e.unit]]),
    [label(isA ? 'Stanowisko' : 'Stanowisko pracy'), e.position],
  ];

  const mandatory = sheet.mandatoryCriteria;
  const criteriaRows: TableCell[][] = mandatory.map((c, i) => {
    if (i < 3) {
      return [
        c ? criterionName(c) : '',
        { text: extra[i] ? criterionName(extra[i]) : '', colSpan: 2 },
        '',
      ];
    }
    if (i === 3) {
      return [
        criterionName(c),
        {
          text: 'Termin sporządzenia oceny (dd.mm.rrrr)',
          style: 'label',
          rowSpan: mandatory.length - 3,
        },
        {
          text: d(detail.partI.assessmentDue),
          rowSpan: mandatory.length - 3,
          alignment: 'center',
        },
      ];
    }
    return [criterionName(c), '', ''];
  });

  const partI: Content[] = [
    { text: t.annex, alignment: 'right', fontSize: 8, italics: true },
    { text: 'WZÓR', alignment: 'right', fontSize: 7, color: '#666' },
    { text: `ARKUSZ ${sheet.id}`, style: 'sheet' },
    { text: t.title, style: 'title' },
    { text: SPACED('CZĘŚĆ') + '   I', style: 'part' },
    {
      table: { widths: ['35%', '*'], body: personRows },
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        widths: ['40%', '*', '22%'],
        body: [
          [group('KRYTERIA OCENY I TERMIN SPORZĄDZENIA OCENY', 3), '', ''],
          [
            { text: 'Kryteria obowiązkowe', style: 'head' },
            {
              text: 'Kryteria dodatkowe wybrane przez oceniającego (nie więcej niż 3)',
              style: 'head',
              colSpan: 2,
            },
            '',
          ],
          ...criteriaRows,
        ],
      },
    },
    {
      margin: [0, 10, 0, 0],
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: 'Potwierdzamy', italics: true, margin: [0, 0, 0, 4] },
                ...t.partIConfirmation.map((line) => ({
                  text: `− ${line}`,
                  fontSize: 8.5,
                })),
                signatures([
                  {
                    value: detail.partI.confirmedByEvaluatorOn ? place : '',
                    caption: 'miejscowość',
                  },
                  {
                    value: d(detail.partI.confirmedByEvaluatorOn),
                    caption: 'data (dd.mm.rrrr)',
                  },
                  {
                    value: detail.partI.confirmedByEvaluatorOn
                      ? `${e.firstName} ${e.lastName} ${ESIGN}`
                      : '',
                    caption: 'podpis oceniającego',
                  },
                ]),
                signatures([
                  {
                    value: detail.partI.acknowledgedByEmployeeOn ? place : '',
                    caption: 'miejscowość',
                  },
                  {
                    value: d(detail.partI.acknowledgedByEmployeeOn),
                    caption: 'data (dd.mm.rrrr)',
                  },
                  {
                    value: detail.partI.acknowledgedByEmployeeOn
                      ? `${p.firstName} ${p.lastName} ${ESIGN}`
                      : '',
                    caption: 'podpis ocenianego',
                  },
                ]),
              ],
            },
          ],
        ],
      },
    },
  ];

  // ---- Part II ----
  const scoreRow = (c: string): TableCell[] => [
    criterionName(c),
    ...sheet.scale.map((s) => x(detail.decisions[c] === s)),
  ];
  const awardRows: TableCell[][] = PERIODIC_BANDS.map((band, i) => {
    const levelLabel = (
      CRITERIA_CATALOGUE.scale.find((s) => s.points === band.points)?.label ??
      ''
    ).toLocaleLowerCase('pl-PL');
    const range =
      i === 0
        ? `od 1 punktu do ${band.max} punktów`
        : `powyżej ${PERIODIC_BANDS[i - 1].max} punktów do ${band.max} punktów`;
    return [
      x(!!ev && ev.level?.label.toLocaleLowerCase('pl-PL') === levelLabel),
      { text: range, alignment: 'center' },
      { text: levelLabel, alignment: 'center' },
    ];
  });

  const partII: Content[] = [
    { text: SPACED('CZĘŚĆ') + '   I I', style: 'part', pageBreak: 'before' },
    {
      table: {
        widths: ['40%', '*', '*'],
        body: [
          [
            label('DATA PRZEPROWADZENIA ROZMOWY OCENIAJĄCEJ (dd.mm.rrrr)'),
            { text: d(detail.assessmentTalkOn), colSpan: 2 },
            '',
          ],
          [
            label('OKRES, W KTÓRYM OCENIANY PODLEGAŁ OCENIE'),
            `OD: ${d(detail.partI.acknowledgedByEmployeeOn)}`,
            `DO: ${d(detail.signedByEvaluatorOn)}`,
          ],
        ],
      },
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        headerRows: 3,
        widths: ['*', ...sheet.scale.map(() => 52)],
        body: [
          [
            { text: 'KRYTERIA OBOWIĄZKOWE', style: 'head', rowSpan: 3 },
            {
              text: 'OCENA CZĄSTKOWA',
              style: 'head',
              colSpan: sheet.scale.length,
            },
            ...filler(sheet.scale.length),
          ],
          ['', ...scaleHead.map((h) => ({ text: h, style: 'small' }))],
          [
            '',
            ...sheet.scale.map((s) => ({
              text: `${s} ${ptsWord(s)}`,
              style: 'small',
            })),
          ],
          ...mandatory.map(scoreRow),
          [
            {
              text: 'KRYTERIA DODATKOWE WYBRANE PRZEZ OCENIAJĄCEGO',
              style: 'head',
            },
            {
              text: 'OCENA CZĄSTKOWA',
              style: 'head',
              colSpan: sheet.scale.length,
            },
            ...filler(sheet.scale.length),
          ],
          ...(extra.length
            ? extra.map(scoreRow)
            : [
                [
                  { text: 'brak', italics: true, color: '#666' },
                  ...sheet.scale.map(() => ''),
                ],
              ]),
        ],
      },
    },
    {
      text: [
        'Średnia arytmetyczna z ocen cząstkowych przyznanych za poszczególne kryteria oceny: ',
        { text: ev ? ev.averageDisplay : '', bold: true },
      ],
      margin: [0, 8, 0, 8],
    },
    {
      table: {
        widths: ['20%', '*', '*'],
        body: [
          [group('PRZYZNANIE OCENY', 3), '', ''],
          [
            {
              text: 'Należy wstawić znak „X” w odpowiednie pole',
              style: 'small',
            },
            {
              text: 'Liczba punktów stanowiąca średnią arytmetyczną ze wszystkich ocen cząstkowych',
              style: 'small',
            },
            {
              text: 'Ogólny poziom spełnienia kryteriów oceny',
              style: 'small',
            },
          ],
          ...awardRows,
          [
            label('OCENA OKRESOWA W SŁUŻBIE CYWILNEJ'),
            {
              text: `POZYTYWNA   [ ${ev?.result === 'POSITIVE' ? 'X' : ' '} ]`,
              alignment: 'center',
            },
            {
              text: `NEGATYWNA   [ ${ev?.result === 'NEGATIVE' ? 'X' : ' '} ]`,
              alignment: 'center',
            },
          ],
        ],
      },
    },
    {
      text: 'UZASADNIENIE PRZYZNANEJ OCENY OKRESOWEJ',
      style: 'h',
      pageBreak: 'before',
    },
    {
      table: {
        widths: ['*'],
        body: [[{ text: detail.justification || ' ', margin: [2, 4, 2, 30] }]],
      },
    },
    {
      text: 'WNIOSKI DOTYCZĄCE INDYWIDUALNEGO PROGRAMU ROZWOJU ZAWODOWEGO',
      style: 'h',
    },
    {
      table: {
        widths: ['*'],
        body: [[{ text: detail.iprz || ' ', margin: [2, 4, 2, 30] }]],
      },
    },
    {
      margin: [0, 8, 0, 0],
      table: {
        widths: ['auto', '*', 'auto', '*', 'auto', '*'],
        body: [
          [
            group(
              'DANE DOTYCZĄCE POPRZEDNIEJ OCENY OKRESOWEJ URZĘDNIKA SŁUŻBY CYWILNEJ',
              6,
            ),
            ...filler(6),
          ],
          [
            label('Ocena'),
            urzednik
              ? prev?.result === 'POSITIVE'
                ? 'pozytywna'
                : prev?.result === 'NEGATIVE'
                  ? 'negatywna'
                  : ''
              : 'nie dotyczy',
            label('Poziom'),
            urzednik ? (prev?.level ?? '') : '',
            label('Data sporządzenia (dd.mm.rrrr)'),
            urzednik ? d(prev?.date) : '',
          ],
          [
            group(
              'CZY DO OCENY OKRESOWEJ DOŁĄCZONO WNIOSEK O PRZYZNANIE KOLEJNEGO STOPNIA SŁUŻBOWEGO?',
              6,
            ),
            ...filler(6),
          ],
          [
            {
              text: `TAK   [ ${request.attached === 'YES' ? 'X' : ' '} ]`,
              colSpan: 2,
            },
            '',
            {
              text: `NIE   [ ${request.attached === 'NO' ? 'X' : ' '} ]`,
              colSpan: 2,
            },
            '',
            {
              text: `NIE DOTYCZY (oceniany jest pracownikiem służby cywilnej)   [ ${request.attached === 'NOT_APPLICABLE' ? 'X' : ' '} ]`,
              colSpan: 2,
            },
            '',
          ],
          [group('DANE OCENIAJĄCEGO', 6), ...filler(6)],
          [label('Imię'), { text: e.firstName, colSpan: 5 }, ...filler(5)],
          [label('Nazwisko'), { text: e.lastName, colSpan: 5 }, ...filler(5)],
          ...(isA
            ? []
            : [
                [
                  label('Komórka organizacyjna'),
                  { text: e.unit, colSpan: 5 },
                  ...filler(5),
                ],
              ]),
          [
            label(isA ? 'Stanowisko' : 'Stanowisko pracy'),
            { text: e.position, colSpan: 5 },
            ...filler(5),
          ],
        ],
      },
    },
    signatures([
      {
        value: detail.signedByEvaluatorOn ? place : '',
        caption: 'miejscowość',
      },
      { value: d(detail.signedByEvaluatorOn), caption: 'data (dd.mm.rrrr)' },
      {
        value: detail.signedByEvaluatorOn ? ESIGN : '',
        caption: 'podpis oceniającego',
      },
    ]),
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: t.employeeAcknowledgement, italics: true },
                signatures([
                  {
                    value: detail.acknowledgedOn ? place : '',
                    caption: 'miejscowość',
                  },
                  {
                    value: d(detail.acknowledgedOn),
                    caption: 'data (dd.mm.rrrr)',
                  },
                  {
                    value: detail.acknowledgedOn
                      ? `${p.firstName} ${p.lastName}`
                      : '',
                    caption: 'imię i nazwisko lub pieczątka ocenianego',
                  },
                  {
                    value: detail.acknowledgedOn ? ESIGN : '',
                    caption: 'podpis ocenianego',
                  },
                ]),
              ],
            },
          ],
        ],
      },
    },
    {
      margin: [0, 8, 0, 0],
      stack: [
        { text: 'Pouczenie', italics: true, bold: true },
        {
          text: isA
            ? `${t.objectionNotice} ${detail.office.objectionRecipient ?? '…………………………………………………………'}`
            : t.objectionNotice,
        },
        ...(t.objectionNoticeNote
          ? [{ text: t.objectionNoticeNote, fontSize: 8, color: '#555' }]
          : []),
      ],
    },
  ];

  // ---- Part III: printed only with the request attached (footnote 16/17) ----
  const partIII: Content[] =
    request.attached === 'YES'
      ? [
          {
            text: SPACED('CZĘŚĆ') + '   I I I',
            style: 'part',
            pageBreak: 'before',
          },
          {
            text: t.partIIIApplicability,
            italics: true,
            alignment: 'center',
            margin: [0, 0, 0, 8],
          },
          {
            table: {
              widths: ['40%', '*'],
              body: [
                [group('DANE URZĘDNIKA SŁUŻBY CYWILNEJ', 2), ''],
                [label('Imię'), p.firstName],
                [label('Nazwisko'), p.lastName],
                [
                  label('Rok mianowania (rrrr)'),
                  String(request.appointedYear ?? ''),
                ],
                [
                  label('Posiadany stopień służbowy'),
                  request.currentGrade ?? '',
                ],
                [
                  label('Data przyznania stopnia służbowego (dd.mm.rrrr)'),
                  d(request.gradeGrantedOn),
                ],
              ],
            },
          },
          {
            text: 'WNIOSEK O PRZYZNANIE URZĘDNIKOWI SŁUŻBY CYWILNEJ KOLEJNEGO STOPNIA SŁUŻBOWEGO',
            style: 'h',
          },
          {
            text: [
              `${t.promotionRequest.beforeName} `,
              { text: `${p.firstName} ${p.lastName}`, bold: true },
              ` ${t.promotionRequest.afterName} `,
              { text: request.requestedGrade ?? '……….', bold: true },
              ` ${t.promotionRequest.afterGrade}`,
            ],
          },
          { text: 'Umotywowanie wniosku', style: 'h' },
          {
            table: {
              widths: ['*'],
              body: [
                [{ text: request.motivation || ' ', margin: [2, 4, 2, 30] }],
              ],
            },
          },
          signatures([
            {
              value: detail.signedByEvaluatorOn ? place : '',
              caption: 'miejscowość',
            },
            {
              value: d(detail.signedByEvaluatorOn),
              caption: 'data (dd.mm.rrrr)',
            },
            {
              value: detail.signedByEvaluatorOn
                ? `${e.firstName} ${e.lastName}`
                : '',
              caption: 'imię i nazwisko lub pieczątka oceniającego',
            },
            {
              value: detail.signedByEvaluatorOn ? ESIGN : '',
              caption: 'podpis oceniającego',
            },
          ]),
        ]
      : [];

  return {
    info: {
      title: `Arkusz ${sheet.id} oceny okresowej: ${p.firstName} ${p.lastName}`,
      creator: 'Cyfrowy Asystent Ocen Okresowych',
    },
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, lineHeight: 1.15 },
    footer: (page: number, pages: number) => ({
      margin: [40, 10, 40, 0],
      columns: [
        {
          text: `Wzór: ${t.annex.toLowerCase()} do rozp. PRM z 4.04.2016 (Dz.U. poz. 470)`,
          fontSize: 7,
          color: '#777',
        },
        {
          text: `${page} / ${pages}`,
          alignment: 'right',
          fontSize: 7,
          color: '#777',
        },
      ],
    }),
    styles: {
      sheet: {
        fontSize: 13,
        bold: true,
        alignment: 'center',
        margin: [0, 4, 0, 2],
      },
      title: {
        fontSize: 11,
        bold: true,
        alignment: 'center',
        margin: [0, 0, 0, 10],
      },
      part: {
        fontSize: 11,
        bold: true,
        alignment: 'center',
        margin: [0, 6, 0, 8],
      },
      group: { bold: true, fillColor: '#eeeeee', alignment: 'center' },
      head: { bold: true, alignment: 'center', fontSize: 8.5 },
      small: { fontSize: 7.5, alignment: 'center' },
      label: { fontSize: 8.5 },
      h: { bold: true, fontSize: 10, margin: [0, 10, 0, 4] },
    },
    content: [...partI, ...partII, ...partIII],
  };
}
