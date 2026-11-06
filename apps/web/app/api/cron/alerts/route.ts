import { NextRequest, NextResponse } from 'next/server';
import { callInternalApi } from '@/lib/internal-api';

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  return Boolean(secret && auth === `Bearer ${secret}`);
}

/** Daily Vercel cron. Calls the Rust API, which writes in-app notifications. */
export async function GET(request: NextRequest) {
  if (!authorize(request)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const result = await callInternalApi('/internal/cron/alerts');
  return NextResponse.json({ success: true, dispatch: 'sync', data: result });
}
