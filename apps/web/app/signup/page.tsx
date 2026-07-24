'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getApi } from '@/lib/api';
import { LegalAcceptanceCopy, LegalLinks } from '@/components/legal-links';
import { SocialAuthButtons } from '@/components/social-auth-buttons';
import { createClient } from '@/lib/supabase/client';
import { useWorkspaceStore } from '@/stores/workspace-store';

export default function SignupPage() {
  const router = useRouter();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accepted) {
      setError('Please accept the terms to continue');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      const bootstrap = await fetch('/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      const payload = (await bootstrap.json()) as {
        success?: boolean;
        data?: { workspace: Parameters<typeof setWorkspace>[0] };
        message?: string;
        error?: string;
      };
      if (!bootstrap.ok || !payload.data?.workspace) {
        const { workspace } = await getApi().auth.createOrUpdate({ displayName });
        setWorkspace(workspace);
      } else {
        setWorkspace(payload.data.workspace);
      }
      router.push('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="font-display text-3xl font-bold">
        EverRedi
      </Link>
      <h1 className="mt-8 text-2xl font-semibold">Create your account</h1>

      <div className="mt-6">
        <SocialAuthButtons
          disabled={loading || !accepted}
          onError={(message) => setError(message || null)}
        />
        {!accepted ? (
          <p className="mt-2 text-xs text-ink/55">Accept the legal terms below to use Google or Apple.</p>
        ) : null}
      </div>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-ink/45">
        <span className="h-px flex-1 bg-ink/15" />
        or email
        <span className="h-px flex-1 bg-ink/15" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full rounded-md border border-ink/15 bg-white px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <label className="flex items-start gap-2 text-sm text-ink/75">
          <input
            type="checkbox"
            className="mt-1"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            required
          />
          <LegalAcceptanceCopy />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading || !accepted}
          className="w-full rounded-md bg-accent py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink/70">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
      <LegalLinks className="mt-8" />
    </main>
  );
}
