import { checkBotId } from 'botid/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * BotID-protected bootstrap after Supabase sign-in / sign-up.
 * Proxies to Nest `POST /api/auth/create-or-update`.
 */
export async function POST(request: NextRequest) {
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const apiBase =
    process.env.API_INTERNAL_URL?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api`
      : 'http://localhost:5051/api');
  const nestBase = apiBase.endsWith('/api') ? apiBase : `${apiBase}/api`;

  const res = await fetch(`${nestBase}/auth/create-or-update`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.access_token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}
