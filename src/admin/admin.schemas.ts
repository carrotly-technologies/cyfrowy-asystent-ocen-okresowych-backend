import { z } from 'zod';
import { ROLES } from '../auth/user.types.js';

export const updateUserSchema = z.object({
  role: z.enum(ROLES, {
    error: `Rola musi być jedną z: ${ROLES.join(', ')}.`,
  }),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const createAccountSchema = z.object({
  personId: z
    .string({ error: 'Podaj identyfikator pracownika z kartoteki.' })
    .trim()
    .min(1, 'Podaj identyfikator pracownika z kartoteki.'),
  login: z
    .string({ error: 'Podaj login.' })
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9._-]{2,39}$/,
      'Login: 3–40 znaków, małe litery bez polskich znaków, cyfry, kropka, myślnik lub podkreślenie.',
    ),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
