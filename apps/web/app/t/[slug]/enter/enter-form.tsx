'use client';

import { useActionState, useMemo, useState } from 'react';
import { submitEntry, type EnterState } from './actions';
import styles from './enter.module.css';

interface Draw {
  readonly id: string;
  readonly label: string;
  readonly discipline: string;
}

export function EnterForm({
  slug,
  locale,
  draws,
  preselected,
  showDrawsLink,
}: {
  readonly slug: string;
  readonly locale: string;
  readonly draws: readonly Draw[];
  readonly preselected: string;
  /** False while the tournament is a draft: that page would 404. */
  readonly showDrawsLink: boolean;
}) {
  const [state, action, pending] = useActionState<EnterState, FormData>(submitEntry, {});
  const [eventId, setEventId] = useState(preselected);

  // Stamped at render, checked on submit: a human cannot fill this in under
  // two seconds.
  const renderedAt = useMemo(() => Date.now(), []);
  const isDoubles = draws.find((d) => d.id === eventId)?.discipline === 'doubles';
  const es = locale === 'es';

  if (state.ok !== undefined) {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>{es ? '¡Listo!' : "You're in"}</p>
        <p className={styles.doneBody}>{state.ok}</p>
        {showDrawsLink && (
          <a className={styles.closedLink} href={`/t/${slug}`}>
            {es ? 'Ver los cuadros →' : 'View the draws →'}
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
        <span className={styles.label}>{es ? 'Cuadro' : 'Draw'}</span>
        <select
          className={styles.input}
          name="eventId"
          required
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
        >
          <option value="">{es ? 'Elige un cuadro…' : 'Choose a draw…'}</option>
          {draws.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{es ? 'Tu nombre completo' : 'Your full name'}</span>
        <input className={styles.input} name="fullName" required autoComplete="name" maxLength={80} />
      </label>

      {isDoubles && (
        <label className={styles.field}>
          <span className={styles.label}>{es ? 'Nombre de tu pareja' : "Your partner's name"}</span>
          <input className={styles.input} name="partnerName" required maxLength={80} />
        </label>
      )}

      <label className={styles.field}>
        <span className={styles.label}>{es ? 'Correo electrónico' : 'Email'}</span>
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
        <span className={styles.label}>{es ? 'Teléfono' : 'Phone'}</span>
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

      <label className={styles.field}>
        <span className={styles.label}>
          {es ? 'Club (opcional)' : 'Club (optional)'}
        </span>
        <input className={styles.input} name="club" maxLength={80} />
      </label>

      {state.error !== undefined && (
        <p className={styles.error} role="alert">{state.error}</p>
      )}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? (es ? 'Enviando…' : 'Sending…') : es ? 'Inscribirme' : 'Enter'}
      </button>
    </form>
  );
}
