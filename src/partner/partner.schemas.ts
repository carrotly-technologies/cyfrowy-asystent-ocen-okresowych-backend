import { z } from 'zod';
import {
  PULSE_COMMENT_MAX,
  PULSE_MAX,
  PULSE_MIN,
  PULSE_QUESTION_IDS,
} from './data/pulse.data.js';

z.config(z.locales.pl());

const answer = z
  .number({ error: `Odpowiedz w skali ${PULSE_MIN}–${PULSE_MAX}.` })
  .int({ error: `Odpowiedz w skali ${PULSE_MIN}–${PULSE_MAX}.` })
  .min(PULSE_MIN, { error: `Odpowiedz w skali ${PULSE_MIN}–${PULSE_MAX}.` })
  .max(PULSE_MAX, { error: `Odpowiedz w skali ${PULSE_MIN}–${PULSE_MAX}.` });

export const pulseSubmitSchema = z.object({
  answers: z.object(
    Object.fromEntries(PULSE_QUESTION_IDS.map((q) => [q, answer])) as Record<
      (typeof PULSE_QUESTION_IDS)[number],
      typeof answer
    >,
    { error: 'Odpowiedz na wszystkie pytania.' },
  ),
  comment: z
    .string()
    .trim()
    .max(PULSE_COMMENT_MAX, {
      error: `Komentarz może mieć najwyżej ${PULSE_COMMENT_MAX} znaków.`,
    })
    .nullable()
    .optional()
    .transform((c) => (c ? c : null)),
  shareComment: z.boolean().optional().default(false),
});
export type PulseSubmitInput = z.infer<typeof pulseSubmitSchema>;

export const pulseShareSchema = z.object({
  shareComment: z.boolean({ error: 'Podaj shareComment: true albo false.' }),
});
export type PulseShareInput = z.infer<typeof pulseShareSchema>;

export const partnerAskSchema = z.object({
  question: z
    .string({ error: 'Wpisz pytanie.' })
    .trim()
    .min(3, { error: 'Pytanie jest za krótkie.' })
    .max(2000, { error: 'Pytanie może mieć najwyżej 2000 znaków.' }),
  personId: z.string().min(1).optional(),
  caseId: z.string().min(1).optional(),
});
export type PartnerAskInput = z.infer<typeof partnerAskSchema>;
