import { describe, expect, it } from 'vitest';
import { isOfferedButNotGenerated } from './category-grid-state';

describe('isOfferedButNotGenerated', () => {
  it('shows an offered draft with entrants and no matches', () => {
    expect(isOfferedButNotGenerated('draft', 0, 11)).toBe(true);
  });

  it('does not show an empty, never-offered cell as an event', () => {
    expect(isOfferedButNotGenerated('draft', 0, 0)).toBe(false);
  });

  it('does not relabel an already generated or non-draft event', () => {
    expect(isOfferedButNotGenerated('draft', 1, 11)).toBe(false);
    expect(isOfferedButNotGenerated('published', 0, 11)).toBe(false);
  });
});
