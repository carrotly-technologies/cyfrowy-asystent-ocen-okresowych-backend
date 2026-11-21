import { z } from 'zod';
import { FIRST_STAGES, PERIODIC_STAGES } from '../cases/case.types.js';

export const STAGE_IDS = [...PERIODIC_STAGES, ...FIRST_STAGES] as const;

export const askSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  assistant: z.enum(['FORMAL', 'CONVERSATION']).default('FORMAL'),
  caseId: z.string().min(1).optional(),
  stageId: z.enum(STAGE_IDS).optional(),
});
export type AskInput = z.infer<typeof askSchema>;

export const suggestionsQuerySchema = z.enum(STAGE_IDS).optional();
