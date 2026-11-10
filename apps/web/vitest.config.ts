import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['lib/**/*.test.ts'],
    alias: {
      '@': new URL('.', import.meta.url).pathname,
      /*
       * `server-only` throws on import outside a server component, which is
       * exactly its job in the app and exactly wrong in a test runner. Stub
       * it so a module can keep the guard AND be unit tested — otherwise the
       * only way to test server-side logic is to drop the guard, which is a
       * worse trade.
       */
      'server-only': new URL('./test/server-only-stub.ts', import.meta.url).pathname,
    },
  },
});
