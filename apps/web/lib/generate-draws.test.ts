import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  clearDraw: vi.fn(),
  db: vi.fn(),
  generateRoundRobin: vi.fn(),
  loadEntrantsForEngine: vi.fn(),
  orgId: vi.fn(),
  persistDraw: vi.fn(),
  queryResults: [] as unknown[],
  schema: new Proxy(
    {},
    {
      get: (_target, table: string) =>
        new Proxy({}, { get: (_columns, column: string) => `${table}.${column}` }),
    },
  ),
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn(),
  asc: vi.fn(),
  count: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  isNotNull: vi.fn(),
  ne: vi.fn(),
  notInArray: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@opentennis/db', () => ({
  can: vi.fn(() => true),
  clearDraw: mocks.clearDraw,
  loadEntrantsForEngine: mocks.loadEntrantsForEngine,
  nextAvailableSlug: vi.fn(),
  persistDraw: mocks.persistDraw,
  schema: mocks.schema,
  tournamentSlug: vi.fn(),
}));
vi.mock('@opentennis/engine', () => ({
  generateConsolation: vi.fn(),
  generateRoundRobin: mocks.generateRoundRobin,
  generateSingleElimination: vi.fn(),
  SCORING_PRESETS: {},
}));
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ role: 'owner' })),
}));
vi.mock('@/lib/db', () => ({ db: mocks.db, orgId: mocks.orgId }));

import { generateDraws } from '../app/admin/tournament-actions';

function queryClient() {
  return {
    select: () => {
      const result = mocks.queryResults.shift() ?? [];
      const builder: Record<string, unknown> = {};
      for (const method of ['from', 'innerJoin', 'where', 'orderBy', 'groupBy', 'limit', 'for']) {
        builder[method] = () => builder;
      }
      builder.then = (resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
      return builder;
    },
  };
}

function actionForm(values: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set('slug', 'throwaway-tournament');
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

function setBaseQueries(resultCount: number) {
  mocks.queryResults.push(
    [
      {
        id: 'tournament-id',
        slug: 'throwaway-tournament',
        entriesOpen: false,
        consolationDraws: false,
      },
    ],
    [
      {
        id: 'event-id',
        format: 'roundRobin',
        status: 'published',
        code: 'A',
        discipline: 'singles',
        division: 'open',
        thirdPlacePlayoff: false,
        entryFeeCents: 0,
      },
    ],
    [],
    resultCount === 0 ? [] : [{ eventId: 'event-id', n: resultCount }],
  );
}

beforeEach(() => {
  mocks.queryResults = [];
  mocks.orgId.mockReturnValue('organization-id');
  mocks.db.mockReturnValue({
    ...queryClient(),
    transaction: (callback: (tx: ReturnType<typeof queryClient>) => Promise<unknown>) =>
      callback(queryClient()),
  });
  mocks.loadEntrantsForEngine.mockResolvedValue([
    { id: 'entrant-one', seed: null },
    { id: 'entrant-two', seed: null },
  ]);
  mocks.generateRoundRobin.mockReturnValue({ groups: [], rounds: [], meta: {} });
  mocks.persistDraw.mockResolvedValue({
    stageId: 'new-stage',
    matchIdByEngineId: new Map(),
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('generateDraws bulk replacement confirmation', () => {
  it('does not replace a draw when recorded results are unconfirmed', async () => {
    setBaseQueries(1);

    await expect(generateDraws({}, actionForm())).resolves.toEqual({
      error: 'bulkResultsNeedConfirm',
    });
    expect(mocks.clearDraw).not.toHaveBeenCalled();
    expect(mocks.persistDraw).not.toHaveBeenCalled();
  });

  it('replaces a result-bearing draw with a matching snapshot', async () => {
    setBaseQueries(1);
    mocks.queryResults.push([{ n: 4 }], [{ n: 0 }], [], [], [{ n: 1 }]);

    await expect(
      generateDraws({}, actionForm({ confirmBulkReplace: 'true', expectedResults: 'event-id:1' })),
    ).resolves.toMatchObject({ ok: expect.stringContaining('Generated 1 draw') });
    expect(mocks.clearDraw).toHaveBeenCalledOnce();
    expect(mocks.persistDraw).toHaveBeenCalledOnce();
  });

  it('leaves draws untouched when the confirmation snapshot is stale', async () => {
    setBaseQueries(2);

    await expect(
      generateDraws({}, actionForm({ confirmBulkReplace: 'true', expectedResults: 'event-id:1' })),
    ).resolves.toEqual({ error: 'bulkResultsChanged' });
    expect(mocks.clearDraw).not.toHaveBeenCalled();
    expect(mocks.persistDraw).not.toHaveBeenCalled();
  });
});
