import Link from 'next/link';
import { LegalLinks } from '@/components/legal-links';

export function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-white/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="font-display text-lg font-bold">
            EverRedi
          </Link>
          <p className="mt-1 text-sm text-ink/65">
            Kit and inventory tracking for prepared people.
          </p>
          <p className="mt-2 text-sm text-ink/65">
            Support:{' '}
            <a className="underline underline-offset-2" href="mailto:support@everredi.app">
              support@everredi.app
            </a>
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <nav className="flex flex-wrap gap-4 text-ink/80">
            <Link href="/features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/login">Sign in</Link>
          </nav>
          <LegalLinks />
        </div>
      </div>
    </footer>
  );
}
