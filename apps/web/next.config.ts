import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  typescript: {
    // Never ship a build that doesn't typecheck.
    ignoreBuildErrors: false,
  },

  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
