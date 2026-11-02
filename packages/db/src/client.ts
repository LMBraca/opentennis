/**
 * Neon serverless client.
 *
 * Neon over Supabase for this project: native Vercel integration, a database
 * branch per preview deploy, and plain Postgres with no vendor-specific
 * surface. We use Better Auth rather than Supabase Auth and no object storage,
 * so Realtime was the only thing Supabase offered that we would have used --
 * and score updates are low-frequency enough that SSE from a streaming
 * function covers it (see the SCR-7 note in the PRD).
 */

import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema/index';

export type Database = NeonHttpDatabase<typeof schema>;

let cached: Database | undefined;

export function createDb(connectionString: string): Database {
  return drizzle(neon(connectionString), { schema });
}

/**
 * Process-wide client. Cached because serverless invocations reuse the module
 * scope, and re-creating the client per request wastes the connection setup.
 */
export function getDb(): Database {
  if (cached !== undefined) return cached;

  const url = process.env['DATABASE_URL'];
  if (url === undefined || url.trim() === '') {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  }

  cached = createDb(url);
  return cached;
}

export { schema };
