import { createEverrediClient } from '@everredi/api-client';
import { createClient } from './supabase/client';

export function getApi() {
  return createEverrediClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api/backend',
    getAccessToken: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}
