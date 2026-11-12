/**
 * Tournament settings.
 *
 * The Configuración link used to open the setup path, which is the create
 * flow wearing a different hat — fine the first time through, wrong
 * forever after. Setup is a sequence you walk once; settings is a surface
 * you return to for one thing. They are different shapes and now they are
 * different pages.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { schema } from '@opentennis/db';
import { db, orgId } from '@/lib/db';
import { requireCapability } from '@/lib/auth';
import { PageHeader, PageBody } from '@/components/page-header';
import { currentLocale } from '@/lib/i18n/server';
import { dictionary } from '@/lib/i18n/dictionaries';
import { SettingsForm } from './settings-form';
import styles from '../manage.module.css';

export const dynamic = 'force-dynamic';

interface Params {
  readonly params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = dictionary(await currentLocale());
  return { title: { absolute: `${dict.settingsTitle} · ${dict.adminEyebrow}` } };
}

export default async function SettingsPage({ params }: Params) {
  const { slug } = await params;
  await requireCapability('tournaments:manage', `/admin/${slug}/settings`);
  const organizationId = orgId();
  const dict = dictionary(await currentLocale());

  const [tournament] = await db()
    .select()
    .from(schema.tournaments)
    .where(
      and(eq(schema.tournaments.organizationId, organizationId), eq(schema.tournaments.slug, slug)),
    )
    .limit(1);
  if (tournament === undefined) notFound();

  const events = await db()
    .select({ id: schema.events.id, feeCents: schema.events.entryFeeCents, currency: schema.events.currency })
    .from(schema.events)
    .where(eq(schema.events.tournamentId, tournament.id));

  /*
   * The fee shown is the one they all share. When draws disagree — because
   * someone priced the Open draw differently on its own page — the field
   * is left blank rather than guessing a number that would overwrite the
   * difference on the next save.
   */
  const fees = new Set(events.map((e) => e.feeCents ?? 0));
  const sharedFee = fees.size === 1 ? [...fees][0] ?? 0 : null;

  // Once a bracket exists the consolation flag is read-only: it is applied
  // at generation and changing it afterwards does nothing to that draw.
  const [drawn] = await db()
    .select({ id: schema.stages.id })
    .from(schema.stages)
    .innerJoin(schema.events, eq(schema.events.id, schema.stages.eventId))
    .where(eq(schema.events.tournamentId, tournament.id))
    .limit(1);

  return (
    <main className={styles.page}>
      <PageHeader
        variant="tool"
        back={{ href: `/admin/${slug}`, label: tournament.name }}
        title={dict.settingsTitle}
      />
      <PageBody>
        <SettingsForm
          dict={dict}
          values={{
            slug,
            name: tournament.name,
            venue: tournament.venue ?? '',
            startDate: tournament.startDate ?? '',
            endDate: tournament.endDate ?? '',
            entriesOpen: tournament.entriesOpen,
            requireCaptcha: tournament.requireCaptcha,
            consolationDraws: tournament.consolationDraws,
            courtCount: tournament.courtCount,
            matchMinutes: tournament.matchMinutes,
            minRestMinutes: tournament.minRestMinutes,
            entryFee: sharedFee === null || sharedFee === 0 ? '' : String(sharedFee / 100),
            currency: events[0]?.currency ?? 'MXN',
            consolationEditable: drawn === undefined,
          }}
        />
      </PageBody>
    </main>
  );
}
