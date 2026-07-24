import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from '@/components/providers';
import { getFlags } from '@/lib/flags';

export const metadata: Metadata = {
  title: 'EverRedi',
  description: 'Kit and inventory tracking for prepared people',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Edge middleware is not supported with Vercel Services — gate in Node instead.
  const flags = await getFlags();
  if (flags.maintenanceMode) {
    return (
      <html lang="en">
        <body>
          <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
            <p className="font-display text-3xl font-bold">EverRedi</p>
            <p className="mt-4 text-ink/80">
              EverRedi is undergoing maintenance. Please try again shortly.
            </p>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
