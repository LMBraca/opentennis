'use client';

import { useActionState, useMemo, useState } from 'react';
import { submitEntry, type EnterState } from './actions';
import { startCheckout } from './pay-actions';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import styles from './enter.module.css';

interface Draw {
  readonly id: string;
  readonly label: string;
  readonly discipline: string;
}

export function EnterForm({
  slug,
  dict,
  draws,
  preselected,
  showDrawsLink,
}: {
  readonly slug: string;
  /** Every string comes from here, so nothing is built server-side. */
  readonly dict: Dictionary;
  readonly draws: readonly Draw[];
  readonly preselected: string;
  readonly showDrawsLink: boolean;
}) {
  const [state, action, pending] = useActionState<EnterState, FormData>(submitEntry, {});
  const [eventId, setEventId] = useState(preselected);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

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
        <input className={styles.input} name="fullName" required autoComplete="name" maxLength={80} />
      </label>

      {isDoubles && (
        <label className={styles.field}>
          <span className={styles.label}>{dict.partnerName}</span>
          <input className={styles.input} name="partnerName" required maxLength={80} />
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
        />
      </label>

      {state.error !== undefined && (
        <p className={styles.error} role="alert">{state.error}</p>
      )}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? dict.sending : dict.enterButton}
      </button>
    </form>
  );
}
