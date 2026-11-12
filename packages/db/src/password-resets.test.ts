import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Database } from './client';
import * as auth from './auth';
import { hashPassword, hashToken, verifyPassword } from './auth';
import {
  consumePasswordReset,
  createPasswordReset,
  getPasswordReset,
  RESET_EMAIL_LIMIT,
} from './password-resets';
import { memberships, passwordResets, sessions, users } from './schema/core';

type Row = Record<string, unknown>;

class MemoryDatabase {
  readonly passwordResets: Row[] = [];
  readonly users: Row[] = [];
  readonly memberships: Row[] = [];
  readonly sessions: Row[] = [];
  private readonly dialect = new PgDialect();

  select(selection?: Row) {
    return new SelectQuery(this, selection);
  }

  insert(table: unknown) {
    return new InsertQuery(this, table);
  }

  update(table: unknown) {
    return new UpdateQuery(this, table);
  }

  delete(table: unknown) {
    return new DeleteQuery(this, table);
  }

  async transaction<T>(callback: (tx: this) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({
      passwordResets: this.passwordResets,
      users: this.users,
      memberships: this.memberships,
      sessions: this.sessions,
    });
    try {
      return await callback(this);
    } catch (error) {
      this.passwordResets.splice(0, this.passwordResets.length, ...snapshot.passwordResets);
      this.users.splice(0, this.users.length, ...snapshot.users);
      this.memberships.splice(0, this.memberships.length, ...snapshot.memberships);
      this.sessions.splice(0, this.sessions.length, ...snapshot.sessions);
      throw error;
    }
  }

  async execute(): Promise<void> {}

  rows(table: unknown, condition: SQL | undefined): Row[] {
    const rows = this.rowsFor(table);
    if (condition === undefined) return rows;
    const { sql, params } = this.dialect.sqlToQuery(condition);
    const field = (column: string, operator: string): unknown => {
      const match = new RegExp(`"${column}"\\s*${operator}\\s*\\$(\\d+)`).exec(sql);
      return match === null ? undefined : params[Number(match[1]) - 1];
    };
    return rows.filter((row) => {
      if (sql.includes('lower("users"."email")')) {
        return String(row.email).toLowerCase() === params[0];
      }
      if (sql.includes('"token_hash"')) {
        const tokenHash = field('token_hash', '=');
        if (row.tokenHash !== tokenHash) return false;
      }
      if (sql.includes('"user_id"')) {
        const userId = field('user_id', '=');
        if (userId !== undefined && row.userId !== userId) return false;
      }
      if (sql.includes('"id"')) {
        const id = field('id', '=');
        if (id !== undefined && row.id !== id && !sql.includes('"id" <>')) return false;
        const excludedId = field('id', '<>');
        if (excludedId !== undefined && row.id === excludedId) return false;
      }
      if (sql.includes('"created_at" >')) {
        const createdAfter = field('created_at', '>');
        if (!(row.createdAt instanceof Date) || row.createdAt <= (createdAfter as Date)) {
          return false;
        }
      }
      if (sql.includes('"used_at" is null') && row.usedAt !== null) return false;
      if (sql.includes('"invalidated_at" is null') && row.invalidatedAt !== null) return false;
      return true;
    });
  }

  insertRow(table: unknown, values: Row): Row {
    const rows = this.rowsFor(table);
    const row = {
      id: `${rows.length + 1}`,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      usedAt: null,
      invalidatedAt: null,
      ...values,
    };
    rows.push(row);
    return row;
  }

  updateRows(table: unknown, values: Row, condition: SQL | undefined): Row[] {
    const selected = this.rows(table, condition);
    for (const row of selected) Object.assign(row, values);
    return selected;
  }

  deleteRows(table: unknown, condition: SQL | undefined): void {
    const rows = this.rowsFor(table);
    const deleted = new Set(this.rows(table, condition));
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (deleted.has(rows[index]!)) rows.splice(index, 1);
    }
  }

  private rowsFor(table: unknown): Row[] {
    if (table === passwordResets) return this.passwordResets;
    if (table === users) return this.users;
    if (table === memberships) return this.memberships;
    if (table === sessions) return this.sessions;
    return [];
  }
}

class SelectQuery {
  private table: unknown;
  private condition: SQL | undefined;

  constructor(
    private readonly db: MemoryDatabase,
    private readonly selection?: Row,
  ) {}

  from(table: unknown): this {
    this.table = table;
    return this;
  }

