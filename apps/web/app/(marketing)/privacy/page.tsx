import Link from 'next/link';
import { LegalLinks } from '@/components/legal-links';

const updated = 'July 23, 2026';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="font-display text-2xl font-bold">
        EverRedi
      </Link>
      <h1 className="mt-10 font-display text-4xl font-semibold">Privacy policy</h1>
      <p className="mt-2 text-sm text-ink/55">Last updated {updated}</p>

      <div className="mt-8 space-y-6 text-ink/80">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Who we are</h2>
          <p>
            EverRedi (“we”, “us”) provides kit and inventory tracking software. This policy
            explains what personal data we collect, how we use it, and the choices you have.
            Contact:{' '}
            <a className="underline" href="mailto:support@everredi.app">
              support@everredi.app
            </a>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Data we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Account data: email address, display name, and authentication identifiers from
              email/password, Google, or Apple sign-in.
            </li>
            <li>
              Workspace content you create: kits, inventory, locations, templates, share links,
              alerts preferences, and membership roles.
            </li>
            <li>
              Technical data: device/app type, IP address, approximate location derived from IP,
              cookies or similar tokens for session auth, and basic product analytics (for
              example page views and performance).
            </li>
            <li>
              Billing and entitlement signals from our subscription partner (RevenueCat) needed
              to enforce Pro access — we do not store full payment card numbers.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">How we use data</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Provide, secure, and improve the EverRedi service</li>
            <li>Authenticate you and manage workspace membership</li>
            <li>Send transactional messages (for example invitations and security notices)</li>
            <li>Enforce free-tier limits and Pro entitlements</li>
            <li>Detect abuse, bots, and fraud</li>
            <li>Comply with law and respond to lawful requests</li>
          </ul>
          <p>We do not sell personal data.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Processors and subprocessors</h2>
          <p>
            We use trusted vendors to host and operate EverRedi, including cloud hosting
            (Vercel), authentication and database (Supabase), analytics (Vercel Analytics /
            Speed Insights), file storage (Vercel Blob), and subscription management
            (RevenueCat). Those providers process data only to provide their services to us.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Cookies and local storage</h2>
          <p>
            We use cookies and similar storage for authentication sessions and essential
            product function. Analytics may use first-party or vendor cookies as described by
            those tools. You can clear cookies in your browser; doing so will sign you out.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Retention</h2>
          <p>
            We retain account and workspace data while your account is active. After deletion
            requests, we delete or anonymize personal data within a reasonable period unless we
            must retain it for legal, security, or dispute-resolution reasons. Backups may
            persist for a limited window.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Your rights</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, export, or
            delete personal data, and to object to or restrict certain processing. Email{' '}
            <a className="underline" href="mailto:support@everredi.app">
              support@everredi.app
            </a>{' '}
            to make a request. We may need to verify your identity first.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Children</h2>
          <p>
            EverRedi is not directed to children under 13 (or the equivalent minimum age in
            your region). We do not knowingly collect personal data from children.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">International transfers</h2>
          <p>
            We may process data in the United States and other countries where our providers
            operate. Where required, we rely on appropriate transfer mechanisms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Changes</h2>
          <p>
            We may update this policy. We will revise the “Last updated” date and, for material
            changes, provide additional notice when appropriate.
          </p>
        </section>
      </div>

      <LegalLinks className="mt-12" />
    </main>
  );
}
