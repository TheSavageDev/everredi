import Link from 'next/link';
import { LegalLinks } from '@/components/legal-links';

const updated = 'July 23, 2026';

export default function EulaPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="font-display text-2xl font-bold">
        EverRedi
      </Link>
      <h1 className="mt-10 font-display text-4xl font-semibold">
        End-user license agreement
      </h1>
      <p className="mt-2 text-sm text-ink/55">Last updated {updated}</p>

      <div className="mt-8 space-y-6 text-ink/80">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">License grant</h2>
          <p>
            Subject to the{' '}
            <Link href="/terms" className="underline">
              Terms of service
            </Link>{' '}
            and this EULA, EverRedi grants you a personal, limited, non-exclusive,
            non-transferable, revocable license to install and use the EverRedi web and mobile
            applications for your own lawful inventory-tracking purposes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">License restrictions</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Do not copy, modify, distribute, sell, lease, or sublicense the software except as allowed by law.</li>
            <li>Do not reverse engineer, decompile, or attempt to extract source code except where mandatory law permits.</li>
            <li>Do not remove proprietary notices or circumvent technical protections.</li>
            <li>Do not use the apps to provide a competing hosted service built primarily on EverRedi.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">App stores</h2>
          <p>
            If you downloaded EverRedi from the Apple App Store or Google Play, that store’s
            standard terms also apply. Apple and Google are not parties to this EULA and have no
            obligation to provide maintenance or support for EverRedi. To the extent required by
            store rules, Apple and its subsidiaries are third-party beneficiaries of this EULA
            and may enforce it against you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Updates</h2>
          <p>
            We may provide updates that change features or requirements. Some updates may be
            required to continue using the Service. Failure to update may limit functionality or
            security.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Ownership</h2>
          <p>
            The software and all related IP remain ours or our licensors’. This EULA does not
            transfer ownership. Feedback you provide may be used freely without obligation to
            you.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Termination</h2>
          <p>
            This license ends when your account ends or when we terminate access under the
            Terms. On termination you must stop using the apps and delete local copies where
            reasonably practicable.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-ink">Warranty and liability</h2>
          <p>
            The software is licensed “as is.” Warranty disclaimers and liability limits in the
            Terms and{' '}
            <Link href="/disclaimer" className="underline">
              Disclaimer
            </Link>{' '}
            apply to this EULA.
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
