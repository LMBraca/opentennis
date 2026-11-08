'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { submitEntry, type EnterError, type EnterState } from './actions';
import { TurnstileWidget } from '@/components/turnstile-widget';
import { startCheckout } from './pay-actions';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import styles from './enter.module.css';

interface Draw {
  readonly id: string;
  readonly label: string;
  readonly discipline: string;
}

/**
 * Refusal key to sentence. The action returns a key because it runs on the
 * server with no idea which language the page is in.
 */
const ENTRY_ERRORS: Record<EnterError, (d: Dictionary) => string> = {
  tooQuick: (d) => d.entryTooQuick,
  rateLimited: (d) => d.entryRateLimited,
  challenge: (d) => d.entryChallenge,
  needName: (d) => d.entryNeedName,
  needEmail: (d) => d.entryNeedEmail,
  needPhone: (d) => d.entryNeedPhone,
  needDraw: (d) => d.entryNeedDraw,
  notFound: (d) => d.entryNotFound,
  entriesClosed: (d) => d.entryClosedError,
  drawNotHere: (d) => d.entryDrawNotHere,
  drawNotHeld: (d) => d.entryDrawNotHeld,
  needPartner: (d) => d.entryNeedPartner,
  alreadyEntered: (d) => d.entryAlready,
  saveFailed: (d) => d.entrySaveFailed,
};

export function EnterForm({
  slug,
  dict,
  draws,
  preselected,
  showDrawsLink,
  source,
  turnstileSiteKey,
  locale,
}: {
  readonly slug: string;
  /** Every string comes from here, so nothing is built server-side. */
  readonly dict: Dictionary;
  readonly draws: readonly Draw[];
  readonly preselected: string;
  readonly showDrawsLink: boolean;
  /** The `?src=` label from the link they followed, if any. */
  readonly source?: string | undefined;
  /** ENT-3. Null when the club has no Cloudflare keys; the widget stands down. */
  readonly turnstileSiteKey: string | null;
  readonly locale: string;
}) {
  const [state, action, pending] = useActionState<EnterState, FormData>(submitEntry, {});
  const [eventId, setEventId] = useState(preselected);
  /*
   * Controlled, so a refused entry does not wipe what the player typed.
   * React resets uncontrolled fields when a form action settles, so a
   * player told "too many entries from this connection, try again in a
   * minute" had to retype their name, email and phone on a phone — at a
   * sign-up desk, that is where people give up.
   */
  const [fullName, setFullName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  /*
   * Put the category back after a refused submit.
   *
   * React resets the form when an action settles. For the text inputs
   * above, being controlled is enough — React's value tracker notices the
   * DOM no longer matches and restores it. A <select> is not restored that
   * way, so the chosen category silently fell back to "—" while the state
   * still held it: the player was told to try again, pressed the button,
   * and was then told to choose a category they had already chosen.
   */
  const drawRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    const el = drawRef.current;
    if (el !== null && el.value !== eventId) el.value = eventId;
  });

  const pay = async (entrantId: string): Promise<void> => {
    setPaying(true);
    setPayError(null);
    const result = await startCheckout(entrantId);
    if (result.url !== undefined) {
      // Full navigation, not a fetch: Stripe hosts the page.
      window.location.href = result.url;
      return;
    }
    setPayError(result.error ?? 'Could not start checkout.');
    setPaying(false);
  };

  // Stamped at render, checked on submit: a human cannot fill this in under
  // two seconds.
  const renderedAt = useMemo(() => Date.now(), []);
  const isDoubles = draws.find((d) => d.id === eventId)?.discipline === 'doubles';

  /*
   * OT-12. Review on means nobody has accepted this yet, so the player is
   * told what is actually true and is NOT asked to pay — neither online nor
   * at the desk. `enteredSingles` carries "Paga la inscripción en
   * recepción", which is the sentence that made this a promise.
   */
  if (state.ok !== undefined && state.pending === true) {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>{dict.entryPendingTitle}</p>
        <p className={styles.doneBody}>{dict.entryPendingBody}</p>
        {showDrawsLink && (
          <a className={styles.closedLink} href={`/t/${slug}`}>
            {dict.viewDraws}
          </a>
        )}
      </div>
    );
  }

  if (state.ok !== undefined) {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>{dict.youreIn}</p>
        <p className={styles.doneBody}>
          {state.ok === 'doubles' && state.partner !== undefined
            ? fill(dict.enteredDoubles, { partner: state.partner })
            : dict.enteredSingles}
        </p>

        {state.entrantId !== undefined && (
          <div className={styles.payBlock}>
            <button
              type="button"
              className={styles.payButton}
              disabled={paying}
              onClick={() => void pay(state.entrantId as string)}
            >
              {paying ? dict.sending : `${dict.payNow} ${state.feeLabel ?? ''}`.trim()}
            </button>
            {/* Cash at the desk stays valid: online payment is an option,
                not a gate. */}
            <p className={styles.payNote}>{dict.payLater}</p>
            {payError !== null && (
              <p className={styles.error} role="alert">{payError}</p>
            )}
          </div>
        )}
        {showDrawsLink && (
          <a className={styles.closedLink} href={`/t/${slug}`}>
            {dict.viewDraws}
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="slug" value={slug} />
      {/* Which QR code or link they came in on. Set by ?src= — no cookie,
          no identifier, just the label the club printed. */}
      {source !== undefined && source !== '' && (
        <input type="hidden" name="source" value={source} />
      )}
      <input type="hidden" name="renderedAt" value={renderedAt} />

      {/* Honeypot: hidden from people, irresistible to a naive bot. */}
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>{dict.chooseDraw}</span>
        <select
          ref={drawRef}
          className={styles.input}
          name="eventId"
          required
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          <option value="">—</option>
          {draws.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{dict.yourName}</span>
        <input
          className={styles.input}
          name="fullName"
          required
          autoComplete="name"
          maxLength={80}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </label>

      {isDoubles && (
        <label className={styles.field}>
          <span className={styles.label}>{dict.partnerName}</span>
          <input
            className={styles.input}
            name="partnerName"
            required
            maxLength={80}
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
          />
        </label>
      )}

      <label className={styles.field}>
        <span className={styles.label}>{dict.email}</span>
        <input
          className={styles.input}
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={160}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{dict.phone}</span>
        <input
          className={styles.input}
          type="tel"
          name="phone"
          required
          autoComplete="tel"
          inputMode="tel"
          maxLength={40}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>

      {/* Above the error and the button: a challenge that appears below the
          thing it gates reads as an afterthought and gets missed. */}
      <TurnstileWidget siteKey={turnstileSiteKey} locale={locale} />

      {state.error !== undefined && (
        <p className={styles.error} role="alert">{ENTRY_ERRORS[state.error](dict)}</p>
      )}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? dict.sending : dict.enterButton}
      </button>
    </form>
  );
}
