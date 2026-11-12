/**
 * Language toggle.
 *
 * A form with two submit buttons rather than a client component: it works
 * with JavaScript disabled, needs no hydration, and the whole page re-renders
 * server-side in the new language rather than being patched string by string.
 */

import type { ReactNode } from 'react';
import { setLocale } from '@/app/actions';
import { LOCALES, dictionary, type Locale } from '@/lib/i18n/dictionaries';
import styles from './language-toggle.module.css';

export function LanguageToggle({
  active,
  tone = 'brand',
}: {
  readonly active: Locale;
  readonly tone?: 'brand' | 'light';
}): ReactNode {
  return (
    <form
      action={setLocale}
      className={styles.form}
      data-tone={tone === 'light' ? tone : undefined}
      role={tone === 'light' ? 'group' : undefined}
      aria-label={tone === 'light' ? dictionary(active).languageLabel : undefined}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          className={styles.option}
          data-active={locale === active}
          // The code is the visible label; the full name is for screen readers,
          // where "EN" would be read as a word rather than a language.
          aria-label={dictionary(locale).localeName}
          aria-current={locale === active ? 'true' : undefined}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </form>
  );
}
