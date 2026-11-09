/**
 * Home.
 *
 * Lists the organization's tournaments and links into each.
 *
 * An earlier revision redirected straight into the only published tournament,
 * on the theory that a list of one is not a choice. That was wrong: it meant
 * the site had no home page at all, and landing somewhere you did not ask for
 * reads as a broken link rather than a shortcut. The list is always shown.
 */

import Link from 'next/link';
import {
  listTournaments,
  listUpdates,
  type TournamentSummary,
  type UpdateSummary,
} from '@/lib/queries';
import { excerptFrom } from '@/lib/markdown';
import { SiteNav } from '@/components/site-nav';
import { LiveDot } from '@/components/category-chip';
import { LanguageToggle } from '@/components/language-toggle';
import { SiteFooter } from '@/components/brand-header';
import { PageHeader, PageBody } from '@/components/page-header';
import { Reveal } from '@/components/reveal';
import { drawPreviews } from '@/lib/queries';
import { drawLabel, drawSegment, type Discipline, type Division } from '@/lib/divisions';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary, intlLocale, type Dictionary } from '@/lib/i18n/dictionaries';
import {
  tournamentCalendarDateFormatter,
  tournamentDateRange,
  venueArticleDateFormatter,
} from '@/lib/venue-time';
import styles from './home.module.css';

export const dynamic = 'force-dynamic';

/**
 * Tournament dates are plain calendar dates stored as text; keep those on
 * UTC, while article publication instants use the venue's timezone below.
 */
function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/* Moved to lib/venue-time as `tournamentDateRange` when the OT-17 overview
   needed the same range — a third copy of this was one too many. */
const dateRange = tournamentDateRange;

function DateTile({ start, locale }: { readonly start: string | null; readonly locale: string }) {
  if (start === null) {
    return (
      <div className={styles.dateTile}>
        <span className={styles.dateMonth}>TBD</span>
      </div>
    );
  }
  const date = parseDate(start);
  return (
    <div className={styles.dateTile}>
      <span className={styles.dateDay}>
        {tournamentCalendarDateFormatter(locale, { day: 'numeric' }).format(date)}
      </span>
      <span className={styles.dateMonth}>
        {tournamentCalendarDateFormatter(locale, { month: 'short' }).format(date)}
      </span>
    </div>
  );
}

/** The rows, without a heading of their own. */
function TournamentRows({
  items,
  dict,
  locale,
}: {
  readonly items: readonly TournamentSummary[];
  readonly dict: Dictionary;
  readonly locale: string;
}) {
  return (
      <ul className={styles.list}>
        {items.map((t, i) => (
          <li key={t.id}>
            {/* Staggered so a list arrives in order rather than all at once.
                Does nothing at the off tier. */}
            <Reveal delay={i * 60}>
            <Link href={`/t/${t.slug}`} className={styles.card}>
              <DateTile start={t.startDate} locale={locale} />
              <div className={styles.cardBody}>
                <span className={styles.cardMeta}>
                  {dateRange(t.startDate, t.endDate, locale)}
                </span>
                <span className={styles.cardName}>{t.name}</span>
                <span className={styles.cardStats}>
                  <span className={styles.stat}>
                    <span className={styles.statNumber}>{t.drawCount}</span>
                    <span className={styles.statLabel}>
                      {t.drawCount === 1 ? dict.draw : dict.draws}
                    </span>
                  </span>
                  <span className={styles.stat}>
                    <span className={styles.statNumber}>{t.entrantCount}</span>
                    <span className={styles.statLabel}>{dict.entrants}</span>
                  </span>
                  {t.liveCount > 0 && <LiveDot />}
                </span>
              </div>
            </Link>
            </Reveal>
          </li>
        ))}
      </ul>
  );
}

function Section({
  title,
  items,
  dict,
  locale,
}: {
  readonly title: string;
  readonly items: readonly TournamentSummary[];
  readonly dict: Dictionary;
  readonly locale: string;
}) {
  if (items.length === 0) return null;
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <TournamentRows items={items} dict={dict} locale={locale} />
    </section>
  );
}

/** A hand-written excerpt wins; otherwise fall back to the first paragraph. */
function teaserFor(update: UpdateSummary): string {
  return update.excerpt ?? excerptFrom(update.body, 120);
}

