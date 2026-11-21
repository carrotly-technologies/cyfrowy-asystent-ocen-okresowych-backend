import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/roles.decorator.js';
import { CasesService } from '../cases/cases.service.js';
import { renderPdf } from './pdf-renderer.js';
import { sheetDocument, sheetPdfFilename } from './sheet-pdf.js';

@ApiTags('Oceny okresowe')
@ApiBearerAuth()
@ApiErrors(401, 403, 404)
@Controller('cases')
export class ExportController {
  constructor(private readonly cases: CasesService) {}

  /**
   * The sheet A/B/C of the case as PDF (server-side, pdfmake). Same access as
   * GET /api/cases/:id: the assessed person gets part II only after hand-over.
   */
  @Get(':id/sheet.pdf')
  @ApiParam({
    name: 'id',
    description: 'Identyfikator teczki oceny, np. `c-001`.',
  })
  @ApiOperation({
    summary: 'Arkusz oceny w PDF',
    description:
      'Arkusz A, B albo C wygenerowany na serwerze. Uprawnienia jak przy odczycie oceny.',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'Plik PDF (`ocena-<nazwisko>-<data>.pdf`).' })
  @Roles('SUPERVISOR', 'EMPLOYEE', 'HR')
  @Header('Content-Type', 'application/pdf')
  async sheetPdf(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const detail = await this.cases.view(id);
    const pdf = await renderPdf(sheetDocument(detail));
    const name = sheetPdfFilename(detail, this.cases.today);
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.end(pdf);
  }
}
