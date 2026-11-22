import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_FOLDER } from '../database/database.js';
import type { AppNotification } from './notification.types.js';
import {
  InMemoryNotificationsRepository,
  type NotificationsRepository,
} from './notifications.repository.js';
import { PostgresNotificationsRepository } from './postgres-notifications.repository.js';

const n = (over: Partial<AppNotification>): AppNotification => ({
  id: 'n1',
  userId: 'u1',
  key: 'c-001:DUE:2026-12-04:14',
  caseId: 'c-001',
  type: 'ASSESSMENT_DUE_SOON',
  title: 'T',
  body: 'B',
  createdOn: '2026-11-21',
  createdAt: '2026-11-21T10:00:00.000Z',
  readAt: null,
  ...over,
});

// The same contract for both storages; PostgreSQL through PGlite with the
// real migrations from drizzle/.
describe.each([
  ['in-memory', async () => new InMemoryNotificationsRepository()],
  [
    'postgres',
    async () => {
      const db = drizzle({ client: new PGlite() });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      return new PostgresNotificationsRepository(db);
    },
  ],
] as const)('NotificationsRepository (%s)', (_name, make) => {
  let repo: NotificationsRepository;
  beforeEach(async () => {
    repo = await make();
  });

  it('one notification per user and key', async () => {
    expect(await repo.insertIfAbsent(n({}))).toBe(true);
    expect(await repo.insertIfAbsent(n({ id: 'n2' }))).toBe(false);
    expect(await repo.insertIfAbsent(n({ id: 'n3', userId: 'u2' }))).toBe(true);
    expect((await repo.listForUser('u1')).map((x) => x.id)).toEqual(['n1']);
  });

  it('lists newest first; marks read one and all', async () => {
    await repo.insertIfAbsent(n({}));
    await repo.insertIfAbsent(
      n({ id: 'n2', key: 'k2', createdOn: '2026-11-22' }),
    );
    expect((await repo.listForUser('u1')).map((x) => x.id)).toEqual([
      'n2',
      'n1',
    ]);
    expect(await repo.markRead('n1', 'u2', '2026-11-21T11:00:00.000Z')).toBe(
      false,
    );
    expect(await repo.markRead('n1', 'u1', '2026-11-21T11:00:00.000Z')).toBe(
      true,
    );
    expect(await repo.markAllRead('u1', '2026-11-21T12:00:00.000Z')).toBe(1);
    const list = await repo.listForUser('u1');
    expect(list.every((x) => x.readAt)).toBe(true);
    await repo.clear();
    expect(await repo.listForUser('u1')).toEqual([]);
  });

  it('marks read the notifications whose action is done, by exact key or prefix', async () => {
    await repo.insertIfAbsent(n({ id: 'a', key: 'c-1:ACK_PART_I:2026-11-01' }));
    await repo.insertIfAbsent(
      n({ id: 'b', userId: 'u2', key: 'c-1:REMIND_PART_I:2026-11-20' }),
    );
    await repo.insertIfAbsent(n({ id: 'c', key: 'c-1:TALK:inv-1' }));
    await repo.insertIfAbsent(n({ id: 'd', key: 'c-1:TALK:inv-10' }));
    await repo.insertIfAbsent(
      n({ id: 'e', key: 'c-10:ACK_PART_I:2026-11-01' }),
    );
    const at = '2026-11-21T12:00:00.000Z';
    expect(
      await repo.markReadByKeys(
        ['c-1:TALK:inv-1'],
        ['c-1:ACK_PART_I:', 'c-1:REMIND_PART_I:'],
        at,
      ),
    ).toBe(3);
    const read = [
      ...(await repo.listForUser('u1')),
      ...(await repo.listForUser('u2')),
    ]
      .filter((x) => x.readAt)
      .map((x) => x.id)
      .sort();
    expect(read).toEqual(['a', 'b', 'c']);
    expect(await repo.markReadByKeys([], [], at)).toBe(0);
  });
});
