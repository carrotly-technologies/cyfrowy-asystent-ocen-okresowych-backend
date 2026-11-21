import { findCriterion } from '../criteria/data/criteria.data.js';
import type { ObservationFields } from './journal.types.js';

/**
 * Checks of an observation against the criteria catalogue and "today"
 * (DEMO_TODAY). Returns Polish messages; empty = valid. Unlike a case
 * observation, any criterion of the catalogue is allowed: the journal is kept
 * before the case's criteria are chosen.
 */
export function observationErrors(
  input: ObservationFields,
  today: string,
): string[] {
  const errors: string[] = [];
  if (!findCriterion(input.criterionId)) {
    errors.push(
      `Kryterium „${input.criterionId}” nie istnieje w wykazie kryteriów oceny.`,
    );
  }
  if (input.date > today)
    errors.push('Data obserwacji nie może być z przyszłości.');
  return errors;
}