  where(condition: SQL): this {
    this.condition = condition;
    return this;
  }

  for(): this {
    return this;
  }

  async limit(): Promise<Row[]> {
    return this.project(this.db.rows(this.table, this.condition));
  }

  async then<TResult1 = Row[], TResult2 = never>(
    onfulfilled?: ((value: Row[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.project(this.db.rows(this.table, this.condition))).then(
      onfulfilled,
      onrejected,
    );
  }

  private project(rows: Row[]): Row[] {
    if (this.selection === undefined) return rows;
    if ('value' in this.selection) return [{ value: rows.length }];
    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(this.selection!).map(([key, column]) => [
          key,
          row[
            (column as { name: string }).name.replace(/_([a-z])/g, (_, letter: string) =>
              letter.toUpperCase(),
            )
          ],
        ]),
      ),
    );
  }
}

class InsertQuery {
  constructor(
    private readonly db: MemoryDatabase,
    private readonly table: unknown,
  ) {}

  values(values: Row): this {
    this.db.insertRow(this.table, values);
    return this;
  }
}

class UpdateQuery {
  private valuesToSet: Row = {};

  constructor(
    private readonly db: MemoryDatabase,
    private readonly table: unknown,
  ) {}

  set(values: Row): this {
    this.valuesToSet = values;
    return this;
  }

  where(condition: SQL): this {
    this.db.updateRows(this.table, this.valuesToSet, condition);
    return this;
  }
}

class DeleteQuery {
  constructor(
    private readonly db: MemoryDatabase,
    private readonly table: unknown,
  ) {}

  where(condition: SQL): void {
    this.db.deleteRows(this.table, condition);
  }
}

function database(): Database {
  return new MemoryDatabase() as unknown as Database;
}

function store(db: Database): MemoryDatabase {
  return db as unknown as MemoryDatabase;
}

const now = new Date('2026-11-10T12:00:00Z');

function seedUser(
  db: Database,
  input: { id?: string; email?: string; passwordHash?: string | null } = {},
) {
  store(db).users.push({
    id: input.id ?? 'user-1',
    email: input.email ?? 'admin@example.com',
    name: 'Admin',
    passwordHash: input.passwordHash === undefined ? 'scrypt-hash' : input.passwordHash,
  });
}

