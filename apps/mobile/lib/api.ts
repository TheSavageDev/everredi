import { createEverrediClient } from '@everredi/api-client';
import { supabase } from './supabase';

export function getApi() {
  return createEverrediClient({
    baseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5051/api',
    getAccessToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    },
  });
}
