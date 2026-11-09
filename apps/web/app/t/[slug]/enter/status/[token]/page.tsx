import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { entryStatusCopy } from '@/lib/entry-status-copy';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageBody, PageHeader } from '@/components/page-header';
import styles from '../../enter.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return {
    title: dict.entryStatusTitle,
    robots: { index: false, follow: false },
  };
}

export default async function EntryStatusPage({
  params,
}: {
  readonly params: Promise<{ slug: string; token: string }>;
}) {
  const { slug, token } = await params;
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(token)) {
    notFound();
  }

  const locale = await currentLocale();
  const dict = dictionary(locale);
  const rows = await db()
    .select({
      tournamentId: schema.tournaments.id,
      status: schema.entrySubmissions.status,
      selections: schema.entrySubmissions.selections,
    })
    .from(schema.entrySubmissions)
    .innerJoin(schema.tournaments, eq(schema.tournaments.id, schema.entrySubmissions.tournamentId))
    .where(
      and(
        eq(schema.tournaments.organizationId, orgId()),
        eq(schema.tournaments.slug, slug),
        eq(schema.entrySubmissions.statusToken, token),
      ),
    )
    .limit(1);
  const submission = rows[0];
  if (submission === undefined) notFound();

  const selection =
    typeof submission.selections === 'object' && submission.selections !== null
      ? (submission.selections as Record<string, unknown>)
      : {};
  const eventId = typeof selection['eventId'] === 'string' ? selection['eventId'] : null;
  const partnerName =
    typeof selection['partnerName'] === 'string' ? selection['partnerName'] : undefined;
  const eventRows =
    submission.status === 'accepted' && eventId !== null
      ? await db()
          .select({ discipline: schema.events.discipline })
          .from(schema.events)
          .where(
            and(
              eq(schema.events.id, eventId),
              eq(schema.events.tournamentId, submission.tournamentId),
            ),
          )
          .limit(1)
      : [];
  const isDoubles = eventRows[0]?.discipline === 'doubles';

  const confirmation = entryStatusCopy(
    submission.status,
    isDoubles ? 'doubles' : 'singles',
    partnerName,
    dict,
  );

  return (
    <main className={styles.page}>
      <PageHeader
        back={{ href: `/t/${slug}/enter`, label: dict.enterTitle }}
        title={dict.entryStatusTitle}
        actions={<LanguageToggle active={locale} />}
      />
      <PageBody width="measure">
        <div className={styles.done} role="status">
          <p className={styles.doneTitle}>{confirmation.heading}</p>
          <p className={styles.doneBody}>{confirmation.message}</p>
        </div>
        <SiteFooter />
      </PageBody>
    </main>
  );
}
