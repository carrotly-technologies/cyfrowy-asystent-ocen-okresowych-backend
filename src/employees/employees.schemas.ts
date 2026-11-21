import { z } from 'zod';
import { isIsoDate } from '../cases/dates.js';
import { GRADE_IDS } from '../civil-service-grades/data/grades.data.js';
import { ABSENCE_TYPE_IDS } from './data/absence-types.data.js';

z.config(z.locales.pl());

const isoDate = (what: string) =>
  z
    .string({ error: `Podaj ${what}.` })
    .refine(isIsoDate, { error: `${what} musi mieć format RRRR-MM-DD.` });

const text = (what: string, max = 200) =>
  z
    .string({ error: `Podaj ${what}.` })
    .trim()
    .min(1, { error: `Pole „${what}” nie może być puste.` })
    .max(max, { error: `Pole „${what}” może mieć najwyżej ${max} znaków.` });

const employeeShape = {
  firstName: text('imię', 100),
  lastName: text('nazwisko', 100),
  unit: text('komórka organizacyjna'),
  position: text('stanowisko'),
  employment: z.enum(['URZEDNIK', 'PRACOWNIK'], {
    error: 'Wybierz: urzędnik służby cywilnej albo pracownik służby cywilnej.',
  }),
  officeHead: z.boolean({ error: 'Określ, czy to kierownik urzędu.' }),
  managesPeople: z.boolean({
    error: 'Określ, czy osoba kieruje pracownikami.',
  }),
  appointedYear: z
    .number({ error: 'Rok mianowania musi być liczbą.' })
    .int()
    .min(1990, { error: 'Rok mianowania musi być nie wcześniejszy niż 1990.' })
    .max(2100)
    .nullable(),
  grade: z
    .enum(GRADE_IDS, {
      error: `Stopień służbowy musi być jednym z: ${GRADE_IDS.join(', ')}.`,
    })
    .nullable(),
  gradeGrantedOn: isoDate('data przyznania stopnia').nullable(),
  indefiniteSince: isoDate('data zatrudnienia na czas nieokreślony').nullable(),
  evaluatorId: z.string().min(1).nullable(),
};

export const employeeSchema = z.object(employeeShape);
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const employeePatchSchema = z.object(employeeShape).partial();
export type EmployeePatch = z.infer<typeof employeePatchSchema>;

export const absenceSchema = z.object({
  type: z.enum(ABSENCE_TYPE_IDS, { error: 'Wybierz rodzaj nieobecności.' }),
  from: isoDate('data początku'),
  to: isoDate('data końca'),
  justified: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
});
export type AbsenceInput = z.infer<typeof absenceSchema>;

export const substitutionSchema = z.object({
  evaluatorId: z
    .string({ error: 'Wybierz zastępowanego oceniającego.' })
    .min(1),
  substituteId: z.string({ error: 'Wybierz osobę zastępującą.' }).min(1),
  from: isoDate('data początku'),
  to: isoDate('data końca'),
  note: z.string().trim().max(500).optional(),
});
export type SubstitutionInput = z.infer<typeof substitutionSchema>;

/** CSV text the frontend read from the file (JSON body limit of Express: 100 kB). */
export const historyImportSchema = z.object({
  csv: z
    .string({ error: 'Wklej lub wybierz plik CSV.' })
    .min(1, { error: 'Plik CSV jest pusty.' })
    .max(90_000, {
      error: 'Plik CSV jest za duży (najwyżej 90 kB, ok. 1500 wierszy).',
    }),
});
export type HistoryImportInput = z.infer<typeof historyImportSchema>;

/** The HR register as CSV (docs/import/pracownicy-wzor.csv); dryRun = podgląd. */
export const employeesImportSchema = z.object({
  csv: historyImportSchema.shape.csv,
  dryRun: z
    .boolean({ error: 'dryRun musi mieć wartość true albo false.' })
    .optional(),
});
export type EmployeesImportInput = z.infer<typeof employeesImportSchema>;
