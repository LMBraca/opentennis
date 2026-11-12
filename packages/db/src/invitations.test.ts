import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type { Database } from './client';
import {
  acceptInvitation,
  cancelInvitation,
  createOrResendInvitation,
  hashInvitationToken,
  invitationEmailForToken,
  listPendingInvitations,
  normalizeInviteEmail,
} from './invitations';
import { invitations, memberships, sessions, users } from './schema/core';

type Row = Record<string, unknown>;

class MemoryDatabase {
  readonly invitations: Row[] = [];
  readonly users: Row[] = [];
  readonly memberships: Row[] = [];
  readonly sessions: Row[] = [];
  private readonly dialect = new PgDialect();

  select() {
    return new SelectQuery(this);
  }

  insert(table: unknown) {
    return new InsertQuery(this, table);
  }

  update(table: unknown) {
    return new UpdateQuery(this, table);
  }

  async transaction<T>(callback: (tx: this) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({
      invitations: this.invitations,
      users: this.users,
      memberships: this.memberships,
      sessions: this.sessions,
    });
    try {
      return await callback(this);
    } catch (error) {
      this.invitations.splice(0, this.invitations.length, ...snapshot.invitations);
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
    const query = this.dialect.sqlToQuery(condition);
    const { sql, params } = query;
    if (table === memberships) {
      return rows.filter((row) => row.organizationId === params[0] && row.userId === params[1]);
    }
    if (table === users) {
      return rows.filter((row) => String(row.email).toLowerCase() === params[0]);
    }
    if (table === invitations && sql.includes('"token_hash"')) {
      return rows.filter((row) => row.tokenHash === params[0]);
    }
    if (table === invitations && sql.includes('"id" =')) {
      return rows.filter((row) => row.id === params[0]);
    }
    if (table === invitations && params.length > 1) {
      return rows.filter(
        (row) =>
          row.organizationId === params[0] &&
          row.email === params[1] &&
          row.consumedAt === null &&
          row.cancelledAt === null,
      );
    }
    if (table === invitations) {
      return rows.filter(
        (row) =>
          row.organizationId === params[0] && row.consumedAt === null && row.cancelledAt === null,
      );
    }
    return rows;
  }

  insertRow(table: unknown, values: Row): Row {
    const rows = this.rowsFor(table);
    const row = {
      id: `${rows.length + 1}`,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      cancelledAt: null,
      consumedAt: null,
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

  private rowsFor(table: unknown): Row[] {
    if (table === invitations) return this.invitations;
    if (table === users) return this.users;
    if (table === memberships) return this.memberships;
    if (table === sessions) return this.sessions;
    return [];
  }
}

class SelectQuery {
  private table: unknown;
  private condition: SQL | undefined;

  constructor(private readonly db: MemoryDatabase) {}

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

  limit(): Promise<Row[]> {
    return Promise.resolve(this.db.rows(this.table, this.condition));
  }

  orderBy(): Promise<Row[]> {
    return Promise.resolve(this.db.rows(this.table, this.condition));
  }
}

class InsertQuery {
  private inserted: Row | undefined;

  constructor(
    private readonly db: MemoryDatabase,
    private readonly table: unknown,
  ) {}

  values(values: Row): this {
    this.inserted = this.db.insertRow(this.table, values);
    return this;
  }

  returning(): Promise<{ id: unknown }[]> {
    return Promise.resolve(this.inserted === undefined ? [] : [{ id: this.inserted.id }]);
  }
}

class UpdateQuery {
  private valuesToSet: Row = {};
  private updated: Row[] = [];

  constructor(
    private readonly db: MemoryDatabase,
    private readonly table: unknown,
  ) {}

  set(values: Row): this {
    this.valuesToSet = values;
    return this;
  }

  where(condition: SQL): this {
    this.updated = this.db.updateRows(this.table, this.valuesToSet, condition);
    return this;
  }

  returning(): Promise<{ id: unknown }[]> {
    return Promise.resolve(this.updated.map((row) => ({ id: row.id })));
  }
}

function database(role = 'owner'): Database {
  const memory = new MemoryDatabase();
  memory.memberships.push({
    id: 'membership-1',
    organizationId: 'org-1',
    userId: 'actor-1',
    role,
  });
  return memory as unknown as Database;
}

function store(db: Database): MemoryDatabase {
  return db as unknown as MemoryDatabase;
}

const now = new Date('2026-11-10T12:00:00Z');
const actor = { id: 'actor-1' };
const inviteInput = {
  organizationId: 'org-1',
  actor,
  email: ' New.Admin@example.com ',
  now,
};

describe('admin invitations', () => {
  it('normalizes valid email addresses and rejects invalid ones', () => {
    expect(normalizeInviteEmail('  ADMIN@Example.COM ')).toBe('admin@example.com');
    for (const invalid of ['', 'not an address', 'admin@localhost', 'a@b.c'.repeat(60)]) {
      expect(normalizeInviteEmail(invalid)).toBeNull();
    }
  });

  it('stores a one-way SHA-256 token hash', () => {
    const token = 'secret-admin-invite-token';
    const hash = hashInvitationToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashInvitationToken(token)).toBe(hash);
  });

  it('creates a normalized, hashed, 24-hour invitation for an authorized member', async () => {
    const db = database();
    const result = await createOrResendInvitation(db, inviteInput);
    expect(result.status).toBe('created');
    if (result.status !== 'created') throw new Error('Expected created invitation');
    const row = store(db).invitations[0]!;
    expect(row.email).toBe('new.admin@example.com');
    expect(row.tokenHash).toBe(hashInvitationToken(result.token));
    expect(row.tokenHash).not.toBe(result.token);
    expect(result.expiresAt.getTime() - now.getTime()).toBe(86_400_000);
    expect(await listPendingInvitations(db, 'org-1', 'actor-1')).toHaveLength(1);
  });

  it('denies scorekeepers, viewers, and members from another organization', async () => {
    for (const role of ['scorekeeper', 'viewer']) {
      const db = database(role);
      expect((await createOrResendInvitation(db, inviteInput)).status).toBe('denied');
      expect(store(db).invitations).toHaveLength(0);
    }
    const db = database();
    expect(
      (await createOrResendInvitation(db, { ...inviteInput, actor: { id: 'signed-out' } })).status,
    ).toBe('denied');
    expect(await listPendingInvitations(db, 'foreign-org', 'actor-1')).toEqual([]);
    expect(
      await cancelInvitation(db, {
        organizationId: 'foreign-org',
        actor,
        invitationId: '1',
      }),
    ).toBe('denied');
    const foreignMemberDb = database();
    store(foreignMemberDb).memberships.splice(0, 1, {
      id: 'membership-foreign',
      organizationId: 'foreign-org',
      userId: 'actor-1',
      role: 'admin',
    });
    expect((await createOrResendInvitation(foreignMemberDb, inviteInput)).status).toBe('denied');
  });

  it('allows admins as well as owners to invite', async () => {
    const db = database('admin');
    expect((await createOrResendInvitation(db, inviteInput)).status).toBe('created');
  });

  it('rejects an existing user without creating an invitation', async () => {
    const db = database();
    store(db).users.push({ id: 'existing', email: 'New.Admin@Example.com' });
    expect((await createOrResendInvitation(db, inviteInput)).status).toBe('email-in-use');
    expect(store(db).invitations).toHaveLength(0);
  });

  it('rotates a pending invite in place and invalidates the old token', async () => {
    const db = database();
    const first = await createOrResendInvitation(db, inviteInput);
    if (first.status !== 'created') throw new Error('Expected created invitation');
    const second = await createOrResendInvitation(db, {
      ...inviteInput,
      now: new Date(now.getTime() + 60_000),
    });
    expect(second.status).toBe('resent');
    if (second.status !== 'resent') throw new Error('Expected resent invitation');
    expect(store(db).invitations).toHaveLength(1);
    expect(store(db).invitations[0]?.tokenHash).toBe(hashInvitationToken(second.token));
    expect(store(db).invitations[0]?.tokenHash).not.toBe(hashInvitationToken(first.token));
    expect(await invitationEmailForToken(db, first.token, now)).toBeNull();
    expect(await invitationEmailForToken(db, second.token, now)).toBe('new.admin@example.com');
  });

  it('accepts once and creates a verified admin, session, and consumed marker', async () => {
    const db = database();
    const invite = await createOrResendInvitation(db, inviteInput);
    if (invite.status !== 'created') throw new Error('Expected created invitation');
    const accepted = await acceptInvitation(db, {
      token: invite.token,
      name: 'New Admin',
      password: 'a long enough password',
      now,
    });
    expect(accepted.status).toBe('accepted');
    if (accepted.status !== 'accepted') throw new Error('Expected accepted invitation');
    const state = store(db);
    expect(state.users).toHaveLength(1);
    expect(state.users[0]?.emailVerified).toBe(true);
    expect(state.users[0]?.name).toBe('New Admin');
    expect(state.memberships.find((row) => row.userId === state.users[0]?.id)?.role).toBe('admin');
    expect(state.sessions).toHaveLength(1);
    expect(state.invitations[0]?.consumedAt).toEqual(now);
    expect(
      (
        await acceptInvitation(db, {
          token: invite.token,
          name: 'New Admin',
          password: 'a long enough password',
          now,
        })
      ).status,
    ).toBe('invalid');
    expect(state.users).toHaveLength(1);
  });

  it('does not consume an invite if its email already belongs to a user', async () => {
    const db = database();
    const invite = await createOrResendInvitation(db, inviteInput);
    if (invite.status !== 'created') throw new Error('Expected created invitation');
    store(db).users.push({ id: 'pre-existing-user', email: 'New.Admin@Example.com' });
    expect(
      (
        await acceptInvitation(db, {
          token: invite.token,
          name: 'New Admin',
          password: 'a long enough password',
          now,
        })
      ).status,
    ).toBe('email-in-use');
    expect(store(db).invitations[0]?.consumedAt).toBeNull();
    expect(store(db).memberships).toHaveLength(1);
    expect(store(db).sessions).toHaveLength(0);
  });

  it('rejects expired, cancelled, and too-short-password attempts without writes', async () => {
    for (const state of ['expired', 'cancelled'] as const) {
      const db = database();
      const invite = await createOrResendInvitation(db, inviteInput);
      if (invite.status !== 'created') throw new Error('Expected created invitation');
      const row = store(db).invitations[0]!;
      if (state === 'expired') row.expiresAt = now;
      else {
        expect(
          await cancelInvitation(db, {
            organizationId: 'org-1',
            actor,
            invitationId: String(row.id),
            now,
          }),
        ).toBe('cancelled');
      }
      expect(
        (
          await acceptInvitation(db, {
            token: invite.token,
            name: 'New Admin',
            password: 'a long enough password',
            now,
          })
        ).status,
      ).toBe('invalid');
      expect(store(db).users).toHaveLength(0);
      expect(store(db).sessions).toHaveLength(0);
    }
    const db = database();
    const invite = await createOrResendInvitation(db, inviteInput);
    if (invite.status !== 'created') throw new Error('Expected created invitation');
    expect(
      (
        await acceptInvitation(db, {
          token: invite.token,
          name: 'New Admin',
          password: 'short',
          now,
        })
      ).status,
    ).toBe('password-too-short');
    expect(store(db).users).toHaveLength(0);
  });
});
