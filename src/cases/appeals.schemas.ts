import { z } from 'zod';
import { isIsoDate } from './dates.js';

z.config(z.locales.pl());

const isoDate = z
  .string()
  .refine(isIsoDate, { error: 'Data musi mieć format RRRR-MM-DD.' });

/** Longest free text of a reason, objection or request. */
const TEXT_MAX = 4000;
const text = (what: string) =>
  z
    .string({ error: `Podaj ${what}.` })
    .trim()
    .min(1, { error: `Podaj ${what}.` })
    .max(TEXT_MAX, { error: `Pole może mieć najwyżej ${TEXT_MAX} znaków.` });

export const ackFictionSchema = z.object({
  date: isoDate,
  reason: text(
    'powód (np. odmowa podpisu, nieobecność, ocena doręczona pocztą)',
  ),
});
export type AckFictionInput = z.infer<typeof ackFictionSchema>;

export const objectionSchema = z.object({
  text: text('treść sprzeciwu'),
});
export type ObjectionInput = z.infer<typeof objectionSchema>;

export const objectionDecisionSchema = z.object({
  outcome: z.enum(['DISMISS', 'CHANGE', 'REDO'], {
    error:
      'outcome musi mieć wartość DISMISS (oddalenie), CHANGE (zmiana oceny) albo REDO (ponowne sporządzenie).',
  }),
  reason: text('uzasadnienie rozstrzygnięcia'),
  decisions: z.record(z.string(), z.number()).optional(),
  justification: z.string().max(TEXT_MAX).optional(),
  /** Data rozstrzygnięcia (between the filing and today); default: today. */
  decidedOn: isoDate.optional(),
  /** Data doręczenia rozstrzygnięcia (art. 83 ust. 5); default: the decision date. */
  deliveredOn: isoDate.optional(),
});
export type ObjectionDecisionBody = z.infer<typeof objectionDecisionSchema>;

export const dueDateRequestSchema = z.object({
  reason: text('uzasadnienie wniosku'),
  proposedDate: isoDate.nullable().optional(),
});
export type DueDateRequestInput = z.infer<typeof dueDateRequestSchema>;

export const dueDateDecisionSchema = z.object({
  approve: z.boolean({ error: 'approve musi mieć wartość true albo false.' }),
  newDate: isoDate.nullable().optional(),
  note: z.string().trim().max(TEXT_MAX).nullable().optional(),
});
export type DueDateDecisionInput = z.infer<typeof dueDateDecisionSchema>;

export const courtTermQuerySchema = z.object({ deliveredOn: isoDate });
export type CourtTermQuery = z.infer<typeof courtTermQuerySchema>;
