import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="font-display text-3xl font-bold">
        EverRedi
      </Link>
      <h1 className="mt-8 text-2xl font-semibold">Sign in could not be completed</h1>
      <p className="mt-4 text-sm text-ink/70">
        The OAuth provider did not return a valid session. Confirm Google and Apple are enabled in
        Supabase Auth, and that redirect URLs include this site&apos;s{' '}
        <code className="rounded bg-white px-1 py-0.5 text-xs">/auth/callback</code> path.
      </p>
      <Link
        href="/login"
        className="mt-8 inline-flex w-fit rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white"
      >
        Back to sign in
      </Link>
    </main>
  );
}
