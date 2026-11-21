import type { Role } from './user.types.js';

/** Polish names of the roles, as written in case history. */
export const ROLE_LABELS: Record<Role, string> = {
  SUPERVISOR: 'oceniający',
  EMPLOYEE: 'oceniany',
  HR: 'kadry',
  ADMIN: 'administrator',
  DIRECTOR: 'dyrektor generalny urzędu',
};
