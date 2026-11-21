import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Features, readFeatures } from './features.js';
import { type OfficeConfig, readOffice } from './office.js';

export interface AppConfigResponse {
  features: Features;
  /** The office printed on the sheets (env OFFICE_*). */
  office: OfficeConfig;
}

@ApiTags('System')
@Public()
@Controller('config')
export class AppConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Konfiguracja aplikacji',
    description: 'Włączone funkcje (np. asystent AI). Bez logowania.',
  })
  @ApiOkResponse({ description: '`{ features }`.' })
  get(): AppConfigResponse {
    return {
      features: readFeatures(this.config),
      office: readOffice(this.config),
    };
  }
}
