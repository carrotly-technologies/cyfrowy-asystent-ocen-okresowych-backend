import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_OFFICE_CITY,
  DEFAULT_OFFICE_NAME,
  readOffice,
} from './office.js';

const config = (env: Record<string, string>) => new ConfigService(env);

describe('readOffice', () => {
  it('falls back to the demo office', () => {
    expect(readOffice(config({}))).toEqual({
      name: DEFAULT_OFFICE_NAME,
      city: DEFAULT_OFFICE_CITY,
      logoUrl: null,
      objectionRecipient: null,
    });
  });

  it('reads and trims the env values; blank values are unset', () => {
    expect(
      readOffice(
        config({
          OFFICE_NAME: ' Urząd Wojewódzki w Lublinie ',
          OFFICE_CITY: 'Lublin',
          OFFICE_LOGO_URL: '  ',
          OBJECTION_RECIPIENT_A: 'Prezesa Rady Ministrów',
        }),
      ),
    ).toEqual({
      name: 'Urząd Wojewódzki w Lublinie',
      city: 'Lublin',
      logoUrl: null,
      objectionRecipient: 'Prezesa Rady Ministrów',
    });
  });
});
