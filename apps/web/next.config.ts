import type { NextConfig } from 'next';
import { withBotId } from 'botid/next/config';
import { withWorkflow } from 'workflow/next';

function rustApiOrigin() {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:5051';
  return raw.replace(/\/$/, '').replace(/\/api$/, '');
}

const nextConfig: NextConfig = {
  // Docker / self-host only. Native Vercel builds should not use standalone output.
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),
  transpilePackages: ['@everredi/api-client', '@everredi/types', '@everredi/validation'],
  async rewrites() {
    const origin = rustApiOrigin();
    // Next routes such as /api/auth/bootstrap and /api/cron/alerts stay in this app.
    // Everything else under /api is the Rust service.
    return [{ source: '/api/:path*', destination: `${origin}/api/:path*` }];
  },
};

export default withWorkflow(withBotId(nextConfig));
