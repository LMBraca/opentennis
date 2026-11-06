import type { Metadata, Viewport } from 'next';
import { currentLocale } from '@/lib/i18n/server';
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
  description: 'Open Tennis — torneos, cuadros y resultados.',
  /*
   * No `icons` key on purpose. Next picks up app/icon.png, app/apple-icon.png
   * and app/favicon.ico by file convention, and an explicit `icons` entry
   * OVERRIDES the convention rather than adding to it — which is how the
   * Apple touch icon ended up pointing at the 884 KB full badge.
   *
   * Those three are the BALL alone, cropped out of the badge. The full badge
   * carries "OPEN TENNIS" around a ring: legible at 512px, an unreadable
   * smudge at the 16-32px a browser tab actually draws. A favicon is a mark,
   * not a lockup.
   */
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Never block pinch-zoom: the bracket depends on it, and clamping user
  // scaling is an accessibility failure. See docs/design-system.md §6.
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The html lang attribute must track the chosen locale: screen readers pick
  // their voice from it, and hyphenation rules differ between en and es.
  const locale = await currentLocale();
  return (
    <html
      lang={locale}
      className={`${archivo.variable} ${instrument.variable} ${martian.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
