/** Server-only helpers for calling Nest via service binding or public URL. */

export function resolveInternalApiBaseUrl() {
  const fromBinding = process.env.API_INTERNAL_URL?.replace(/\/$/, '');
  if (fromBinding) return fromBinding.endsWith('/api') ? fromBinding : `${fromBinding}/api`;

  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (publicUrl) return publicUrl;

  // Same-origin rewrite to Nest when running on Vercel Services.
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api`;
  }

  return 'http://localhost:5051/api';
}

export async function callInternalApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new Error('CRON_SECRET is required for internal API calls');
  }
  const base = resolveInternalApiBaseUrl();
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${secret}`);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    headers,
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: T;
    message?: string;
  };
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `Internal API ${res.status}`);
  }
  return (json.data ?? json) as T;
}
