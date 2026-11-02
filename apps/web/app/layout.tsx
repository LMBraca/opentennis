import type { Metadata, Viewport } from 'next';
import { Archivo, Instrument_Sans, Martian_Mono } from 'next/font/google';
import './globals.css';
import './tokens.css';

/**
 * Archivo carries both display personalities: headlines use the expanded width
 * axis, scores use the condensed axis. One family, two voices — which is what
 * makes the scoreboard feel native to the brand rather than bolted on.
 */
const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-archivo',
});

const instrument = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument',
});

const martian = Martian_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-martian',
});

export const metadata: Metadata = {
  title: {
    default: 'OpenTennis',
    template: '%s · OpenTennis',
  },
  description: 'Tennis tournament management — draws, live scores, and results.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never block pinch-zoom: the bracket depends on it, and clamping user
  // scaling is an accessibility failure. See docs/design-system.md §6.
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${instrument.variable} ${martian.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
