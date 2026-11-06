/**
 * Test stub for the `server-only` package.
 *
 * The real module throws the moment it is imported outside a server
 * component. Aliased to this in `vitest.config.ts` so server-side modules can
 * keep the guard in production and still be unit tested.
 */
export {};
