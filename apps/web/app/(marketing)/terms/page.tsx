import Link from 'next/link';
import { LegalLinks } from '@/components/legal-links';

const updated = 'July 23, 2026';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="font-display text-2xl font-bold">
        EverRedi
      </Link>
      <h1 className="mt-10 font-display text-4xl font-semibold">Terms of service</h1>
      <p className="mt-2 text-sm text-ink/55">Last updated {updated}</p>

      <div className="mt-8 space-y-6 text-ink/80">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Agreement</h2>
          <p>
            By creating an account or using EverRedi (the “Service”), you agree to these Terms,
            our{' '}
            <Link href="/privacy" className="underline">
              Privacy policy
            </Link>
            ,{' '}
            <Link href="/eula" className="underline">
              End-user license agreement (EULA)
            </Link>
            , and{' '}
            <Link href="/disclaimer" className="underline">
              Disclaimer
            </Link>
            . If you do not agree, do not use the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">The Service</h2>
          <p>
            EverRedi helps you track kits, inventory, locations, expirations, and related
            collaboration features. Features may change as we improve the product. Free and
            paid (Pro) plans may apply usage limits.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Accounts</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You must provide accurate account information and keep credentials secure.</li>
            <li>
              You are responsible for activity under your account and for content you or your
              workspace members add.
            </li>
            <li>
              You must be at least 13 years old (or the minimum age required where you live).
            </li>
            <li>
              Workspace owners and admins are responsible for managing member access and shared
              data.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Acceptable use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Violate law or others’ rights</li>
            <li>Attempt unauthorized access, disrupt, or reverse engineer the Service</li>
            <li>Abuse invitations, share links, or rate limits</li>
            <li>Upload malware or content that is unlawful or harmful</li>
            <li>Misrepresent EverRedi as medical, regulatory, or compliance certification</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Subscriptions and billing</h2>
          <p>
            Paid plans are offered through RevenueCat and the applicable app store or web
            billing channel. Prices, renewals, trials, and refunds follow the store’s and
            RevenueCat’s terms in addition to these Terms. Entitlements (for example{' '}
            <code className="rounded bg-white px-1 text-sm">everredi-pro</code>) control Pro
            features. We may change plan pricing with notice for renewals.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Your content</h2>
          <p>
            You retain ownership of content you submit. You grant us a worldwide, non-exclusive
            license to host, process, and display that content solely to operate and improve the
            Service. You represent you have the rights needed to submit it.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Intellectual property</h2>
          <p>
            EverRedi, including software, branding, and documentation, is owned by us or our
            licensors. Except for the limited license in the EULA, no rights are granted.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Termination</h2>
          <p>
            You may stop using the Service at any time. We may suspend or terminate access for
            breach, risk, non-payment, or prolonged inactivity. Provisions that should survive
            (including disclaimer, limitation of liability, and IP) will survive termination.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Disclaimers and liability</h2>
          <p>
            The Service is provided “as is” and “as available.” See the{' '}
            <Link href="/disclaimer" className="underline">
              Disclaimer
            </Link>{' '}
            for important limits on medical, safety, and compliance claims. To the fullest
            extent permitted by law, we disclaim warranties of merchantability, fitness for a
            particular purpose, and non-infringement, and our aggregate liability for claims
            relating to the Service is limited to the greater of (a) amounts you paid us for the
            Service in the 12 months before the claim or (b) USD $50.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Indemnity</h2>
          <p>
            You will defend and indemnify us against claims arising from your content, your use
            of the Service, or your breach of these Terms, except to the extent caused by our
            willful misconduct.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Governing law</h2>
          <p>
            These Terms are governed by the laws of the State of Texas, USA, excluding conflict
            of laws rules, unless mandatory consumer protections in your place of residence
            apply. Courts in Travis County, Texas have exclusive jurisdiction, subject to those
            mandatory protections.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Changes</h2>
          <p>
            We may update these Terms. Continued use after the effective date means you accept
            the updated Terms. Material changes may be announced in-product or by email when
            appropriate.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Contact</h2>
          <p>
            Questions:{' '}
            <a className="underline" href="mailto:support@everredi.app">
              support@everredi.app
            </a>
          </p>
        </section>
      </div>

      <LegalLinks className="mt-12" />
    </main>
  );
}
