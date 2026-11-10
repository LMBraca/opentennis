'use client';

import { useActionState } from 'react';
import { setEntryFee, type SeedState } from './actions';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import styles from './entrants.module.css';

/**
 * Entry fee for this category.
 *
 * Typed in pesos, stored in centavos. Blank or zero means free, which is the
 * default — a club that takes cash at the desk never has to touch this.
 */
export function FeePanel({
  slug,
  eventId,
  feeCents,
  currency,
  stripeReady,
  dict,
}: {
  readonly slug: string;
  readonly eventId: string;
  readonly feeCents: number | null;
  readonly currency: string;
  readonly stripeReady: boolean;
  readonly dict: Dictionary;
}) {
  const [state, action, pending] = useActionState<SeedState, FormData>(setEntryFee, {});

  return (
    <section className={styles.panel}>
      <form action={action} className={styles.feeForm}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="eventId" value={eventId} />

        <label className={styles.field}>
          <span className={styles.label}>Entry fee</span>
          <input
            className={styles.feeInput}
            name="fee"
            inputMode="decimal"
            placeholder="0"
            defaultValue={feeCents === null ? '' : (feeCents / 100).toFixed(2)}
            aria-label="Entry fee amount"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Currency</span>
          <input
            className={styles.currencyInput}
            name="currency"
            maxLength={3}
            defaultValue={currency}
            aria-label="Currency code"
          />
        </label>

        <button className={styles.ghost} type="submit" disabled={pending}>
          {pending ? dict.saving : dict.saveFee}
        </button>

        <p className={styles.feeNote}>
          {feeCents === null || feeCents === 0
            ? 'Free to enter. Set a fee to offer online payment.'
            : stripeReady
              ? 'Entrants can pay by card, OXXO or SPEI after registering.'
              : 'Stripe is not configured, so this fee is collected at the desk.'}
        </p>
      </form>

      {state.ok !== undefined && <p className={styles.ok} role="status">{state.ok}</p>}
      {state.error !== undefined && <p className={styles.error} role="alert">{state.error}</p>}
    </section>
  );
}
