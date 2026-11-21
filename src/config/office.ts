import type { ConfigService } from '@nestjs/config';

/**
 * The office (urząd) the deployment serves, printed on sheets A/B/C: „NAZWA
 * URZĘDU”, „miejscowość” at the signatures, the optional logo and the
 * addressee of the objection in the „Pouczenie” of sheet A (załącznik nr 2
 * leaves „sprzeciw do: …” blank). Set per urząd through env, no code change.
 */
export interface OfficeConfig {
  name: string;
  city: string;
  logoUrl: string | null;
  /** Sheet A only: whom the objection goes to (art. 83 ust. 2 ustawy). */
  objectionRecipient: string | null;
  /**
   * false: the office has no dyrektor generalny, so objections against
   * sheets B/C go to the kierownik urzędu (footnote 17 of sheets B and C).
   */
  hasDirectorGeneral: boolean;
}

export const DEFAULT_OFFICE_NAME = 'Urząd demonstracyjny (dane fikcyjne)';
export const DEFAULT_OFFICE_CITY = 'Warszawa';

const text = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * Reads OFFICE_NAME, OFFICE_CITY, OFFICE_LOGO_URL, OBJECTION_RECIPIENT_A,
 * OFFICE_HAS_DIRECTOR_GENERAL (default true; "false"/"0"/"nie" = no DG).
 */
export function readOffice(config: ConfigService): OfficeConfig {
  return {
    name: text(config.get<string>('OFFICE_NAME')) ?? DEFAULT_OFFICE_NAME,
    city: text(config.get<string>('OFFICE_CITY')) ?? DEFAULT_OFFICE_CITY,
    logoUrl: text(config.get<string>('OFFICE_LOGO_URL')),
    objectionRecipient: text(config.get<string>('OBJECTION_RECIPIENT_A')),
    hasDirectorGeneral: !['false', '0', 'nie', 'no'].includes(
      (
        text(config.get<string>('OFFICE_HAS_DIRECTOR_GENERAL')) ?? ''
      ).toLowerCase(),
    ),
  };
}
