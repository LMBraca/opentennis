import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The engine ships as TypeScript source from the workspace, not as a build artifact.
  transpilePackages: ['@opentennis/engine'],

  typescript: {
    // Never ship a build that doesn't typecheck.
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
