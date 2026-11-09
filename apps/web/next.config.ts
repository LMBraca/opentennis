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
   * RV-13. Route transitions through the View Transitions API.
   *
   * None of the nine motions in docs/design-system.md covers navigation —
   * they are all about what happens WITHIN a page — which is why moving
   * between pages was the one thing that felt abrupt.
   *
   * The browser does the work: it snapshots the old page, snapshots the
   * new one, and cross-fades between them on the compositor. No animation
   * library, nothing to hydrate, and on a browser without support the
   * navigation is simply instant as it is today.
   */
  experimental: {
    viewTransition: true,
  },

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
    /*
     * RV-16. Local brand assets, plus the blob store the blog uploads to.
     *
     * This was an empty array, and the reason mattered: no remote pattern
     * means the image optimiser cannot be pointed at an arbitrary host, so
     * there is no SSRF surface. Adding blob storage has to keep that true.
     *
     * `BLOB_HOSTNAME` pins it exactly once the store exists — the host is
     * `<storeId>.public.blob.vercel-storage.com` and the id is only known
     * after creation. Until then the fallback is scoped to Vercel's blob
     * domain, which is a subdomain wildcard on one vendor's hostname, NOT
     * the `**` that would let the optimiser fetch from anywhere. Set the
     * env var and even that narrows to a single host.
     */
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env['BLOB_HOSTNAME'] ?? '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],
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
