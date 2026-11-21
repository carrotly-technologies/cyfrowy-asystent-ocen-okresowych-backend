import { z } from 'zod';
import { SHEET_IDS } from '../sheets/sheet.types.js';
import { STAGES } from './case.types.js';

/**
 * Version of the export format of GET /api/cases/:id/export. Bump the minor
 * part for added fields (backward compatible), the major part for removed or
 * renamed ones; an EZD integration reads `schemaVersion` first.
 */
export const CASE_EXPORT_SCHEMA_VERSION = '1.0';

/** Name of the format, so a receiving system can tell it from other JSON. */
export const CASE_EXPORT_FORMAT = 'caoo.ocena-okresowa';

export const caseExportQuerySchema = z
  .enum(['json'], { error: 'Obsługiwany format eksportu: json.' })
  .default('json')
  .meta({ description: 'Format eksportu. Obecnie tylko `json`.' });
export type CaseExportFormat = z.infer<typeof caseExportQuerySchema>;

const date = (description: string) =>
  z
    .string()
    .nullable()
    .meta({ description: `${description} (RRRR-MM-DD).` });

const criterion = z.object({
  id: z
    .string()
    .meta({ description: 'Identyfikator kryterium (GET /api/criteria).' }),
  number: z.number().nullable().meta({
    description: 'Numer kryterium w załączniku nr 1 do rozporządzenia (1–14).',
  }),
  name: z.string().meta({ description: 'Nazwa kryterium.' }),
  mandatory: z.boolean().meta({
    description:
      'true: kryterium obowiązkowe arkusza; false: dodatkowe, wybrane w części I.',
  }),
});

const deadline = z
  .object({
    date: date('Termin'),
    label: z.string().meta({ description: 'Opis terminu.' }),
    legalBasis: z.string().meta({ description: 'Podstawa prawna terminu.' }),
  })
  .nullable();

