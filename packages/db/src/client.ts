/**
 * Postgres client.
 *
 * Driver choice follows the neon-postgres agent skill: on Vercel, use
 * node-postgres (`pg`) with Fluid compute, NOT @neondatabase/serverless.
 * Fluid keeps the function instance warm across invocations, so a real
 * connection pool is reused rather than paying HTTP round-trip overhead per
 * query. `attachDatabasePool` lets Vercel drain the pool before an instance is
 * frozen or shut down, which is what prevents connection leaks.
 *
 * (An earlier revision of this file used @neondatabase/serverless over HTTP.
 * That driver is the right call on Netlify or Cloudflare Workers, where there
 * is no persistent instance to pool from — but it is the wrong one here.)
 *
 * Pooled vs direct, per the same skill:
 *
 *   DATABASE_URL           pooled (-pooler, PgBouncer transaction mode).
 *                          Application query traffic.
 *   DATABASE_URL_UNPOOLED  direct. Migrations, pg_dump, logical replication,
 *                          LISTEN/NOTIFY, and anything needing session state.
 *
 * Running a migration over the pooled URL fails in ways that never mention
 * pooling, so the two are kept deliberately separate here.
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema/index';

export type Database = NodePgDatabase<typeof schema>;

let cachedPool: Pool | undefined;
let cachedDb: Database | undefined;

export interface CreateDbOptions {
  /** Max pooled connections. Small by default: PgBouncer is in front. */
  readonly max?: number;
  /**
   * Called with the pool so the host can drain it on shutdown. On Vercel this
   * is `attachDatabasePool` from @vercel/functions.
   */
  readonly onPoolCreated?: (pool: Pool) => void;
}

export function createDb(connectionString: string, options: CreateDbOptions = {}): Database {
  const pool = new Pool({
    connectionString,
    max: options.max ?? 5,
    // Neon scale-to-zero suspends an idle compute, so a long-held idle
    // connection is wasted anyway. Recycle quickly.
    idleTimeoutMillis: 30_000,
    // Surface a cold-start stall as an error rather than hanging a request.
    connectionTimeoutMillis: 10_000,
  });

  options.onPoolCreated?.(pool);
  return drizzle(pool, { schema });
}

/**
 * Process-wide client, cached because serverless invocations reuse module
 * scope. Re-creating the pool per request would defeat pooling entirely.
 */
export function getDb(): Database {
  if (cachedDb !== undefined) return cachedDb;

  const url = process.env['DATABASE_URL'];
  if (url === undefined || url.trim() === '') {
    throw new Error('DATABASE_URL is not set. Run `neon env pull`, or see .env.example.');
  }

  cachedDb = createDb(url, {
    onPoolCreated: (pool) => {
      cachedPool = pool;
    },
  });
  return cachedDb;
}

/** The underlying pool, once getDb() has run. For health checks and shutdown. */
export function getPool(): Pool | undefined {
  return cachedPool;
}

/**
 * Direct, non-pooled connection. Migrations, dumps, logical replication, and
 * LISTEN/NOTIFY all need session state that PgBouncer's transaction mode
 * does not preserve.
 */
export function directConnectionString(): string {
  const direct = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL'];
  if (direct === undefined || direct.trim() === '') {
    throw new Error('Neither DATABASE_URL_UNPOOLED nor DATABASE_URL is set.');
  }
  return direct;
}

export { schema };
