import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@nestjs/authentication';
import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok';
}

@ApiTags('System')
@Public()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Stan aplikacji',
    description: 'Do monitoringu i kontroli gotowości. Bez logowania.',
  })
  @ApiOkResponse({ description: '`{ status: "ok" }`.' })
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
