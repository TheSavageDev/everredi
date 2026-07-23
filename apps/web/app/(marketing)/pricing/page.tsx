import Link from 'next/link';

const plans = [
  {
    name: 'Free',
    price: '$0',
    detail: '5 kits, 100 items, 2 locations, 3 members',
  },
  {
    name: 'Pro monthly',
    price: '$4.99',
    detail: 'Unlimited kits and items, higher member caps',
  },
  {
    name: 'Pro yearly',
    price: '$39.99',
    detail: 'Two months free versus monthly',
  },
  {
    name: 'Lifetime',
    price: '$99.99',
    detail: 'Pay once for Pro forever',
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link href="/" className="font-display text-2xl font-bold text-ink">
        EverRedi
      </Link>
      <h1 className="mt-10 font-display text-4xl font-semibold">Simple pricing</h1>
      <p className="mt-3 text-ink/70">Start free. Upgrade when your kits outgrow the free tier.</p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.name} className="rounded-2xl border border-ink/10 bg-white/70 p-6">
            <h2 className="font-display text-2xl font-semibold">{plan.name}</h2>
            <p className="mt-2 text-3xl font-bold text-accent">{plan.price}</p>
            <p className="mt-2 text-sm text-ink/70">{plan.detail}</p>
          </article>
        ))}
      </div>
      <Link href="/signup" className="mt-10 inline-block rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white">
        Start free
      </Link>
    </main>
  );
}
