import { z } from 'zod';

z.config(z.locales.pl());

/** POST /api/admin/cases/:id/corrections. `value` is validated by correction.rules.ts. */
export const correctionSchema = z.object({
  field: z.string().min(1, { error: 'Wskaż pole do korekty.' }),
  value: z.unknown(),
  reason: z
    .string({ error: 'Podaj powód korekty.' })
    .max(2000, { error: 'Powód korekty może mieć najwyżej 2000 znaków.' }),
});
export type CorrectionBody = z.infer<typeof correctionSchema>;
