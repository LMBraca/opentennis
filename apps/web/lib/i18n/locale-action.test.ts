import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setCookie: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ set: mocks.setCookie }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { setLocale } from '../../app/actions';

describe('setLocale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['en', 'es'])('persists %s and revalidates the shared layout', async (locale) => {
    const formData = new FormData();
    formData.set('locale', locale);

    await setLocale(formData);

    expect(mocks.setCookie).toHaveBeenCalledWith(
      'ot_locale',
      locale,
      expect.objectContaining({ path: '/', maxAge: 31_536_000 }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('ignores unsupported locale values', async () => {
    const formData = new FormData();
    formData.set('locale', 'fr');

    await setLocale(formData);

    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