export const caseExportSchema = z
  .object({
    schemaVersion: z.literal(CASE_EXPORT_SCHEMA_VERSION).meta({
      description:
        'Wersja formatu eksportu. Zmiana części głównej oznacza zmianę niezgodną wstecz.',
    }),
    format: z
      .literal(CASE_EXPORT_FORMAT)
      .meta({ description: 'Nazwa formatu.' }),
    exportedAt: z
      .string()
      .meta({ description: 'Chwila eksportu (ISO 8601, UTC).' }),
    case: z
      .object({
        id: z.string().meta({ description: 'Identyfikator teczki oceny.' }),
        cycleLabel: z.string().meta({ description: 'Opis cyklu oceny.' }),
        status: z
          .enum(['W_TOKU', 'DO_ZAPOZNANIA', 'OKRES_SPRZECIWU', 'ZAKONCZONA'])
          .meta({ description: 'Status oceny.' }),
        currentStage: z
          .enum(STAGES)
          .meta({ description: 'Bieżący etap oceny.' }),
      })
      .meta({ description: 'Teczka oceny.' }),
    office: z
      .object({ name: z.string().meta({ description: 'Nazwa urzędu.' }) })
      .meta({ description: 'Urząd.' }),
    sheet: z
      .object({
        id: z.enum(SHEET_IDS).meta({ description: 'Arkusz A, B albo C.' }),
        name: z.string().meta({ description: 'Nazwa arkusza.' }),
        annex: z
          .string()
          .meta({ description: 'Załącznik rozporządzenia z wzorem arkusza.' }),
        legalBasis: z
          .string()
          .meta({ description: 'Podstawa prawna arkusza.' }),
      })
      .nullable()
      .meta({
        description: 'Arkusz oceny; null, dopóki oceniający go nie wybrał.',
      }),
    assessed: z
      .object({
        id: z
          .string()
          .meta({ description: 'Identyfikator ocenianego w systemie.' }),
        firstName: z.string().meta({ description: 'Imię.' }),
        lastName: z.string().meta({ description: 'Nazwisko.' }),
        position: z.string().meta({ description: 'Stanowisko.' }),
        unit: z.string().meta({ description: 'Komórka organizacyjna.' }),
        employment: z.enum(['URZEDNIK', 'PRACOWNIK']).meta({
          description:
            'URZEDNIK: urzędnik służby cywilnej; PRACOWNIK: pracownik służby cywilnej.',
        }),
      })
      .meta({ description: 'Oceniany.' }),
    evaluator: z
      .object({
        firstName: z.string().meta({ description: 'Imię.' }),
        lastName: z.string().meta({ description: 'Nazwisko.' }),
        position: z.string().meta({ description: 'Stanowisko.' }),
        unit: z.string().meta({ description: 'Komórka organizacyjna.' }),
      })
      .meta({ description: 'Oceniający (bezpośredni przełożony).' }),
    partI: z
      .object({
        criteria: z.array(criterion).meta({
          description:
            'Kryteria oceny: obowiązkowe arkusza i dodatkowe (do 3).',
        }),
        assessmentDue: date('Termin sporządzenia oceny'),
        topics: z
          .object({
            duties: z
              .string()
              .meta({ description: 'Omówienie obowiązków na stanowisku.' }),
            criteria: z
              .string()
              .meta({ description: 'Omówienie kryteriów oceny.' }),
            expectations: z
              .string()
              .meta({ description: 'Omówienie oczekiwań.' }),
            goals: z.string().meta({ description: 'Omówienie celów.' }),
          })
          .meta({
            description:
              'Zagadnienia omówione w rozmowie rozpoczynającej (§ 5 rozp.).',
          }),
        expectations: z
          .array(
            z.object({
              criterionId: z
                .string()
                .meta({ description: 'Identyfikator kryterium.' }),
              text: z
                .string()
                .meta({ description: 'Oczekiwania wobec ocenianego.' }),
            }),
          )
          .meta({ description: 'Oczekiwania wobec ocenianego, wg kryteriów.' }),
        confirmedByEvaluatorOn: date(
          'Potwierdzenie części I przez oceniającego',
        ),
        acknowledgedByEmployeeOn: date(
          'Potwierdzenie części I przez ocenianego',
        ),
      })
      .meta({ description: 'Część I arkusza: rozmowa rozpoczynająca.' }),
    partII: z
      .object({
        previousAssessment: z
          .object({
            result: z.enum(['POSITIVE', 'NEGATIVE']).nullable().meta({
              description: 'Wynik poprzedniej oceny okresowej.',
            }),
            level: z
              .string()
              .nullable()
              .meta({ description: 'Poziom poprzedniej oceny.' }),
            date: date('Data poprzedniej oceny'),
          })
          .nullable()
          .meta({
            description:
              'Dane dotyczące poprzedniej oceny okresowej; null, gdy jej nie było.',
          }),
        assessmentTalkOn: date('Data rozmowy oceniającej'),
        scores: z
          .array(
            criterion.extend({
              points: z.number().nullable().meta({
                description:
                  'Ocena cząstkowa w skali 1, 3, 5, 7, 9; null przed oceną.',
              }),
              deviationNote: z.string().meta({
                description:
                  'Uzasadnienie oceny cząstkowej odbiegającej od oczekiwań (puste, gdy brak).',
              }),
            }),
          )
          .meta({ description: 'Oceny cząstkowe wg kryteriów.' }),
        evaluation: z
          .object({
            average: z
              .number()
              .meta({ description: 'Średnia ocen cząstkowych.' }),
            averageDisplay: z
              .string()
              .meta({ description: 'Średnia, jak na arkuszu.' }),
            level: z
              .object({ label: z.string(), range: z.string() })
              .nullable()
              .meta({ description: 'Poziom ogólny oceny.' }),
            result: z.enum(['POSITIVE', 'NEGATIVE']).meta({
              description: 'Ocena pozytywna albo negatywna.',
            }),
            reasons: z
              .array(z.string())
              .meta({ description: 'Uzasadnienie wyniku z podstawą prawną.' }),
          })
          .nullable()
          .meta({
            description:
              'Wynik oceny; null, dopóki nie ma wszystkich ocen cząstkowych.',
          }),
        justification: z.string().meta({ description: 'Uzasadnienie oceny.' }),
        iprz: z.string().meta({
          description:
            'Wnioski dotyczące indywidualnego programu rozwoju zawodowego.',
        }),
        signedByEvaluatorOn: date('Podpis oceniającego'),
        sentForAckOn: date('Przekazanie ocenianemu do zapoznania'),
        acknowledgedOn: date('Zapoznanie ocenianego z oceną'),
        objectionDeadline: deadline.meta({
          description:
            'Termin na sprzeciw (art. 83 ust. 1 ustawy); null, gdy nie biegnie.',
        }),
      })
      .meta({ description: 'Część II arkusza: ocena okresowa.' }),
    partIII: z
      .object({
        attached: z.enum(['YES', 'NO', 'NOT_APPLICABLE']).nullable().meta({
          description:
            'Czy do oceny dołączono wniosek o przyznanie kolejnego stopnia służbowego.',
        }),
        appointedYear: z.number().nullable().meta({
          description: 'Rok mianowania w służbie cywilnej.',
        }),
        currentGrade: z
          .string()
          .nullable()
          .meta({ description: 'Obecny stopień służbowy.' }),
        gradeGrantedOn: date('Data przyznania obecnego stopnia'),
        requestedGrade: z
          .string()
          .nullable()
          .meta({ description: 'Wnioskowany stopień służbowy.' }),
        motivation: z.string().meta({ description: 'Uzasadnienie wniosku.' }),
      })
      .meta({
        description:
          'Część III arkusza: wniosek o przyznanie kolejnego stopnia służbowego (art. 89 ust. 1 ustawy).',
      }),
  })
  .meta({
    id: 'EksportOcenyOkresowej',
    description:
      'Komplet pól arkusza oceny okresowej (A, B albo C) do przekazania do systemu EZD lub kadrowego.',
  });

export type CaseExport = z.infer<typeof caseExportSchema>;
