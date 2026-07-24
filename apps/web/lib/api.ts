import { createEverrediClient } from '@everredi/api-client';
import { createClient } from './supabase/client';

function resolveApiBaseUrl() {
  // Prefer same-origin /api when running as a Vercel Service (public rewrite).
  // NEXT_PUBLIC_API_URL remains available for local split-process or external API hosts.
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return '/api';
}

export function getApi() {
  return createEverrediClient({
    baseUrl: resolveApiBaseUrl(),
    getAccessToken: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}
