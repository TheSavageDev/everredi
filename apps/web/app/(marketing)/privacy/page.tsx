import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 prose">
      <Link href="/">EverRedi</Link>
      <h1>Privacy</h1>
      <p>
        EverRedi stores account and inventory data to provide the service. We do not sell personal
        data. Contact support for deletion requests.
      </p>
    </main>
  );
}
