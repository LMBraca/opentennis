import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AuthPage } from '../app/admin/(auth)/auth-page';
import { AuthShell } from '../app/admin/(auth)/auth-shell';
import { InvalidInvitePage } from '../app/admin/(auth)/invite/invalid-page';
import { dictionary } from './i18n/dictionaries';
import { describe, expect, it, vi } from 'vitest';

describe('minimal auth layout', () => {
  it('renders the auth card and slim meta row without site navigation or footer content', () => {
    const dict = dictionary('es');
    vi.stubGlobal('React', React);
    const html = renderToStaticMarkup(
      React.createElement(
        AuthShell,
        { locale: 'es', dict },
        React.createElement(
          AuthPage,
          {
            backHref: '/admin/login',
            backLabel: dict.backToSignIn,
            dict,
            title: dict.forgotPasswordTitle,
          },
          React.createElement('p', null, dict.forgotPasswordLead),
        ),
      ),
    );
    vi.unstubAllGlobals();

    expect(html).toContain('Open Tennis, Mexicali, México');
    expect(html).toContain(dict.forgotPasswordTitle);
    expect(html).toContain('role="group"');
    expect(html).not.toContain('Open Tennis en Instagram');
    expect(html).not.toContain('aria-label="Official sponsor: AF Pro Shop"');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('href="/blog"');
    expect(html.match(/<footer/g)).toHaveLength(1);
  });

  it('keeps the invalid-invite state to one contextual home link', () => {
    vi.stubGlobal('React', React);
    const html = renderToStaticMarkup(React.createElement(InvalidInvitePage, { locale: 'es' }));
    vi.unstubAllGlobals();

    expect(html.match(/href="\/"/g)).toHaveLength(2);
    expect(html.match(/>Ir al inicio</g)).toHaveLength(1);
  });
});