describe('password resets', () => {
  it('creates a normalized, one-hour reset and stores only its token hash', async () => {
    const db = database();
    seedUser(db);
    const result = await createPasswordReset(db, {
      email: ' ADMIN@Example.com ',
      now,
    });
    expect(result?.email).toBe('admin@example.com');
    expect(result?.expiresAt.getTime()).toBe(now.getTime() + 3_600_000);
    expect(result?.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = store(db).passwordResets[0]!;
    expect(row.tokenHash).toBe(hashToken(result!.token));
    expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.tokenHash).not.toBe(result!.token);
    expect(await getPasswordReset(db, result!.token, now)).toEqual({ email: 'admin@example.com' });
  });

  it('does not create resets for unknown or passwordless accounts', async () => {
    const db = database();
    expect(await createPasswordReset(db, { email: 'missing@example.com', now })).toBeNull();
    seedUser(db, { id: 'passwordless', email: 'passwordless@example.com', passwordHash: null });
    expect(await createPasswordReset(db, { email: 'passwordless@example.com', now })).toBeNull();
    expect(store(db).passwordResets).toHaveLength(0);
  });

  it('limits requests per user and preserves the third link', async () => {
    const db = database();
    seedUser(db);
    const links = [];
    for (let index = 0; index < RESET_EMAIL_LIMIT; index += 1) {
      links.push(
        await createPasswordReset(db, {
          email: 'admin@example.com',
          now: new Date(now.getTime() + index * 60_000),
        }),
      );
    }
    expect(
      await createPasswordReset(db, {
        email: 'admin@example.com',
        now: new Date(now.getTime() + 3 * 60_000),
      }),
    ).toBeNull();
    expect(store(db).passwordResets).toHaveLength(RESET_EMAIL_LIMIT);
    expect(await getPasswordReset(db, links[2]?.token, now)).toEqual({
      email: 'admin@example.com',
    });
  });

  it('limits requests per IP across different accounts', async () => {
    const db = database();
    for (let index = 0; index <= 10; index += 1) {
      seedUser(db, { id: `user-${index}`, email: `admin${index}@example.com` });
    }
    for (let index = 0; index < 10; index += 1) {
      expect(
        await createPasswordReset(db, {
          email: `admin${index}@example.com`,
          ip: '192.0.2.1',
          now,
        }),
      ).not.toBeNull();
    }
    expect(store(db).passwordResets[0]?.requestedIpHash).toBe(hashToken('192.0.2.1'));
    expect(store(db).passwordResets[0]?.requestedIpHash).not.toBe('192.0.2.1');
    expect(
      await createPasswordReset(db, {
        email: 'admin10@example.com',
        ip: '192.0.2.1',
        now,
      }),
    ).toBeNull();
    expect(store(db).passwordResets).toHaveLength(10);
  });

  it('invalidates an older link when a newer request is made', async () => {
    const db = database();
    seedUser(db);
    const first = await createPasswordReset(db, { email: 'admin@example.com', now });
    const second = await createPasswordReset(db, {
      email: 'admin@example.com',
      now: new Date(now.getTime() + 60_000),
    });
    expect(await getPasswordReset(db, first?.token, now)).toBeNull();
    expect(await getPasswordReset(db, second?.token, now)).toEqual({
      email: 'admin@example.com',
    });
    expect(
      await consumePasswordReset(db, {
        token: first?.token,
        newPassword: 'a new long password',
        now,
      }),
    ).toEqual({ status: 'invalid' });
  });

  it('changes the password, replaces only that user’s sessions, and consumes the link', async () => {
    const originalHash = await hashPassword('the original password');
    const db = database();
    seedUser(db, { passwordHash: originalHash });
    store(db).memberships.push({ userId: 'user-1', role: 'admin' });
    store(db).sessions.push(
      { userId: 'user-1', tokenHash: 'old-session-1' },
      { userId: 'user-1', tokenHash: 'old-session-2' },
      { userId: 'user-2', tokenHash: 'other-user-session' },
    );
    const reset = await createPasswordReset(db, { email: 'admin@example.com', now });
    const result = await consumePasswordReset(db, {
      token: reset?.token,
      newPassword: 'a brand new password',
      userAgent: 'test browser',
      now,
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('Expected successful reset');
    const user = store(db).users[0]!;
    expect(await verifyPassword('a brand new password', String(user.passwordHash))).toBe(true);
    expect(await verifyPassword('the original password', String(user.passwordHash))).toBe(false);
    expect(store(db).passwordResets[0]?.usedAt).toEqual(now);
    expect(store(db).sessions).toHaveLength(2);
    expect(store(db).sessions.filter((row) => row.userId === 'user-1')).toHaveLength(1);
    expect(store(db).sessions.find((row) => row.userId === 'user-2')?.tokenHash).toBe(
      'other-user-session',
    );
    expect(result.user.role).toBe('admin');
    expect(
      await consumePasswordReset(db, {
        token: reset?.token,
        newPassword: 'another new password',
        now,
      }),
    ).toEqual({ status: 'invalid' });
  });

  it('rejects expired, malformed, missing, and empty tokens without changing credentials', async () => {
    const db = database();
    const originalHash = await hashPassword('the original password');
    seedUser(db, { passwordHash: originalHash });
    const reset = await createPasswordReset(db, { email: 'admin@example.com', now });
    store(db).passwordResets[0]!.expiresAt = new Date(now.getTime());
    const passwordHashSpy = vi.spyOn(auth, 'hashPassword');
    for (const token of [reset?.token, undefined, '', 'not-a-token']) {
      expect(await getPasswordReset(db, token, now)).toBeNull();
      expect(
        await consumePasswordReset(db, { token, newPassword: 'a brand new password', now }),
      ).toEqual({ status: 'invalid' });
    }
    expect(passwordHashSpy).not.toHaveBeenCalled();
    passwordHashSpy.mockRestore();
    expect(store(db).users[0]?.passwordHash).toBe(originalHash);
    expect(store(db).sessions).toHaveLength(0);
  });

  it('does not consume a reset when the password is too short', async () => {
    const db = database();
    seedUser(db);
    const reset = await createPasswordReset(db, { email: 'admin@example.com', now });
    expect(
      await consumePasswordReset(db, {
        token: reset?.token,
        newPassword: 'short',
        now,
      }),
    ).toEqual({ status: 'password-too-short' });
    expect(await getPasswordReset(db, reset?.token, now)).toEqual({
      email: 'admin@example.com',
    });
    expect(store(db).passwordResets[0]?.usedAt).toBeNull();
  });
});
