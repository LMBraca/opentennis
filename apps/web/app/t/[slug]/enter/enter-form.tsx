'use client';

import { useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { submitEntry, type EnterError, type EnterState } from './actions';
import { TurnstileWidget } from '@/components/turnstile-widget';
import { startCheckout } from './pay-actions';
import { fill, type Dictionary } from '@/lib/i18n/dictionaries';
import {
  validateEntryFields,
  type EntryField,
  type EntryFieldErrors,
} from '@/lib/entry-validation';
import { entryStatusCopy } from '@/lib/entry-status-copy';
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
  const [fieldErrors, setFieldErrors] = useState<EntryFieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
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
  const fullNameRef = useRef<HTMLInputElement>(null);
  const partnerNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
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
  const values = { eventId, fullName, partnerName, email, phone };
  const fieldRefs = {
    eventId: drawRef,
    fullName: fullNameRef,
    partnerName: partnerNameRef,
    email: emailRef,
    phone: phoneRef,
  };
  const fieldError = (field: EntryField): string | null => {
    const error = fieldErrors[field];
    return error === undefined ? null : ENTRY_ERRORS[error](dict);
  };
  const validateOnBlur = (field: EntryField): void => {
    const next = validateEntryFields(values, isDoubles);
    setFieldErrors((current) => {
      const updated = { ...current };
      if (next[field] === undefined) delete updated[field];
      else updated[field] = next[field];
      return updated;
    });
  };
  const validateOnSubmit = (event: FormEvent<HTMLFormElement>): void => {
    setSubmitted(true);
    const next = validateEntryFields(values, isDoubles);
    setFieldErrors(next);
    const firstInvalid = (['eventId', 'fullName', 'partnerName', 'email', 'phone'] as const).find(
      (field) => next[field] !== undefined,
    );
    if (firstInvalid !== undefined) {
      event.preventDefault();
      fieldRefs[firstInvalid].current?.focus();
    }
  };
  const errorCount = Object.values(fieldErrors).filter((error) => error !== undefined).length;

  if (state.ok !== undefined) {
    const confirmation = entryStatusCopy(
      state.status ?? 'accepted',
      state.ok,
      state.partner,
      dict,
    );
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>{confirmation.heading}</p>
        <p className={styles.doneBody}>{confirmation.message}</p>

        {state.status !== 'pending' && state.status !== 'rejected' && state.entrantId !== undefined && (
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
        {state.statusToken !== undefined && (
          <a
            className={styles.closedLink}
            href={`/t/${slug}/enter/status/${state.statusToken}`}
          >
            {dict.entryStatusLink}
          </a>
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
    <form action={action} className={styles.form} noValidate onSubmit={validateOnSubmit}>
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
          onBlur={() => validateOnBlur('eventId')}
          aria-invalid={fieldErrors.eventId !== undefined}
          aria-describedby={fieldErrors.eventId === undefined ? undefined : 'entry-event-error'}
        >
          <option value="">—</option>
          {draws.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
        {fieldError('eventId') !== null && (
          <p id="entry-event-error" className={styles.fieldError}>{fieldError('eventId')}</p>
        )}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{dict.yourName}</span>
        <input
          className={styles.input}
          ref={fullNameRef}
          name="fullName"
          required
          autoComplete="name"
          maxLength={80}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onBlur={() => validateOnBlur('fullName')}
          aria-invalid={fieldErrors.fullName !== undefined}
          aria-describedby={fieldErrors.fullName === undefined ? undefined : 'entry-name-error'}
        />
        {fieldError('fullName') !== null && (
          <p id="entry-name-error" className={styles.fieldError}>{fieldError('fullName')}</p>
        )}
      </label>

      {isDoubles && (
        <label className={styles.field}>
          <span className={styles.label}>{dict.partnerName}</span>
          <input
            className={styles.input}
            ref={partnerNameRef}
            name="partnerName"
            required
            maxLength={80}
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            onBlur={() => validateOnBlur('partnerName')}
            aria-invalid={fieldErrors.partnerName !== undefined}
            aria-describedby={fieldErrors.partnerName === undefined ? undefined : 'entry-partner-error'}
          />
          {fieldError('partnerName') !== null && (
            <p id="entry-partner-error" className={styles.fieldError}>{fieldError('partnerName')}</p>
          )}
        </label>
      )}

      <label className={styles.field}>
        <span className={styles.label}>{dict.email}</span>
        <input
          className={styles.input}
          ref={emailRef}
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={160}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => validateOnBlur('email')}
          aria-invalid={fieldErrors.email !== undefined}
          aria-describedby={fieldErrors.email === undefined ? undefined : 'entry-email-error'}
        />
        {fieldError('email') !== null && (
          <p id="entry-email-error" className={styles.fieldError}>{fieldError('email')}</p>
        )}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{dict.phone}</span>
        <input
          className={styles.input}
          ref={phoneRef}
          type="tel"
          name="phone"
          required
          autoComplete="tel"
          inputMode="tel"
          maxLength={40}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => validateOnBlur('phone')}
          aria-invalid={fieldErrors.phone !== undefined}
          aria-describedby={fieldErrors.phone === undefined ? undefined : 'entry-phone-error'}
        />
        {fieldError('phone') !== null && (
          <p id="entry-phone-error" className={styles.fieldError}>{fieldError('phone')}</p>
        )}
      </label>

      {/* Above the error and the button: a challenge that appears below the
          thing it gates reads as an afterthought and gets missed. */}
      <TurnstileWidget siteKey={turnstileSiteKey} locale={locale} />

      {submitted && errorCount > 0 && (
        <p className={styles.errorSummary} role="alert">
          {errorCount === 1
            ? dict.formErrorSummary1
            : fill(dict.formErrorSummaryN, { n: String(errorCount) })}
        </p>
      )}
      {state.error !== undefined && (
        <p className={styles.error} role="alert">{ENTRY_ERRORS[state.error](dict)}</p>
      )}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? dict.sending : dict.enterButton}
      </button>
    </form>
  );
}
