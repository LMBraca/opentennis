import type { Metadata, Viewport } from 'next';
import './globals.css';

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
  // scaling is an accessibility failure. See docs/design-system.md section 6.
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
