import type { FormalCheckItem } from './case.types.js';

/**
 * A domain rule refused the operation (illegal transition, locked part).
 * The service turns it into 409 Conflict with the Polish explanation.
 */
export class CaseRuleError extends Error {
  constructor(
    message: string,
    readonly formalCheck?: FormalCheckItem[],
  ) {
    super(message);
    this.name = 'CaseRuleError';
  }
}

/** Invalid values in a request (unknown criterion, points off the scale). 400. */
export class CaseValidationError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join(' '));
    this.name = 'CaseValidationError';
  }
}
