import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { LanguageToggle } from '@/components/language-toggle';
import { EnterForm } from './enter-form';
import styles from './enter.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Enter · ${slug}` };
}

export default async function EnterPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ slug: string }>;
  readonly searchParams: Promise<{ c?: string; d?: string }>;
}) {
  const { slug } = await params;
  const { c, d } = await searchParams;
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const organizationId = orgId();

  const rows = await db()
    .select({
      id: schema.tournaments.id,
      name: schema.tournaments.name,
      entriesOpen: schema.tournaments.entriesOpen,
      visibility: schema.tournaments.visibility,
      startDate: schema.tournaments.startDate,
    })
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);

  const tournament = rows[0];
  if (tournament === undefined) notFound();

  /*
   * Registration does NOT require the tournament to be public.
   *
   * The normal order is: create a draft, open entries, gather entrants,
   * generate the draws, then publish. Gating this page on visibility made the
   * registration link 404 for exactly the tournaments that needed it most --
   * the ones not yet published. `entriesOpen` is the flag that governs this,
   * and it is deliberately independent of visibility.
   *
   * A draft with entries closed has nothing to show anyone, so that still 404s.
   */
  const isDraft = tournament.visibility === 'draft';
  if (isDraft && !tournament.entriesOpen) notFound();

  const events = await db()
    .select({
      id: schema.events.id,
      discipline: schema.events.discipline,
      status: schema.events.status,
      code: schema.categories.code,
      categorySlug: schema.categories.slug,
      rank: schema.categories.rank,
    })
    .from(schema.events)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.events.categoryId))
    .where(eq(schema.events.tournamentId, tournament.id))
    .orderBy(asc(schema.categories.rank), asc(schema.events.discipline));

  const open = events.filter((e) => e.status !== 'notRun');

  // A QR printed for one cell pre-selects it (PRD §4.4).
  const preselected =
    open.find((e) => e.categorySlug === c && e.discipline === d)?.id ?? '';

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            {isDraft ? (
              <span className={styles.back}>{tournament.name}</span>
            ) : (
              <Link href={`/t/${slug}`} className={styles.back}>
                ← {tournament.name}
              </Link>
            )}
            <LanguageToggle active={locale} />
          </div>
          <h1 className={styles.title}>
            {locale === 'es' ? 'Inscripción' : 'Enter the tournament'}
          </h1>
          <p className={styles.sub}>
            {locale === 'es'
              ? 'Elige tu cuadro y deja tus datos. Paga la inscripción en recepción.'
              : 'Pick your draw and leave your details. Pay the entry fee at the desk.'}
          </p>
        </div>
      </header>

      <div className={styles.content}>
        {!tournament.entriesOpen ? (
          // A printed QR outlives the entry window, so this says what happened
          // and points somewhere useful rather than 404ing.
          <div className={styles.closed}>
            <p className={styles.closedTitle}>
              {locale === 'es' ? 'Inscripciones cerradas' : 'Entries are closed'}
            </p>
            <p className={styles.closedBody}>
              {locale === 'es'
                ? 'Este torneo ya no acepta inscripciones.'
                : 'This tournament is no longer accepting entries.'}
            </p>
            {!isDraft && (
              <Link href={`/t/${slug}`} className={styles.closedLink}>
                {locale === 'es' ? 'Ver los cuadros →' : 'View the draws →'}
              </Link>
            )}
          </div>
        ) : open.length === 0 ? (
          <p className={styles.closedBody}>{dict.noDraws}</p>
        ) : (
          <EnterForm
            slug={slug}
            locale={locale}
            preselected={preselected}
            showDrawsLink={!isDraft}
            draws={open.map((e) => ({
              id: e.id,
              label: `${e.code} ${e.discipline === 'singles' ? dict.singles : dict.doubles}`,
              discipline: e.discipline,
            }))}
          />
        )}
      </div>
    </main>
  );
}
