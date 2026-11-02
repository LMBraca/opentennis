import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  // Generated SQL is committed and reviewed. `drizzle-kit push` is convenient
  // for a scratch branch but silently diffs against live state, which is not
  // something we want in a repo that will outlive this session.
  strict: true,
  verbose: true,
});
