/**
 * Root layout — Helmer
 * Provides the HTML shell, Google Fonts (same three families as index.html),
 * global CSS, and metadata. Visual freeze: font families and links are identical
 * to the original index.html <head>.
 */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Helmer — Agents that show their work',
  description:
    'Run autonomous tasks you can watch, steer, and verify with hash-chained telemetry, chaos resiliency, and deterministic replay.',
  openGraph: {
    title: 'Helmer — Agents that show their work',
    description:
      'Run autonomous tasks you can watch, steer, and verify with hash-chained telemetry, chaos resiliency, and deterministic replay.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Same Google Fonts as index.html — Geist, Instrument Serif, JetBrains Mono */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Instrument+Serif:ital@1&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
