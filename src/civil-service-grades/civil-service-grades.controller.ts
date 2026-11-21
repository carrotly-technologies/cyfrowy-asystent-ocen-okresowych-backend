import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrors } from '../openapi/api-docs.decorators.js';
import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import {
  CIVIL_SERVICE_GRADES,
  type CivilServiceGrade,
  GRADES_LEGAL_BASIS,
} from './data/grades.data.js';

export interface CivilServiceGrades {
  grades: readonly CivilServiceGrade[];
  legalBasis: string;
}

/** Grades for part III of sheets A, B and C (the request for the next grade). */
@ApiTags('Słowniki')
@ApiBearerAuth()
@ApiErrors(401)
@Can.Anyone()
@Controller('civil-service-grades')
export class CivilServiceGradesController {
  @Get()
  @ApiOperation({
    summary: 'Stopnie służbowe',
    description:
      'Stopnie I–IX (art. 86 ust. 1 ustawy o służbie cywilnej) do części III arkusza.',
  })
  @ApiOkResponse({ description: '`{ grades, legalBasis }`.' })
  findAll(): CivilServiceGrades {
    return { grades: CIVIL_SERVICE_GRADES, legalBasis: GRADES_LEGAL_BASIS };
  }
}
