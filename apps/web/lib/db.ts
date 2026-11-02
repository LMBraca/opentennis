/**
 * App-side database handle.
 *
 * Wires the @opentennis/db pool into Vercel's runtime. `attachDatabasePool`
 * registers the pg Pool with Fluid compute so Vercel can drain it before an
 * instance is frozen or shut down — without it, a scaled-down instance leaks
 * its Postgres connections until they time out server-side.
 *
 * Fluid keeps instances warm between invocations, which is the whole reason
 * node-postgres beats an HTTP driver here: the pool actually gets reused.
 */

import 'server-only';
import { createDb, type Database } from '@opentennis/db';
import { attachDatabasePool } from '@vercel/functions';

let cached: Database | undefined;

export function db(): Database {
  if (cached !== undefined) return cached;

  const url = process.env['DATABASE_URL'];
  if (url === undefined || url.trim() === '') {
    throw new Error('DATABASE_URL is not set. Run `neon deploy` to pull it into .env.local.');
  }

  cached = createDb(url, {
    onPoolCreated: (pool) => {
      // Safe outside Vercel too: the helper is a no-op off-platform.
      attachDatabasePool(pool);
    },
  });
  return cached;
}

/**
 * v1 is single-tenant. This is the only place that fact is encoded in the web
 * app, so going multi-tenant means changing how a scope is obtained rather
 * than changing any query.
 */
export function orgId(): string {
  const id = process.env['OPENTENNIS_ORG_ID'];
  if (id === undefined || id.trim() === '') {
    throw new Error(
      'OPENTENNIS_ORG_ID is not set. Run the seed script in packages/db and copy the printed id.',
    );
  }
  return id;
}
