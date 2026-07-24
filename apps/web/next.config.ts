import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Docker / self-host only. Native Vercel builds should not use standalone output.
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),
  transpilePackages: ['@everredi/api-client', '@everredi/types', '@everredi/validation'],
};

export default nextConfig;
