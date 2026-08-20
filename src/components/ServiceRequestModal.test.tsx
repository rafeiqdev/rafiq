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

// The post-submit animation is exercised in BestOfferSearching.test.tsx; here it
// is reduced to the props that matter — the WhatsApp link must arrive as a
// rendered choice on the confirmation, not as a redirect fired at submit.
vi.mock('./BestOfferSearching', () => ({
  BestOfferSearching: ({ waHref }: { waHref?: string | null }) => (
    <div>
      <p>best-offer</p>
      {waHref ? <a href={waHref}>wa-cta</a> : null}
    </div>
  ),
}));

const SOURCE = { id: 'ikamet', title: 'İkamet', category: 'residency', type: 'direct' };

/**
 * NOTE ON THE 5s TIMEOUTS BELOW.
 *
 * They exist because of THIS function, not because the assertions are slow or
 * racy. vi.resetModules() plus the dynamic import costs ~850ms of setup on every
 * single render, which tips past waitFor's 1s default once the full suite runs
 * in parallel. The timeouts treat the symptom.
 *
 * If these flake again, the fix is to remove the resetModules/dynamic-import
 * setup — it exists only so each test can restub VITE_WHATSAPP_NUMBER before the
 * module reads it at import time — not to raise the timeout further.
 */
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

/**
 * The WhatsApp hand-off is now a CHOICE ON THE CONFIRMATION, never a redirect.
 *
 * It used to fire window.open() the instant the insert succeeded, to guarantee
 * the admin heard about the request. On a phone that is an app switch: the
 * customer was thrown out of the browser before the confirmation rendered, so
 * they never saw the "track your request" button and never learned /requests
 * existed. One customer reported submitting a request and concluding no list of
 * requests existed — he had never come back to the site to see one.
 *
 * These tests previously asserted the opposite (that the open MUST fire). That
 * requirement is deliberately reversed: reaching the admin does not justify
 * ejecting the customer from the page that tells them what happens next.
 */
describe('WhatsApp hand-off after a successful submission', () => {
  it('does NOT open WhatsApp automatically for a signed-in customer', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '905551112233');
    // A signed-in customer gets a row id back — the case that used to redirect.
    createMock.mockResolvedValue({ ok: true, id: 'req-1' });

    await renderModal();
    fillValidForm();
    submit();

    // renderModal() does vi.resetModules() + a dynamic import, which costs
    // ~850ms alone and tips past waitFor's 1s default under full-suite parallel
    // load. The generous timeout is about machine speed, not about the
    // assertion — a slow box must not turn a passing suite red.
    await waitFor(() => expect(screen.getByText('best-offer')).toBeInTheDocument(), { timeout: 5000 });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('offers WhatsApp as a link on the confirmation instead', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '905551112233');
    createMock.mockResolvedValue({ ok: true, id: 'req-1' });

    await renderModal();
    fillValidForm();
    submit();

    const cta = await screen.findByText('wa-cta', {}, { timeout: 5000 });
    expect(cta.getAttribute('href')).toContain('https://wa.me/905551112233');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('does NOT open WhatsApp automatically for an anonymous submitter either', async () => {
    vi.stubEnv('VITE_WHATSAPP_NUMBER', '905551112233');
    useAppMock.mockReturnValue({ user: null });
    createMock.mockResolvedValue({ ok: true, id: null });

    await renderModal();
    fillValidForm();
    submit();

    // Anonymous takes the plain success branch, which already had a WhatsApp
    // button rather than a redirect.
    await waitFor(() => expect(screen.getByText('services.modal.successTitle')).toBeInTheDocument(), { timeout: 5000 });
    expect(openSpy).not.toHaveBeenCalled();
    expect(document.querySelector('a[href*="wa.me"]')).not.toBeNull();
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

/**
 * A SUCCESS SCREEN IS A CLAIM ABOUT THE DATABASE.
 *
 * "تم إرسال طلبك" means one specific thing: the server accepted the row. While
 * the insert is still in flight nobody knows that yet, and if it is refused it
 * is false. A customer who reads it and then finds nothing on /requests has
 * been told, by us, that we have a request we do not have.
 */
describe('the confirmation never runs ahead of the server', () => {
  it('shows nothing but a pending button while the insert is in flight', async () => {
    let settle: (v: { ok: true; id: string }) => void = () => {};
    createMock.mockImplementation(() => new Promise((res) => { settle = res; }));

    await renderModal();
    fillValidForm();
    submit();

    // The request is on the wire and unanswered. No success title, no tracker.
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('services.modal.successTitle')).toBeNull();
    expect(screen.queryByText('best-offer')).toBeNull();

    settle({ ok: true, id: 'r-1' });

    // Only now — with the row confirmed and its id in hand.
    expect(await screen.findByText('best-offer')).toBeInTheDocument();
  }, 5000);

  it('shows an error, not a confirmation, when the server refuses the row', async () => {
    createMock.mockRejectedValue(new Error('network'));

    await renderModal();
    fillValidForm();
    submit();

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('services.modal.error');
    expect(screen.queryByText('services.modal.successTitle')).toBeNull();
    expect(screen.queryByText('best-offer')).toBeNull();
  }, 5000);
});
