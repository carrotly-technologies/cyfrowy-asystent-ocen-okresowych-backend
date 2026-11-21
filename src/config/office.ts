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
  /** Sheet A only: whom the objection goes to (art. 83 ust. 1 ustawy). */
  objectionRecipient: string | null;
}

export const DEFAULT_OFFICE_NAME = 'Urząd demonstracyjny (dane fikcyjne)';
export const DEFAULT_OFFICE_CITY = 'Warszawa';

const text = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Reads OFFICE_NAME, OFFICE_CITY, OFFICE_LOGO_URL, OBJECTION_RECIPIENT_A. */
export function readOffice(config: ConfigService): OfficeConfig {
  return {
    name: text(config.get<string>('OFFICE_NAME')) ?? DEFAULT_OFFICE_NAME,
    city: text(config.get<string>('OFFICE_CITY')) ?? DEFAULT_OFFICE_CITY,
    logoUrl: text(config.get<string>('OFFICE_LOGO_URL')),
    objectionRecipient: text(config.get<string>('OBJECTION_RECIPIENT_A')),
  };
}
