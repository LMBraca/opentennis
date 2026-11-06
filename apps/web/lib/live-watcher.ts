/**
 * SCR-7 — the change signal behind the live score stream.
 *
 * ONE poller per tournament per warm instance, shared by every spectator
 * connected to that instance. Subscribers come and go; the timer starts with
 * the first and stops with the last, so an idle tournament costs nothing.
 * Same reasoning as the pool in `lib/db.ts`: Fluid keeps instances warm, so a
 * module-level singleton is actually reused rather than rebuilt per request.
 *
 * DELIBERATE DEVIATION from the backlog, which specified `LISTEN/NOTIFY`.
 * LISTEN needs a session-mode connection, so it cannot use the pooled
 * `DATABASE_URL` at all — PgBouncer's transaction mode drops the session
 * state it depends on, the same trap that bites migrations (CLAUDE.md). That
 * would mean a second, direct connection pattern in production, held open per
 * instance, to serve a club where a few dozen spectators see a handful of
 * score changes an hour. A 2-second count over an indexed table costs far
 * less than that complexity, and the client cannot tell the difference.
 *
 * WHY THE VERSION IS BUILT FROM `score_events` AND NOT `matches.updated_at`:
 * `updatedAt` in this schema is `defaultNow()` with no `$onUpdate` and no
 * database trigger, so it is set once at insert and NEVER changes. A version
 * keyed on it would look perfectly healthy — stream connects, heartbeats
 * flow — and would never once fire. `score_events` is append-only and every
 * scoring path writes exactly one row, including `clearResult`, so its count
 * is a true monotonic change counter.
 */

import 'server-only';
import { countDistinct, count, eq, max } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db } from './db';

/** How often a watched tournament is checked for changes. */
const POLL_MS = 2_000;
/** Consecutive failed polls before subscribers are told the data is stale. */
const STALE_AFTER_FAILURES = 3;

export interface LiveMessage {
  /** `change` — something scoreable moved. `stale` — polling is failing. */
  readonly kind: 'change' | 'stale';
  readonly version: string;
}

type Listener = (message: LiveMessage) => void;

interface Watcher {
  readonly subscribers: Set<Listener>;
  timer: ReturnType<typeof setInterval> | null;
  version: string | null;
  failures: number;
  announcedStale: boolean;
}

const watchers = new Map<string, Watcher>();

/**
 * A cheap fingerprint of everything a spectator would notice.
 *
 * `matches` catches a draw being generated or regenerated; the score-event
 * count and timestamp catch every result saved, edited or cleared. One round
 * trip, both counts coming off indexed columns.
 */
export function formatVersion(
  matches: number,
  events: number,
  latest: Date | string | null,
): string {
  return [matches, events, latest === null ? '-' : new Date(latest).toISOString()].join(':');
}

export async function readVersion(tournamentId: string): Promise<string> {
  const [row] = await db()
    .select({
      matches: countDistinct(schema.matches.id),
      events: count(schema.scoreEvents.id),
      latest: max(schema.scoreEvents.createdAt),
    })
    .from(schema.matches)
    .leftJoin(schema.scoreEvents, eq(schema.scoreEvents.matchId, schema.matches.id))
    .where(eq(schema.matches.tournamentId, tournamentId));

  return formatVersion(row?.matches ?? 0, row?.events ?? 0, row?.latest ?? null);
}

function emit(watcher: Watcher, message: LiveMessage): void {
  for (const listener of watcher.subscribers) {
    try {
      listener(message);
    } catch {
      // A listener whose stream has already gone away must not stop the
      // others from being told.
    }
  }
}

async function poll(tournamentId: string, watcher: Watcher): Promise<void> {
  try {
    const version = await readVersion(tournamentId);
    watcher.failures = 0;

    if (watcher.announcedStale) {
      // Recovered. Re-announce the current version so a client that refreshed
      // nothing while degraded picks up whatever it missed.
      watcher.announcedStale = false;
      watcher.version = version;
      emit(watcher, { kind: 'change', version });
      return;
    }

    if (watcher.version !== null && watcher.version !== version) {
      emit(watcher, { kind: 'change', version });
    }
    watcher.version = version;
  } catch {
    watcher.failures += 1;
    if (watcher.failures >= STALE_AFTER_FAILURES && !watcher.announcedStale) {
      // Say so rather than holding a connection open that silently shows
      // stale scores — SCR-8 asks for honest connection state, and a stream
      // that is up but blind is the dishonest case.
      watcher.announcedStale = true;
      emit(watcher, { kind: 'stale', version: watcher.version ?? '-' });
    }
  }
}

/**
 * Watch a tournament. Returns the unsubscribe function; calling it is how the
 * poller eventually stops, so a route handler must call it on abort.
 */
export function subscribe(tournamentId: string, listener: Listener): () => void {
  let watcher = watchers.get(tournamentId);
  if (watcher === undefined) {
    watcher = {
      subscribers: new Set(),
      timer: null,
      version: null,
      failures: 0,
      announcedStale: false,
    };
    watchers.set(tournamentId, watcher);
  }
  const active = watcher;
  active.subscribers.add(listener);

  if (active.timer === null) {
    active.timer = setInterval(() => {
      void poll(tournamentId, active);
    }, POLL_MS);
    // Never hold the process open for a poller; the request does that.
    active.timer.unref?.();
  }

  return () => {
    active.subscribers.delete(listener);
    if (active.subscribers.size === 0) {
      if (active.timer !== null) clearInterval(active.timer);
      watchers.delete(tournamentId);
    }
  };
}

/** Test seam: how many tournaments this instance is currently polling. */
export function watchedCount(): number {
  return watchers.size;
}
