import { createEverrediClient } from '@everredi/api-client';
import { createClient } from './supabase/client';

function resolveApiBaseUrl() {
  // Same-origin /api is rewritten to the Rust service.
  // NEXT_PUBLIC_API_URL remains available for local split-process or an external API host.
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
