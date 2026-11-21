import { z } from 'zod';
import { GRADE_IDS } from '../civil-service-grades/data/grades.data.js';
import { SHEET_IDS } from '../sheets/sheet.types.js';
import { CASE_ACTIONS } from './case.types.js';
import { isIsoDate } from './dates.js';

// Zod's own messages in Polish (also set in assessments.schemas.ts).
z.config(z.locales.pl());

const isoDate = z
  .string()
  .refine(isIsoDate, { error: 'Data musi mieć format RRRR-MM-DD.' });

const grade = (what: string) =>
  z
    .enum(GRADE_IDS, {
      error: `${what} musi być jednym ze stopni służbowych: ${GRADE_IDS.join(', ')} (GET /api/civil-service-grades).`,
    })
    .nullable()
    .optional();

/** Longest motivation of the request in part III. */
const MOTIVATION_MAX = 4000;

/**
 * PATCH /cases/:id. Objects are merged one level deep (keys given replace
 * keys stored). In `decisions` and `deviationNotes` a null value removes the
 * key. Dates confirmed by actions (confirmedByEvaluatorOn,
 * acknowledgedByEmployeeOn) are set by actions only and ignored here.
 */
export const patchCaseSchema = z.object({
  sheetId: z
    .enum(SHEET_IDS, {
      error: 'sheetId musi mieć jedną z wartości: A, B, C.',
    })
    .optional(),
  partI: z
    .object({
      additionalCriteria: z.array(z.string().min(1)).optional(),
      assessmentDue: isoDate.nullable().optional(),
      topics: z
        .object({
          duties: z.string(),
          criteria: z.string(),
          expectations: z.string(),
          goals: z.string(),
        })
        .partial()
        .optional(),
      expectations: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  decisions: z.record(z.string(), z.number().nullable()).optional(),
  deviationNotes: z.record(z.string(), z.string().nullable()).optional(),
  justification: z.string().optional(),
  iprz: z.string().optional(),
  /** Data przeprowadzenia rozmowy oceniającej (default: the day the talk is confirmed). */
  assessmentTalkOn: isoDate.optional(),
  /** Okres, w którym oceniany podlegał ocenie; null resets a side to its default. */
  assessmentPeriod: z
    .object({ from: isoDate.nullable(), to: isoDate.nullable() })
    .partial()
    .optional(),
  /** Notatki robocze oceniającego: free text without legal effect, never on the sheet. */
  workingNotes: z
    .string()
    .max(MOTIVATION_MAX, {
      error: `Notatki robocze mogą mieć najwyżej ${MOTIVATION_MAX} znaków.`,
    })
    .optional(),
  /** Part II item 10 of the sheet; null clears it. */
  previousAssessment: z
    .object({
      result: z
        .enum(['POSITIVE', 'NEGATIVE'], {
          error:
            'Wynik poprzedniej oceny musi mieć wartość POSITIVE, NEGATIVE albo null.',
        })
        .nullable(),
      level: z.string().max(100).nullable(),
      date: isoDate.nullable(),
    })
    .partial()
    .nullable()
    .optional(),
  /** Part II item 11 and part III of the sheet. */
  promotionRequest: z
    .object({
      attached: z
        .enum(['YES', 'NO', 'NOT_APPLICABLE'], {
          error:
            'attached musi mieć jedną z wartości: YES, NO, NOT_APPLICABLE albo null.',
        })
        .nullable(),
      appointedYear: z
        .number({ error: 'Rok mianowania musi być liczbą (rrrr).' })
        .int({ error: 'Rok mianowania musi być liczbą całkowitą (rrrr).' })
        .min(1000, { error: 'Rok mianowania musi mieć 4 cyfry (rrrr).' })
        .max(9999, { error: 'Rok mianowania musi mieć 4 cyfry (rrrr).' })
        .nullable(),
      currentGrade: grade('Posiadany stopień służbowy'),
      gradeGrantedOn: isoDate.nullable(),
      requestedGrade: grade('Wnioskowany stopień służbowy'),
      motivation: z.string().max(MOTIVATION_MAX, {
        error: `Umotywowanie wniosku może mieć najwyżej ${MOTIVATION_MAX} znaków.`,
      }),
    })
    .partial()
    .optional(),
});
export type PatchCase = z.infer<typeof patchCaseSchema>;

export const observationSchema = z.object({
  date: isoDate,
  criterionId: z.string().min(1),
  kind: z.enum(['STRENGTH', 'DEVELOPMENT'], {
    error:
      'kind musi mieć wartość STRENGTH (mocna strona) albo DEVELOPMENT (do rozwoju).',
  }),
  situation: z.string().trim().min(1, { error: 'Opisz sytuację (S).' }),
  action: z.string().trim(),
  result: z.string().trim(),
});
export type ObservationInput = z.infer<typeof observationSchema>;

export const actionSchema = z.object({
  action: z.enum(CASE_ACTIONS, {
    error: `action musi mieć jedną z wartości: ${CASE_ACTIONS.join(', ')}.`,
  }),
});
export type ActionInput = z.infer<typeof actionSchema>;

export const remindersSchema = z.object({
  caseIds: z
    .array(z.string().min(1))
    .min(1, { error: 'Podaj co najmniej jedną sprawę.' }),
});
export type RemindersInput = z.infer<typeof remindersSchema>;
