import { Policy } from '@nestjs/authorization';
import { ACTION_ACTOR } from '../cases/actions.rules.js';
import type { CaseAction, CaseRecord } from '../cases/case.types.js';
import type { User } from './user.types.js';

/** Record checks for assessment cases, called from CasesService. */
@Policy()
export class CasePolicy {
  /**
   * HR reads every case (statuses, deadlines); a supervisor reads the cases
   * they evaluate; the assessed person (EMPLOYEE) reads only their own.
   */
  view(user: User | null, record: CaseRecord): boolean {
    if (user?.role === 'HR') return true;
    if (isDirectorFor(user, record)) return true;
    return isEvaluatorOf(user, record) || isAssessedIn(user, record);
  }

  /** Only the case's evaluator edits it (PATCH, observations). */
  edit(user: User | null, record: CaseRecord): boolean {
    return isEvaluatorOf(user, record);
  }

  /**
   * Workflow actions: the evaluator's actions by the evaluator, the assessed
   * person's confirmations (EMPLOYEE_ACK_*) by that person only.
   */
  act(user: User | null, record: CaseRecord, action: CaseAction): boolean {
    return ACTION_ACTOR[action] === 'EMPLOYEE'
      ? isAssessedIn(user, record)
      : isEvaluatorOf(user, record);
  }
}

export function isEvaluatorOf(user: User | null, record: CaseRecord): boolean {
  return (
    user?.role === 'SUPERVISOR' &&
    !!user.evaluatorId &&
    record.evaluatorId === user.evaluatorId
  );
}

export function isAssessedIn(user: User | null, record: CaseRecord): boolean {
  return (
    user?.role === 'EMPLOYEE' &&
    !!user.personId &&
    record.person.id === user.personId
  );
}

/**
 * The dyrektor generalny reads the cases with an objection (sprzeciw) filed,
 * since he decides them (art. 83 ust. 1 ustawy), and signed assessments with
 * a request for the next stopień służbowy (art. 89 ust. 1).
 */
export function isDirectorFor(user: User | null, record: CaseRecord): boolean {
  if (user?.role !== 'DIRECTOR') return false;
  if ((record.objections ?? []).length > 0) return true;
  return (
    !!record.signedByEvaluatorOn && record.promotionRequest?.attached === 'YES'
  );
}
