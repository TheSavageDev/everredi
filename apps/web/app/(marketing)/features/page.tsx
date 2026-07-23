import Link from 'next/link';

export default function FeaturesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="font-display text-2xl font-bold">
        EverRedi
      </Link>
      <h1 className="mt-10 font-display text-4xl font-semibold">Built for prepared teams</h1>
      <ul className="mt-8 space-y-4 text-ink/80">
        <li>Workspace collaboration with many members and roles</li>
        <li>Kits, inventory, locations, and expiration alerts</li>
        <li>Templates to spin up home and vehicle kits fast</li>
        <li>Share links for quick access without messy handoffs</li>
        <li>Pro via RevenueCat on web and mobile</li>
      </ul>
    </main>
  );
}
