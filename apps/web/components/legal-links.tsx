import Link from 'next/link';

const links = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/eula', label: 'EULA' },
  { href: '/disclaimer', label: 'Disclaimer' },
] as const;

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-xs text-ink/60 ${className}`}>
      {links.map((link, i) => (
        <span key={link.href}>
          {i > 0 ? <span aria-hidden="true"> · </span> : null}
          <Link href={link.href} className="underline underline-offset-2 hover:text-ink">
            {link.label}
          </Link>
        </span>
      ))}
    </p>
  );
}

export function LegalAcceptanceCopy() {
  return (
    <span>
      I agree to the{' '}
      <Link href="/terms" className="underline underline-offset-2">
        Terms of service
      </Link>
      ,{' '}
      <Link href="/privacy" className="underline underline-offset-2">
        Privacy policy
      </Link>
      , and{' '}
      <Link href="/eula" className="underline underline-offset-2">
        EULA
      </Link>
      , and I acknowledge the{' '}
      <Link href="/disclaimer" className="underline underline-offset-2">
        Disclaimer
      </Link>
      .
    </span>
  );
}
