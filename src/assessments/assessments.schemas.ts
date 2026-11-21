import { z } from 'zod';
import { SHEET_IDS } from '../sheets/sheet.types.js';

// Zod's own messages (wrong type, missing field, ...) in Polish.
z.config(z.locales.pl());

const sheetId = z.enum(SHEET_IDS, {
  error: 'sheetId musi mieć jedną z wartości: A, B, C.',
});

export const evaluateSchema = z.object({
  sheetId,
  scores: z.array(
    z.object({
      criterionId: z.string().min(1),
      points: z.number(),
    }),
  ),
});
export type EvaluateRequest = z.infer<typeof evaluateSchema>;
