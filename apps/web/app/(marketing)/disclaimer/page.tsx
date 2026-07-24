import Link from 'next/link';
import { LegalLinks } from '@/components/legal-links';

const updated = 'July 23, 2026';

export default function DisclaimerPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="font-display text-2xl font-bold">
        EverRedi
      </Link>
      <h1 className="mt-10 font-display text-4xl font-semibold">Disclaimer</h1>
      <p className="mt-2 text-sm text-ink/55">Last updated {updated}</p>

      <div className="mt-8 space-y-6 text-ink/80">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Not medical advice</h2>
          <p>
            EverRedi is an inventory and preparedness tracking tool. It is not a medical device
            and does not provide medical advice, diagnosis, treatment recommendations, emergency
            instructions, or first-aid training. Always follow guidance from qualified
            clinicians, product labels, and official emergency services.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Not compliance certification</h2>
          <p>
            Using EverRedi does not certify that your kits, workplace, vehicles, or organization
            meet OSHA, FDA, ISO, school, military, or any other regulatory or accreditation
            requirement. You remain solely responsible for compliance decisions and audits.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Accuracy of your data</h2>
          <p>
            Alerts, quantities, expirations, and completeness scores depend on information you
            and your collaborators enter. We do not independently verify physical inventory.
            Missed alerts, incorrect entries, or sync delays can occur. Do not rely on EverRedi
            as your only safety control.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Emergency situations</h2>
          <p>
            In an emergency, call your local emergency number. Do not delay seeking help because
            of information (or missing information) in EverRedi.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">No warranty of outcomes</h2>
          <p>
            We do not warrant that use of EverRedi will prevent injury, loss, stockouts, or
            expired supplies. The Service is provided “as is” as further described in the{' '}
            <Link href="/terms" className="underline">
              Terms of service
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Third-party content</h2>
          <p>
            Templates, catalog suggestions, and linked third-party materials are provided for
            convenience and may be incomplete or outdated. Verify all product and safety
            information with manufacturers and authoritative sources.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Contact</h2>
          <p>
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
