/**
 * QR codes for a tournament.
 *
 * The club's entrants arrive from a poster on the clubhouse wall, a card on
 * the desk and a link in a story. Each placement gets its OWN code carrying
 * a different `?src=`, so the only question worth asking — which one is
 * actually bringing people in — has an answer that does not need cookies or
 * a tracking script. The label is one word the club chose; there is no
 * identifier in it and nothing follows the person afterwards.
 *
 * Rendered server-side as inline SVG. A QR code is a static image of a
 * string we already know, so shipping a generator to the browser to redraw
 * it would be work for no one's benefit — and SVG prints at whatever size
 * the paper is, which is the entire point of a poster.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import QRCode from 'qrcode';
import { and, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { PageHeader, PageBody } from '@/components/page-header';
import adminStyles from '../../admin.module.css';
import styles from './qr.module.css';

export const metadata: Metadata = { title: 'QR codes · Admin' };
export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
}

/**
 * Error correction Q (25%). A code taped to a clubhouse wall gets rained
 * on, sun-bleached and thumbed; L would save a few modules and fail the
 * first time somebody puts a drawing pin through a corner.
 */
const QR_OPTIONS = { errorCorrectionLevel: 'Q', margin: 1, width: 512 } as const;

const PLACEMENTS = [
  { src: 'poster', label: 'Poster', hint: 'Clubhouse wall, noticeboard' },
  { src: 'desk', label: 'Desk card', hint: 'Reception, next to the sign-up sheet' },
  { src: 'social', label: 'Social', hint: 'Instagram story, WhatsApp group' },
  { src: 'court', label: 'Courtside', hint: 'Fence banner, net post' },
] as const;

export default async function QrPage({ params }: Params) {
  const { slug } = await params;
  await requireUser(`/admin/${slug}/qr`);

  const rows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      entriesOpen: schema.tournaments.entriesOpen,
      visibility: schema.tournaments.visibility,
    })
    .from(schema.tournaments)
    .where(and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)))
    .limit(1);
  const tournament = rows[0];
  if (tournament === undefined) notFound();

  /*
   * An absolute URL, built from the request. A QR code containing a
   * relative path is useless, and hardcoding the host would print a
   * thousand posters pointing at localhost.
   */
  const head = await headers();
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3000';
  const proto = head.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const base = `${proto}://${host}`;

  const targets = [
    ...PLACEMENTS.map((p) => ({
      ...p,
      url: `${base}/t/${slug}/enter?src=${p.src}`,
      kind: 'Entry form' as const,
    })),
    {
      src: 'draws',
      label: 'Draws',
      hint: 'For spectators — the live draws and results',
      url: `${base}/t/${slug}`,
      kind: 'Draws' as const,
    },
  ];

  const codes = await Promise.all(
    targets.map(async (t) => ({
      ...t,
      svg: await QRCode.toString(t.url, { ...QR_OPTIONS, type: 'svg' }),
    })),
  );

  return (
    <main className={adminStyles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title="QR codes"
        lead={
          tournament.entriesOpen
            ? 'Each code carries its own label, so the entrants list shows where people came from.'
            : 'Entries are closed, so the entry codes will show the closed page until you reopen them.'
        }
      />
      <PageBody>
        <div className={styles.actions}>
          <p className={styles.note}>
            Print this page for a sheet of codes, or right-click a code to save it. They are
            vector images, so they stay sharp at any size.
          </p>
        </div>

        <ul className={styles.sheet}>
          {codes.map((code) => (
            <li key={code.src} className={styles.card}>
              {/*
                The SVG comes from the qrcode library, not from user input —
                it is a drawing of a URL this page constructed itself.
              */}
              <div className={styles.code} dangerouslySetInnerHTML={{ __html: code.svg }} />
              <div className={styles.caption}>
                <span className={styles.label}>{code.label}</span>
                <span className={styles.kind}>{code.kind}</span>
                <span className={styles.hint}>{code.hint}</span>
                <span className={styles.url}>{code.url}</span>
              </div>
            </li>
          ))}
        </ul>
      </PageBody>
    </main>
  );
}
