'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Provider = 'google' | 'apple';

type Props = {
  disabled?: boolean;
  onError?: (message: string) => void;
};

export function SocialAuthButtons({ disabled, onError }: Props) {
  const [loading, setLoading] = useState<Provider | null>(null);

  async function signIn(provider: Provider) {
    setLoading(provider);
    onError?.('');
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/auth/complete')}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams:
            provider === 'google'
              ? { access_type: 'offline', prompt: 'consent' }
              : undefined,
        },
      });
      if (error) throw error;
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Social sign in failed');
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled || loading !== null}
        onClick={() => void signIn('google')}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-ink/15 bg-white py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
      >
        <GoogleIcon />
        {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </button>
      <button
        type="button"
        disabled={disabled || loading !== null}
        onClick={() => void signIn('apple')}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-ink/15 bg-ink py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        <AppleIcon />
        {loading === 'apple' ? 'Redirecting…' : 'Continue with Apple'}
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.2 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l.1.1 6.3 5.2C36.9 41.4 44 36 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" fill="currentColor">
      <path d="M12.8 9.5c0-2 1.6-3 1.7-3.1-0.9-1.3-2.4-1.5-2.9-1.5-1.2-0.1-2.4 0.7-3 0.7s-1.6-0.7-2.6-0.7c-1.3 0-2.6 0.8-3.3 2-1.4 2.4-0.4 6 1 8 0.7 0.9 1.5 2 2.6 2 1 0 1.4-0.7 2.7-0.7s1.6 0.7 2.7 0.7c1.1 0 1.8-0.9 2.5-1.9 0.8-1.1 1.1-2.2 1.1-2.3-0.1 0-2-0.8-2.2-3.2zM10.6 3.6c0.6-0.7 1-1.7 0.9-2.6-0.8 0-1.9 0.6-2.5 1.3-0.5 0.6-1 1.6-0.9 2.5 1 0.1 1.9-0.5 2.5-1.2z" />
    </svg>
  );
}
