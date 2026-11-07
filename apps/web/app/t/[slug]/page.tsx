/**
 * Tournament landing — now a redirect to the first draw.
 *
 * This used to be a category grid: a page whose entire job was to let you
 * pick a draw. The draw page already carries a DrawSwitcher that does the
 * same thing without a round trip, so the grid was a mandatory stop between
 * wanting a draw and seeing one. It is gone by request.
 *
 * The ROUTE stays, and that part is not optional. /t/:slug is what the club
 * prints on QR codes and posts on social, and the spec promises those keep
 * working for the life of the tournament (PRD §4.4, §9.1). Deleting the
 * route would 404 every poster already taped to a clubhouse wall. So it
 * resolves the first draw in ladder order and sends you there.
 *
 * Fallbacks, in order: the first published draw; otherwise the entry form if
 * entries are open; otherwise a short "nothing published yet" page, because a
 * redirect with nowhere to go is a loop.
 */

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { drawPreviews } from '@/lib/queries';
import { drawSegment, type Discipline, type Division } from '@/lib/divisions';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader, PageBody } from '@/components/page-header';
import { SiteNav } from '@/components/site-nav';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import styles from './tournament.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
}

async function loadTournament(slug: string) {
  const rows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      visibility: schema.tournaments.visibility,
      entriesOpen: schema.tournaments.entriesOpen,
    })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, orgId()), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);
  return rows[0];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await loadTournament(slug);
  const dict = dictionary(await currentLocale());
  return {
    title:
      tournament === undefined || tournament.visibility === 'draft'
        ? dict.notFoundTitle
        : tournament.name,
  };
}

export default async function TournamentPage({ params }: Params) {
  const { slug } = await params;
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const tournament = await loadTournament(slug);

  // A draft tournament is not public. 404 rather than 403: the existence of
  // an unpublished draw is itself not public information.
  if (tournament === undefined || tournament.visibility === 'draft') notFound();

  // Already ordered by category rank, so "first" is the top of the ladder
  // rather than whatever the database happened to return first.
  const draws = await drawPreviews(tournament.id);
  const first = draws[0];

  if (first !== undefined) {
    redirect(
      `/t/${slug}/${first.categorySlug}/${drawSegment(
        first.division as Division,
        first.discipline as Discipline,
      )}`,
    );
  }

  if (tournament.entriesOpen) redirect(`/t/${slug}/enter`);

  return (
    <main className={styles.page}>
      <PageHeader
        title={tournament.name}
        nav={<SiteNav dict={dict} />}
        actions={<LanguageToggle active={locale} />}
      />
      <PageBody>
        <p className={styles.empty}>{dict.noDraws}</p>
        <SiteFooter />
      </PageBody>
    </main>
  );
}
