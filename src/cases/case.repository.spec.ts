import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../database/database.js';
import type { CaseRepository } from './case.repository.js';
import { InMemoryCaseRepository } from './in-memory-case.repository.js';
import { PostgresCaseRepository } from './postgres-case.repository.js';
import { buildSeed } from './seed/seed.data.js';

// The same contract for both storages; PostgreSQL through PGlite with the
// real migrations from drizzle/.
describe.each([
  ['in-memory', async () => new InMemoryCaseRepository()],
  [
    'postgres',
    async () => {
      const db = drizzle({ client: new PGlite() });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      return new PostgresCaseRepository(db);
    },
  ],
] as const)('%s CaseRepository', (_name, create) => {
  let repo: CaseRepository;
  const seed = buildSeed('2026-11-21');

  beforeEach(async () => {
    repo = await create();
  });

  it('starts empty; replaceAll stores whole records in their order', async () => {
    expect(await repo.isEmpty()).toBe(true);
    await repo.replaceAll(seed);
    expect(await repo.isEmpty()).toBe(false);
    expect(await repo.loadAll()).toEqual(seed);
  });

  it('save updates a record in place (history included) and adds a new one last', async () => {
    await repo.replaceAll(seed);
    const [first] = seed;
    const changed = {
      ...first,
      stage: 'ASSESSMENT' as const,
      history: [...first.history, { date: '2026-11-21', text: 'Zmiana.' }],
    };
    await repo.save(changed);
    await repo.save({ ...first, id: 'c-new' });
    const all = await repo.loadAll();
    expect(all).toHaveLength(seed.length + 1);
    expect(all[0]).toEqual(changed);
    expect(all.at(-1)?.id).toBe('c-new');
  });

  it('replaceAll removes records outside the new set', async () => {
    await repo.replaceAll(seed);
    await repo.save({ ...seed[0], id: 'c-new' });
    await repo.replaceAll(seed);
    expect((await repo.loadAll()).map((c) => c.id)).toEqual(
      seed.map((c) => c.id),
    );
  });
});
