import { z } from 'zod';
import { isIsoDate } from '../cases/dates.js';

z.config(z.locales.pl());

const isoDate = z
  .string()
  .refine(isIsoDate, { error: 'Data musi mieć format RRRR-MM-DD.' });

/** Reasons the evaluator picks (art. 81 ust. 8 pkt 1–4 ustawy). */
export const SELECTABLE_REASONS = [
  'EVALUATOR_CHANGE',
  'EVALUEE_ABSENCE_EXPECTED',
  'EVALUATOR_ABSENCE_EXPECTED',
  'EVALUEE_REQUEST',
] as const;

export const dueDateChangeSchema = z.object({
  date: isoDate,
  reason: z.enum(SELECTABLE_REASONS, {
    error:
      'Wybierz przyczynę zmiany terminu z art. 81 ust. 8 ustawy (GET /api/deadlines/rules).',
  }),
  note: z.string().trim().max(2000).optional(),
});
export type DueDateChangeInput = z.infer<typeof dueDateChangeSchema>;

export const talkInvitationSchema = z.object({
  kind: z.enum(['OPENING', 'ASSESSMENT'], {
    error:
      'Rodzaj rozmowy: OPENING (rozpoczynająca) albo ASSESSMENT (oceniająca).',
  }),
  date: isoDate,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    error: 'Godzina musi mieć format GG:MM.',
  }),
  place: z.string().trim().min(1, { error: 'Podaj miejsce rozmowy.' }).max(200),
  note: z.string().trim().max(1000).optional(),
});
export type TalkInvitationInput = z.infer<typeof talkInvitationSchema>;

export const positionChangeSchema = z.object({
  date: isoDate,
});
export type PositionChangeInput = z.infer<typeof positionChangeSchema>;

export const evaluatorChangeSchema = z.object({
  evaluatorId: z.string().min(1),
});
export type EvaluatorChangeInput = z.infer<typeof evaluatorChangeSchema>;
