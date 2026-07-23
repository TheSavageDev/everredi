import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@everredi/api-client', '@everredi/types', '@everredi/validation'],
};

export default nextConfig;
