import type { ReactNode } from 'react';
import Link from 'next/link';
import { BallScene } from './ball-scene';
import { BrandHeader } from './brand-header';
import { LanguageToggle } from './language-toggle';
import { currentLocale } from '@/lib/i18n/server';
import styles from './page-header.module.css';

/**
 * THE masthead. Every page uses this one — there is no second way to build a
 * page header in this product.
 *
 * It exists because there used to be twelve. Six pages rendered BrandHeader
 * and six did not, so the logo simply vanished across half the product. Four
 * carried the site nav. The article page had a parallel set of class names
 * (articleHero / articleTitle / articleMeta) that happened to be styled
 * almost but not quite like the others. Admin invented `club`, `who` and
 * `signOut`. Unifying the CSS could never fix that, because the markup
 * itself differed page to page: the only real fix is one component with a
 * fixed slot order that pages fill in.
 *
 * The slots are deliberately few. Anything a page cannot express with a
 * back link, a title, one line of lead, some facts and a row of actions
 * probably does not belong in a masthead.
 */

export interface Fact {
  readonly value: string | number;
  readonly label: string;
  /** Draws the eye without inventing a colour: used for "unpaid" counts. */
  readonly emphasis?: boolean;
}

export async function PageHeader({
  variant = 'page',
  back,
  title,
  lead,
  facts,
  nav,
  actions,
  scene,
}: {
  /** `page` is a public destination; `tool` is an admin workspace. */
  readonly variant?: 'page' | 'tool';
  readonly back?: { readonly href: string; readonly label: string } | undefined;
  readonly title: string;
  readonly lead?: string | undefined;
  readonly facts?: readonly Fact[] | undefined;
  readonly nav?: ReactNode;
  readonly actions?: ReactNode;
  /**
   * Decorative scene behind the masthead.
   *
   * RV-7: the balls used to be passed in from the home page alone, so they
   * were a property of one route rather than of the header. They are part
   * of the masthead now and every public page gets them by default — which
   * is the point of having one header component.
   *
   * `tool` does not: the admin masthead is dense, and the design system
   * warns against decoration competing with data. Pass a scene explicitly
   * to override either way; pass `null` to suppress.
   */
  readonly scene?: ReactNode;
}) {
  const locale = await currentLocale();
  const backdrop = scene === undefined && variant === 'page' ? <BallScene /> : scene;
  return (
    <header className={styles.band} data-variant={variant}>
      {backdrop}
      {/*
        NO width option, deliberately. The draw page used to take a `wide`
        masthead to match its bracket, which slid the wordmark from x=176 to
        x=32 and the language toggle 144px the other way the moment you
        opened a draw. A header that moves when you navigate is the thing
        that makes a site feel like several sites. Wide CONTENT scrolls
        inside its own box instead — the bracket already does.
      */}
      <div className={styles.inner}>
        {/*
          The brand row is identical on every page, public or admin. An
          organizer looking at the entrants table is still inside Open
          Tennis, and the masthead should say so.
        */}
        <BrandHeader variant="onBrand">
          {variant === 'tool' ? (
            <div className={styles.headerActions}>
              {actions}
              <LanguageToggle active={locale} />
            </div>
          ) : (
            actions
          )}
        </BrandHeader>

        {back !== undefined && (
          <Link href={back.href} className={styles.back}>
            {back.label}
          </Link>
        )}

        <h1 className={styles.title} data-variant={variant}>
          {title}
        </h1>

        {lead !== undefined && lead !== '' && <p className={styles.lead}>{lead}</p>}

        {facts !== undefined && facts.length > 0 && (
          <dl className={styles.facts}>
            {facts.map((fact) => (
              <div key={fact.label} className={styles.fact}>
                <dt className={styles.factLabel}>{fact.label}</dt>
                <dd className={styles.factValue} data-emphasis={fact.emphasis ? 'true' : undefined}>
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {nav}
      </div>
    </header>
  );
}

/**
 * The body container that pairs with it.
 *
 * Same max-width and the same gutter, declared once, so the masthead and
 * what sits under it cannot drift onto different left edges — which is
 * exactly what happened when every page declared its own.
 */
export function PageBody({
  width = 'default',
  children,
}: {
  readonly width?: 'default' | 'measure';
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.body} data-width={width}>
      {children}
    </div>
  );
}
