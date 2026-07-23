import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1584036561566-bca24d6b1f3a?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/30" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <p className="font-display text-3xl font-bold tracking-tight text-white">EverRedi</p>
          <nav className="flex gap-4 text-sm text-white/90">
            <Link href="/pricing">Pricing</Link>
            <Link href="/features">Features</Link>
            <Link href="/login" className="rounded-md bg-white px-3 py-1.5 font-medium text-ink">
              Sign in
            </Link>
          </nav>
        </header>
        <section className="mt-auto mb-24 max-w-xl">
          <h1 className="font-display text-5xl font-semibold leading-tight text-white md:text-6xl">
            Know what is in every kit — before you need it
          </h1>
          <p className="mt-5 max-w-md text-lg text-white/85">
            Track supplies, expirations, and completeness across home, vehicle, and team kits with your whole crew.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/signup"
              className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/30"
            >
              Start free
            </Link>
            <Link
              href="/features"
              className="rounded-md border border-white/40 px-5 py-3 text-sm font-semibold text-white"
            >
              See how it works
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
