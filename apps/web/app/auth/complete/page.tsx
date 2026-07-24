'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace-store';

export default function AuthCompletePage() {
  const router = useRouter();
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      try {
        const bootstrap = await fetch('/api/auth/bootstrap', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        const payload = (await bootstrap.json()) as {
          data?: { workspace: Parameters<typeof setWorkspace>[0] };
          message?: string;
          error?: string;
        };
        if (!bootstrap.ok || !payload.data?.workspace) {
          const { workspace } = await getApi().auth.createOrUpdate();
          if (cancelled) return;
          setWorkspace(workspace);
        } else {
          if (cancelled) return;
          setWorkspace(payload.data.workspace);
        }
        router.replace('/app');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not finish sign in');
      }
    }

    void complete();
    return () => {
      cancelled = true;
    };
  }, [router, setWorkspace]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="font-display text-3xl font-bold">
        EverRedi
      </Link>
      <h1 className="mt-8 text-2xl font-semibold">Finishing sign in</h1>
      {error ? (
        <p className="mt-4 text-sm text-red-600">
          {error}.{' '}
          <Link href="/login" className="underline">
            Try again
          </Link>
        </p>
      ) : (
        <p className="mt-4 text-sm text-ink/70">Setting up your workspace…</p>
      )}
    </main>
  );
}
