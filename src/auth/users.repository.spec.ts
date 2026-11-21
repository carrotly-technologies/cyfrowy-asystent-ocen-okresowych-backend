import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../database/database.js';
import { PostgresUsersRepository } from './postgres-users.repository.js';
import { InMemoryUsersRepository } from './users.in-memory.repository.js';
import type { UsersRepository } from './users.repository.js';
import { USER_SEED } from './users.seed.js';

describe.each([
  ['in-memory', async () => new InMemoryUsersRepository()],
  [
    'postgres',
    async () => {
      const db = drizzle({ client: new PGlite() });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      return new PostgresUsersRepository(db);
    },
  ],
] as const)('%s UsersRepository', (_name, create) => {
  let repo: UsersRepository;

  beforeEach(async () => {
    repo = await create();
  });

  it('starts empty; replaceAll stores the seed in its order, without hashes', async () => {
    expect(await repo.isEmpty()).toBe(true);
    await repo.replaceAll(USER_SEED);
    expect(await repo.isEmpty()).toBe(false);
    const list = await repo.list();
    expect(list.map((u) => u.id)).toEqual(USER_SEED.map((u) => u.id));
    expect(list[0]).not.toHaveProperty('passwordHash');
    expect(await repo.findById('u-nowak')).toEqual(
      list.find((u) => u.id === 'u-nowak'),
    );
    expect(await repo.findById('u-none')).toBeNull();
  });

  it('finds credentials by login, ignoring case and spaces', async () => {
    await repo.replaceAll(USER_SEED);
    const found = await repo.findCredentials('  J.Kaminska ');
    expect(found?.user.id).toBe('u-kaminska');
    expect(found?.passwordHash).toBe(USER_SEED[0].passwordHash);
    expect(await repo.findCredentials('nikt')).toBeNull();
  });

  it('updates a role; replaceAll restores the seed', async () => {
    await repo.replaceAll(USER_SEED);
    expect((await repo.updateRole('u-nowak', 'HR'))?.role).toBe('HR');
    expect((await repo.findById('u-nowak'))?.role).toBe('HR');
    expect(await repo.updateRole('u-none', 'HR')).toBeNull();
    await repo.replaceAll(USER_SEED);
    expect((await repo.findById('u-nowak'))?.role).toBe('EMPLOYEE');
  });
});
