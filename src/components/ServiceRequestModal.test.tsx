import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * B2 regression suite — the WhatsApp hand-off is the only channel that reaches
 * the admin while they are not looking at /admin. There is no email, push or
 * webhook behind this form.
 *
 * The bug: the hand-off was gated on `!res.id`, i.e. it fired only for
 * ANONYMOUS submitters. A signed-in customer — the highest-intent user — got a
 * success screen while their request sat in the table, unseen, until an admin
 * happened to log in.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

const useAppMock = vi.fn();
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));

const createMock = vi.fn();
vi.mock('../lib/api', () => ({
  serviceRequests: { create: (...a: unknown[]) => createMock(...a) },
  ApiError: class ApiError extends Error {
    constructor(
      public code: string,
      public status: number,
    ) {
      super(code);
    }
  },
}));

// The post-submit animation is exercised elsewhere; it must not swallow the
// success branch under test.
vi.mock('./BestOfferSearching', () => ({
  BestOfferSearching: () => <p>best-offer</p>,
}));

const SOURCE = { id: 'ikamet', title: 'İkamet', category: 'residency', type: 'direct' };

async function renderModal() {
  vi.resetModules();
  const { ServiceRequestModal } = await import('./ServiceRequestModal');
  return render(
    <MemoryRouter>
      <ServiceRequestModal source={SOURCE} onClose={() => {}} />
    </MemoryRouter>,
  );
}

/** Fills the two required fields with values that pass validation. */
function fillValidForm() {
  const inputs = document.querySelectorAll('input');
  fireEvent.change(inputs[0], { target: { value: 'Ahmet Yilmaz' } });
  fireEvent.change(inputs[1], { target: { value: '+905551234567' } });
}

function submit() {
  // `t` returns the key, so the send button renders its key as its label.
  fireEvent.click(screen.getByRole('button', { name: 'services.modal.send' }));
}

let openSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  openSpy = vi.fn();
  vi.stubGlobal('open', openSpy);
  useAppMock.mockReturnValue({ user: { id: 'u1', name: 'Test' } });
  createMock.mockReset();
  // The client cooldown persists in localStorage; without this every test
  // after the first would be blocked by the previous one's submission.
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('WhatsApp hand-off after a successful submission', () => {
  it('fires for a SIGNED-IN customer (the case the old !res.id gate skipped)', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '905551112233');
    // A signed-in customer gets a row id back — this is exactly what used to
    // suppress the only notification channel.
    createMock.mockResolvedValue({ ok: true, id: 'req-1' });

    await renderModal();
    fillValidForm();
    submit();

    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
    expect(openSpy.mock.calls[0][0]).toContain('https://wa.me/905551112233');
  });

  it('still fires for an anonymous submitter (id null)', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '905551112233');
    createMock.mockResolvedValue({ ok: true, id: null });

    await renderModal();
    fillValidForm();
    submit();

    await waitFor(() => expect(openSpy).toHaveBeenCalledTimes(1));
  });

  it('is skipped cleanly when VITE_WHATSAPP_NUMBER is unset — no wa.me link', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '');
    createMock.mockResolvedValue({ ok: true, id: 'req-1' });

    await renderModal();
    fillValidForm();
    submit();

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(openSpy).not.toHaveBeenCalled();
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it('treats the 905000000000 placeholder as unconfigured', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '905000000000');
    createMock.mockResolvedValue({ ok: true, id: 'req-1' });

    await renderModal();
    fillValidForm();
    submit();

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(openSpy).not.toHaveBeenCalled();
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it('does not open WhatsApp when the submission itself failed', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '905551112233');
    createMock.mockRejectedValue(new Error('boom'));

    await renderModal();
    fillValidForm();
    submit();

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(openSpy).not.toHaveBeenCalled();
  });
});

/** The honeypot input — off-screen, aria-hidden, never focusable. */
const honeypot = () => document.querySelector('input[name="website"]') as HTMLInputElement;

describe('honeypot (S5, bot filter)', () => {
  it('exists but is hidden from sighted users and from screen readers', async () => {
    await renderModal();
    const field = honeypot();

    expect(field).toBeTruthy();
    expect(field.tabIndex).toBe(-1);
    expect(field.getAttribute('autocomplete')).toBe('off');
    // aria-hidden lives on the wrapper, which is what removes it from the tree.
    expect(field.closest('[aria-hidden]')).not.toBeNull();
  });

  it('is not reachable in the tab order or by accessible name', async () => {
    await renderModal();

    // getByRole ignores aria-hidden subtrees — if this finds it, it is announced.
    expect(screen.queryByRole('textbox', { name: /website/i })).toBeNull();
  });

  it('does NOT insert when filled, and shows the bot a success screen', async () => {
    createMock.mockResolvedValue({ ok: true, id: 'req-1' });

    await renderModal();
    fillValidForm();
    fireEvent.change(honeypot(), { target: { value: 'http://spam.example' } });
    submit();

    await waitFor(() => expect(screen.getByText('services.modal.successTitle')).toBeInTheDocument());
    expect(createMock).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('submits normally when the honeypot is left alone', async () => {
    createMock.mockResolvedValue({ ok: true, id: 'req-1' });

    await renderModal();
    fillValidForm();
    submit();

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
  });
});

describe('client cooldown (S5)', () => {
  it('blocks a second submit inside the cooldown with a reassuring message', async () => {
    createMock.mockResolvedValue({ ok: true, id: 'req-1' });

    // First submission records the timestamp.
    const first = await renderModal();
    fillValidForm();
    submit();
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    first.unmount();

    // Second attempt, same minute.
    await renderModal();
    fillValidForm();
    submit();

    const note = await screen.findByRole('status');
    expect(note).toHaveTextContent('services.modal.throttled');
    // Never an error, and never a silent no-op.
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('services.modal.error')).toBeNull();
  });

  it('allows a legitimate second submit once the cooldown has passed', async () => {
    createMock.mockResolvedValue({ ok: true, id: 'req-1' });

    const first = await renderModal();
    fillValidForm();
    submit();
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    first.unmount();

    // Age the stored timestamp past the cooldown.
    localStorage.setItem('rafiq_sr_submits', JSON.stringify([Date.now() - 61_000]));

    await renderModal();
    fillValidForm();
    submit();

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2));
  });

  it('does not count a failed submission against the cooldown', async () => {
    createMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ok: true, id: 'r' });

    const first = await renderModal();
    fillValidForm();
    submit();
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    first.unmount();

    // Immediately retrying after a failure must be allowed.
    await renderModal();
    fillValidForm();
    submit();

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2));
  });

  it('shows the dedicated message when the DATABASE trigger refuses the insert', async () => {
    const { ApiError } = await import('../lib/api');
    createMock.mockRejectedValue(new ApiError('rate_limited', 429));

    await renderModal();
    fillValidForm();
    submit();

    const note = await screen.findByRole('status');
    expect(note).toHaveTextContent('services.modal.rateLimited');
    expect(screen.queryByText('services.modal.error')).toBeNull();
  });
});
