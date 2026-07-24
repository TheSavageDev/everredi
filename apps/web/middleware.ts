import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getFlags } from '@/lib/flags';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never intercept Workflow runtime / static assets.
  if (
    pathname.startsWith('/.well-known/workflow') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/queues')
  ) {
    return NextResponse.next();
  }

  const flags = await getFlags();
  if (flags.maintenanceMode && !pathname.startsWith('/api/')) {
    return new NextResponse(
      'EverRedi is undergoing maintenance. Please try again shortly.',
      {
        status: 503,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'retry-after': '600',
        },
      },
    );
  }

  if (!flags.signupEnabled && pathname === '/signup') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
