export { createDb, directConnectionString, getDb, getPool, schema } from './client';
export type { CreateDbOptions, Database } from './client';

export { TenantScope, scopeFromEnv } from './tenancy';
export type { TenantScoped } from './tenancy';

export {
  MAX_SLUG_LENGTH,
  RESERVED_SLUGS,
  isReservedSlug,
  isValidSlug,
  nextAvailableSlug,
  slugify,
  slugifyCategoryCode,
  tournamentSlug,
} from './slugs';

export { DEFAULT_CATEGORY_LADDER } from './seed-data';
export type { CategorySeed } from './seed-data';

export {
  SESSION_COOKIE,
  SESSION_DAYS,
  hashPassword,
  purgeExpiredSessions,
  sessionFromToken,
  signIn,
  signOut,
  verifyPassword,
} from './auth';
export {
  createScorekeeperToken,
  hashScorekeeperToken,
  looksLikeToken,
  revokeScorekeeperToken,
  scorekeeperFromToken,
  type CreateTokenInput,
  type ScorekeeperGrant,
} from './scorekeeper';
export type { SessionUser } from './auth';

export { clearDraw, loadEntrantsForEngine, persistDraw } from './persist-draw';
export type { PersistDrawInput, PersistDrawResult } from './persist-draw';
