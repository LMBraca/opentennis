'use client';

import { useState } from 'react';
import styles from './confirm-action.module.css';

export function ConfirmAction({
  action,
  fields,
  title,
  body,
  label,
  cancelLabel,
  className,
}: {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly fields: Readonly<Record<string, string>>;
  readonly title: string;
  readonly body: string;
  readonly label: string;
  readonly cancelLabel: string;
  readonly className?: string | undefined;
}) {
  const [open, setOpen] = useState(false);

  return (
    <form action={action} className={styles.form}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        className={className ?? styles.trigger}
        type="button"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <div className={styles.backdrop}>
          <section className={styles.dialog} role="dialog" aria-modal="true">
            <h2>{title}</h2>
            <p>{body}</p>
            <div className={styles.actions}>
              <button className={styles.confirm} type="submit" onClick={() => setOpen(false)}>
                {label}
              </button>
              <button
                className={styles.cancel}
                type="button"
                onClick={() => setOpen(false)}
              >
                {cancelLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </form>
  );
}
