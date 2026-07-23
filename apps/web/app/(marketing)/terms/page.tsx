import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/">EverRedi</Link>
      <h1 className="mt-8 font-display text-4xl font-semibold">Terms</h1>
      <p className="mt-4 text-ink/80">
        EverRedi is provided as-is for inventory tracking. It is not a substitute for professional
        medical advice or compliance certification.
      </p>
    </main>
  );
}
