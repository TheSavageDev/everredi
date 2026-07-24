import { NextRequest, NextResponse } from 'next/server';

/**
 * Local-dev proxy only.
 *
 * On Vercel Services, public `/api/*` is rewritten to the Nest `api` service, so
 * this route is unused in production. Prefer `NEXT_PUBLIC_API_URL=/api` (default).
 *
 * Server-side code can also use the injected binding `API_INTERNAL_URL` to reach
 * Nest without traversing the public edge.
 */
const API_URL =
  process.env.API_INTERNAL_URL?.replace(/\/$/, '') ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:5051/api';

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const target = `${API_URL}/${path.join('/')}${url.search}`;
  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);

  const init: RequestInit = {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text(),
  };
  const res = await fetch(target, init);
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
