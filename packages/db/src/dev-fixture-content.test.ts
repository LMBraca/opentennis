import { describe, expect, it } from 'vitest';
import { cleanNovemberFixtureContent } from './dev-fixture-content';

describe('cleanNovemberFixtureContent', () => {
  it('removes raw or escaped script residue and replaces the excerpt terminology', () => {
    expect(
      cleanNovemberFixtureContent({
        body: "Tres sets. <script>alert('xss')</script>",
        excerpt: 'Tres sets, dos horas y cuarto, y una pista llena.',
      }),
    ).toEqual({
      body: 'Tres sets. ',
      excerpt: 'Tres sets, dos horas y cuarto, y una Cancha llena.',
    });
    expect(
      cleanNovemberFixtureContent({
        body: 'Residue: &lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;',
        excerpt: null,
      }).body,
    ).toBe('Residue: ');
  });
});
