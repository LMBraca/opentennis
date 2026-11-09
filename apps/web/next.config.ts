import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /*
   * `next dev` and `next build` both own `.next` by default, so running a
   * production build while someone has a dev server up replaces the chunks
   * that server is still serving. The symptom is the whole site losing its
   * CSS — the HTML asks for a hash that no longer exists and gets a 400 —
   * and it looks like a styling bug rather than a clobbered build directory.
   *
   * Set NEXT_DIST_DIR to build somewhere else:
   *   NEXT_DIST_DIR=.next-verify pnpm build && NEXT_DIST_DIR=.next-verify pnpm start -p 3111
   */
  ...(process.env['NEXT_DIST_DIR'] !== undefined
    ? { distDir: process.env['NEXT_DIST_DIR'] }
    : {}),

  // The engine ships as TypeScript source from the workspace, not as a build artifact.
  transpilePackages: ['@opentennis/engine', '@opentennis/db'],

  /*
   * RV-14: the editorial section moved from /updates to /blog. Permanent,
   * because these URLs have been shared — a post linked from a WhatsApp
   * group months ago should not 404 because the nav label changed.
   */
  async redirects() {
    return [
      { source: '/updates', destination: '/blog', permanent: true },
      { source: '/updates/:slug', destination: '/blog/:slug', permanent: true },
    ];
  },

  images: {
    // Local brand assets only. No remote patterns means no SSRF surface
    // through the image optimiser.
    remotePatterns: [],
  },

  typescript: {
    // Never ship a build that doesn't typecheck.
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
