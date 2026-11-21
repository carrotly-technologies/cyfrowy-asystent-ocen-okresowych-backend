import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../database/database.js';
import { PostgresPulseRepository } from './postgres-pulse.repository.js';
import {
  InMemoryPulseRepository,
  type PulseRepository,
} from './pulse.repository.js';
import type { PulseResponse } from './pulse.types.js';

const response = (over: Partial<PulseResponse>): PulseResponse => ({
  id: 'r1',
  personId: 'p1',
  date: '2026-11-01',
  answers: { workload: 3, energy: 4, support: 5, clarity: 2, satisfaction: 1 },
  comment: 'komentarz',
  shareComment: false,
  createdAt: '2026-11-01T10:00:00.000Z',
  ...over,
});

describe.each([
  ['in-memory', async () => new InMemoryPulseRepository()],
  [
    'postgres',
    async () => {
      const db = drizzle({ client: new PGlite() });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      return new PostgresPulseRepository(db);
    },
  ],
] as const)('%s PulseRepository', (_name, create) => {
  let repo: PulseRepository;
  beforeEach(async () => {
    repo = await create();
  });

  it('lists by people oldest first', async () => {
    expect(await repo.isEmpty()).toBe(true);
    await repo.insert(response({ id: 'b', date: '2026-11-15' }));
    await repo.insert(response({ id: 'a' }));
    await repo.insert(response({ id: 'other', personId: 'p2' }));
    expect((await repo.listByPeople(['p1'])).map((r) => r.id)).toEqual([
      'a',
      'b',
    ]);
    expect(await repo.listByPeople([])).toEqual([]);
    expect((await repo.listByPeople(['p1', 'p2'])).length).toBe(3);
    expect((await repo.listByPeople(['p1']))[0]).toEqual(response({ id: 'a' }));
  });

  it('changes the share flag of the owner only; replaceAll swaps everything', async () => {
    await repo.insert(response({}));
    expect(await repo.setShare('r1', 'p2', true)).toBeNull();
    expect(await repo.setShare('r1', 'p1', true)).toMatchObject({
      shareComment: true,
    });
    await repo.replaceAll([response({ id: 'seed' })]);
    expect((await repo.listByPeople(['p1'])).map((r) => r.id)).toEqual([
      'seed',
    ]);
  });
});
