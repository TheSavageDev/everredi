'use client';

import { useQuery } from '@tanstack/react-query';
import { EVERREDI_PRO_ENTITLEMENT } from '@everredi/types';
import { getApi } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

export default function AccountPage() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => getApi().users.me() });
  const sub = useQuery({
    queryKey: ['subscription'],
    queryFn: () => getApi().subscriptions.status(),
  });

  return (
    <main>
      <h1 className="font-display text-3xl font-semibold">Account</h1>
      <div className="mt-6 space-y-2 rounded-xl border border-ink/10 bg-white/80 p-5 text-sm">
        <p>
          <span className="text-ink/60">Email:</span> {me.data?.email}
        </p>
        <p>
          <span className="text-ink/60">Plan:</span> {sub.data?.tier ?? '…'}
        </p>
        <p>
          <span className="text-ink/60">Entitlement:</span>{' '}
          {sub.data?.entitlement ?? `not ${EVERREDI_PRO_ENTITLEMENT}`}
        </p>
        <p className="text-ink/60">
          Purchases are handled by RevenueCat on web and mobile. The API only trusts RevenueCat
          webhooks.
        </p>
        <button
          type="button"
          className="mt-4 rounded-md border border-ink/20 px-3 py-1.5"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = '/';
          }}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