/** The headline card: what is being played, with its draws one tap away. */
async function FeatureCard({
  tournament,
  dict,
  locale,
}: {
  readonly tournament: TournamentSummary;
  readonly dict: Dictionary;
  readonly locale: string;
}) {
  const draws = await drawPreviews(tournament.id);

  return (
    <article className={styles.feature}>
      <div className={styles.featureHead}>
        <span className={styles.featureMeta}>
          {dateRange(tournament.startDate, tournament.endDate, locale)}
        </span>
        <Link href={`/t/${tournament.slug}`} className={styles.featureName}>
          {tournament.name}
        </Link>
      </div>

      {/* A summary, not a bracket: a full draw at this size would be
          unreadable and would cost as much as the page it links to. */}
      {draws.length > 0 && (
        <ul className={styles.drawList}>
          {draws.map((d) => (
            <li key={`${d.categorySlug}-${d.division}-${d.discipline}`}>
              <Link
                href={`/t/${tournament.slug}/${d.categorySlug}/${drawSegment(
                  d.division as Division,
                  d.discipline as Discipline,
                )}`}
                className={styles.drawChip}
              >
                <span className={styles.drawName}>
                  {drawLabel(d.categoryCode, d.division as Division, d.discipline as Discipline, dict)}
                </span>
                <span className={styles.drawCount}>
                  {d.entrantCount}
                  <span className={styles.drawUnit}>
                    {d.entrantCount === 1 ? dict.entrant : dict.entrants}
                  </span>
                </span>
                {d.liveCount > 0 && <LiveDot />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default async function Home() {
  const locale = await currentLocale();
  const dict = dictionary(locale);
  const intl = intlLocale(locale);
  const [tournaments, updates] = await Promise.all([listTournaments(), listUpdates(2)]);

  const live = tournaments.filter((t) => t.status === 'inProgress' || t.liveCount > 0);
  const liveIds = new Set(live.map((t) => t.id));
  const past = tournaments.filter((t) => t.status === 'complete' && !liveIds.has(t.id));
  const pastIds = new Set(past.map((t) => t.id));
  const upcoming = tournaments.filter((t) => !liveIds.has(t.id) && !pastIds.has(t.id));

  /*
   * RV-8: the feature card means "being played right now", and nothing else.
   *
   * It used to fall back to the next tournament up, which put a card and a
   * compact row under one "Próximos" heading — two treatments for two things
   * that are peers. That reads as an inconsistency rather than a hierarchy,
   * because it is one: when nothing is live there is no tournament more
   * important than the others, so none of them gets the big card.
   */
  const featured = live[0];
  const restUpcoming = upcoming;

  return (
    <main className={styles.page}>
      <PageHeader
        title={dict.tournaments}
        nav={<SiteNav dict={dict} />}
        actions={<LanguageToggle active={locale} />}
      />

      <PageBody>
        {tournaments.length === 0 ? (
          <p className={styles.empty}>{dict.noTournaments}</p>
        ) : (
          <>
            {featured !== undefined && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{dict.runningNow}</h2>
                <FeatureCard tournament={featured} dict={dict} locale={intl} />
              </section>
            )}
            <Section title={dict.upcoming} items={restUpcoming} dict={dict} locale={intl} />
            <Section title={dict.results} items={past} dict={dict} locale={intl} />
          </>
        )}

        {/* Two, not five. The home page is for the draws; this is a pointer
            to the updates page, not a second feed competing with it. */}
        {updates.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{dict.latestUpdates}</h2>
            <ul className={styles.updateList}>
              {updates.map((u, i) => (
                <li key={u.id}>
                  <Reveal delay={i * 60}>
                    <Link href={`/updates/${u.slug}`} className={styles.updateCard}>
                      {u.coverUrl !== null && (
                        /* eslint-disable-next-line @next/next/no-img-element --
                           Remote URLs pasted by an admin; next/image would
                           need every host in next.config.images. */
                        <img src={u.coverUrl} alt="" className={styles.updateThumb} loading="lazy" />
                      )}
                      <span className={styles.updateBody}>
                        <span className={styles.cardMeta}>
                          {u.publishedAt === null
                            ? ''
                            : venueArticleDateFormatter(intl).format(u.publishedAt)}
                        </span>
                        <span className={styles.updateTitle}>{u.title}</span>
                        {teaserFor(u) !== '' && (
                          <span className={styles.updateExcerpt}>{teaserFor(u)}</span>
                        )}
                      </span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
            <Link href="/updates" className={styles.allLink}>
              {dict.allUpdates}
            </Link>
          </section>
        )}

        <SiteFooter />
      </PageBody>
    </main>
  );
}
