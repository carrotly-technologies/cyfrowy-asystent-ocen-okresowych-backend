import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { employeeKey, parseEmployeesCsv } from './employees-import.rules.js';

const TODAY = '2026-11-21';
const evaluator = (cell: string) =>
  cell === 'j.kaminska'
    ? { id: 'ev-kaminska' }
    : { error: `nie znaleziono oceniającego „${cell}”` };
const HEADER =
  'imię;nazwisko;komórka;stanowisko;kierownik urzędu;kieruje ludźmi;urzędnik mianowany;rok mianowania;stopień;data zatrudnienia na czas nieokreślony;oceniający';

describe('parseEmployeesCsv', () => {
  it('reads a row with Polish headers, flags, grade and dates', () => {
    const { rows, errors, fatal } = parseEmployeesCsv(
      `﻿${HEADER}\r\nJan;Kowalski;Wydział  A;Naczelnik;nie;tak;tak;2015;3 stopień;01.02.2010;j.kaminska\r\n`,
      evaluator,
      TODAY,
    );
    expect(fatal).toBeNull();
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        externalId: null,
        fields: {
          firstName: 'Jan',
          lastName: 'Kowalski',
          unit: 'Wydział A',
          position: 'Naczelnik',
          employment: 'URZEDNIK',
          officeHead: false,
          managesPeople: true,
          appointedYear: 2015,
          grade: 'III',
          gradeGrantedOn: null,
          indefiniteSince: '2010-02-01',
          evaluatorId: 'ev-kaminska',
        },
      },
    ]);
  });

  it('reports bad rows with the line and reason and keeps the good ones', () => {
    const csv = [
      HEADER,
      'Anna;Nowak;Wydział A;Referent;nie;nie;nie;;;2020-01-01;j.kaminska',
      ';Brak;Wydział A;Referent;może;nie;nie;2015;II;2030-01-01;nikt',
      'Ewa;Lis;Wydział A;Referent;nie;nie;nie;2015;;;',
    ].join('\n');
    const { rows, errors } = parseEmployeesCsv(csv, evaluator, TODAY);
    expect(rows.map((r) => r.line)).toEqual([2]);
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
    expect(errors[0].message).toMatch(/^Wiersz 3: brak pola „imię”/);
    expect(errors[0].message).toContain(
      '„kierownik urzędu”: wpisz tak albo nie',
    );
    expect(errors[0].message).toContain('nie może być z przyszłości');
    expect(errors[0].message).toContain('nie znaleziono oceniającego „nikt”');
    expect(errors[1].message).toContain('tylko urzędnikowi mianowanemu');
  });

  it('refuses a file without the required columns or rows', () => {
    expect(
      parseEmployeesCsv('imie;nazwisko\nJan;Nowak', evaluator, TODAY).fatal,
    ).toContain('brak kolumn komorka, stanowisko');
    expect(parseEmployeesCsv(HEADER, evaluator, TODAY).fatal).toContain(
      'żadnych pracowników',
    );
    expect(parseEmployeesCsv('  \n', evaluator, TODAY).fatal).toBe(
      'Plik CSV jest pusty.',
    );
  });

  it('keeps the identyfikator and accepts column aliases', () => {
    const { rows } = parseEmployeesCsv(
      'identyfikator kadrowy;imie;nazwisko;komórka organizacyjna;stanowisko\nKAD-1;Jan;Nowak;W;Referent',
      evaluator,
      TODAY,
    );
    expect(rows[0].externalId).toBe('KAD-1');
    expect(rows[0].fields).toMatchObject({
      unit: 'W',
      employment: 'PRACOWNIK',
      evaluatorId: null,
    });
  });

  it('parses the 25 rows of the sample file without errors', () => {
    const csv = readFileSync(
      resolve(import.meta.dirname, '../../docs/import/pracownicy-wzor.csv'),
      'utf8',
    );
    const { rows, errors } = parseEmployeesCsv(
      csv,
      () => ({ id: 'ev-x' }),
      TODAY,
    );
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(25);
    expect(rows.filter((r) => r.fields.officeHead)).toHaveLength(1);
  });
});

describe('employeeKey', () => {
  it('ignores case and extra spaces', () => {
    expect(
      employeeKey({ firstName: 'Jan ', lastName: 'NOWAK', unit: 'Wydział  A' }),
    ).toBe(
      employeeKey({ firstName: 'jan', lastName: 'Nowak', unit: 'wydział a' }),
    );
  });
});
