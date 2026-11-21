import type { PulseQuestionId } from './data/pulse.data.js';

export type PulseAnswers = Record<PulseQuestionId, number>;

/** One pulse check-in of an employee (`Person.id`). */
export interface PulseResponse {
  id: string;
  personId: string;
  /** YYYY-MM-DD, the day it was filled. */
  date: string;
  answers: PulseAnswers;
  /** Optional free text; visible to the supervisor only when shared. */
  comment: string | null;
  shareComment: boolean;
  /** ISO 8601 (UTC). */
  createdAt: string;
}

/** What a supervisor gets: no comment unless the employee shared it. */
export interface PulsePoint {
  id: string;
  date: string;
  answers: PulseAnswers;
  /** Average of the answers, 1–5, rounded to 0.1. */
  index: number;
  sharedComment: string | null;
  /** True when there is a comment the employee did not share. */
  hasPrivateComment: boolean;
}
