import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../database/database.js';
import type { EmployeesRepository } from './employees.repository.js';
import { buildEmployeesSeed } from './employees.seed.js';
import { InMemoryEmployeesRepository } from './in-memory-employees.repository.js';
import { PostgresEmployeesRepository } from './postgres-employees.repository.js';

// The same contract for both storages; PostgreSQL through PGlite with the
// real migrations from drizzle/.
describe.each([
  ['in-memory', async () => new InMemoryEmployeesRepository()],
  [
    'postgres',
    async () => {
      const db = drizzle({ client: new PGlite() });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      return new PostgresEmployeesRepository(db);
    },
  ],
] as const)('%s EmployeesRepository', (_name, create) => {
  let repo: EmployeesRepository;
  const seed = buildEmployeesSeed('2026-11-21');

  beforeEach(async () => {
    repo = await create();
  });

  it('is empty, then holds the seed', async () => {
    expect(await repo.isEmpty()).toBe(true);
    await repo.replaceAll(seed);
    expect(await repo.isEmpty()).toBe(false);
    expect(await repo.listEmployees()).toHaveLength(seed.employees.length);
    expect(await repo.findEmployee('p-jasinska')).toEqual(
      seed.employees.find((e) => e.id === 'p-jasinska'),
    );
    expect((await repo.listSubstitutions())[0]).toEqual(seed.substitutions[0]);
  });

  it('updates an employee and lists absences by start date', async () => {
    await repo.replaceAll(seed);
    const e = (await repo.findEmployee('p-krol'))!;
    await repo.updateEmployee({ ...e, position: 'Starszy legislator' });
    expect((await repo.findEmployee('p-krol'))!.position).toBe(
      'Starszy legislator',
    );
    const abs = await repo.listAbsences('p-lewandowski');
    expect(abs.map((a) => a.from)).toEqual(['2026-10-05', '2026-10-19']);
    expect(await repo.deleteAbsence('p-krol', abs[0].id)).toBe(false);
    expect(await repo.deleteAbsence('p-lewandowski', abs[0].id)).toBe(true);
  });

  it('deleting an employee removes their absences and history', async () => {
    await repo.replaceAll(seed);
    expect((await repo.listHistory('p-jasinska')).map((h) => h.id)).toEqual([
      'hist-2',
      'hist-1',
    ]);
    expect(await repo.deleteEmployee('p-jasinska')).toBe(true);
    expect(await repo.deleteEmployee('p-jasinska')).toBe(false);
    expect(await repo.listHistory('p-jasinska')).toEqual([]);
    await repo.deleteEmployee('p-lewandowski');
    expect(await repo.listAbsences('p-lewandowski')).toEqual([]);
  });

  it('inserts imported history and substitutions', async () => {
    await repo.replaceAll(seed);
    await repo.insertHistory([
      {
        id: 'h-new',
        employeeId: 'p-krol',
        assessedOn: '2024-02-01',
        acknowledgedOn: null,
        result: 'POSITIVE',
        level: null,
        createdAt: '2026-11-21T10:00:00.000Z',
      },
    ]);
    expect(await repo.listHistory('p-krol')).toHaveLength(1);
    expect(await repo.deleteSubstitution('sub-1')).toBe(true);
    expect(await repo.listSubstitutions()).toEqual([]);
  });
});
