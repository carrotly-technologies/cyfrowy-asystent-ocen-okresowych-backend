import type { CaseRecord } from './case.types.js';

/**
 * Storage of the cases. CaseStore keeps the working set in memory and writes
 * every change through this repository, so with DATABASE_URL the cases and
 * their history survive a restart.
 */
export abstract class CaseRepository {
  abstract loadAll(): Promise<CaseRecord[]>;
  abstract save(record: CaseRecord): Promise<void>;
  abstract isEmpty(): Promise<boolean>;
  abstract replaceAll(records: CaseRecord[]): Promise<void>;
}
