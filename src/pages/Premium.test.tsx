import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// `t` returns the key (so assertions can target keys rather than copy), but
// still appends interpolated values — the real translation embeds them, and
// these tests are about what text reaches the assistant.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
    i18n: { language: 'ar' },
  }),
}));

const useAppMock = vi.fn();
vi.mock('../context/AppContext', () => ({ useApp: () => useAppMock() }));

const chatMock = vi.fn();
const uploadMediaMock = vi.fn();
const summarizeMock = vi.fn();
const createBookingMock = vi.fn();
vi.mock('../lib/api', () => ({
  ai: {
    chat: (...a: unknown[]) => chatMock(...a),
    summarize: (...a: unknown[]) => summarizeMock(...a),
  },
  bookings: {
    uploadMedia: (...a: unknown[]) => uploadMediaMock(...a),
    create: (...a: unknown[]) => createBookingMock(...a),
  },
  profileApi: { setPhone: vi.fn().mockResolvedValue({ ok: true }) },
  ApiError: class ApiError extends Error {
    code?: string;
  },
}));

// The booking modal is exercised in its own right; here it only needs to be
// able to report success.
vi.mock('../components/BookingModal', () => ({
  BookingModal: ({ onBooked }: { onBooked?: () => void }) => (
    <button onClick={() => onBooked?.()}>confirm-booking</button>
  ),
}));

import { Premium } from './Premium';

function setup() {
  useAppMock.mockReturnValue({
    user: { id: 'u1', name: 'Test', phone: '+905551112233', isAdmin: false },
    authLoading: false,
    tier: 'pro', // lifts the topic quota so it can't interfere
  });
  return render(
    <MemoryRouter>
      <Premium />
    </MemoryRouter>,
  );
}

function attach(container: HTMLElement, name: string) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], name, { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  localStorage.clear();
  chatMock.mockReset();
  uploadMediaMock.mockReset();
  summarizeMock.mockReset();
  createBookingMock.mockReset();
  chatMock.mockResolvedValue({ reply: 'ok', done: false });
  summarizeMock.mockResolvedValue({ summary: 'summary', caseFile: undefined });
  createBookingMock.mockResolvedValue({ id: 'b1' });
});

describe('attachments are visible to the assistant', () => {
  // Regression: `ask()` sent only {role,text,ts} and the uploaded media lived in
  // separate state, so the assistant had no way to know a file existed — it
  // would keep asking for documents, or claim it had received them.
  it('tells the assistant which file was attached', async () => {
    uploadMediaMock.mockResolvedValue({ path: 'u1/a.png', name: 'passport.png', mime: 'image/png' });
    const { container } = setup();

    attach(container, 'passport.png');

    await waitFor(() => expect(chatMock).toHaveBeenCalled());
    const sent = chatMock.mock.calls[0][0] as { role: string; text: string }[];
    const last = sent[sent.length - 1];
    expect(last.role).toBe('user');
    expect(last.text).toContain('passport.png');
  });

  it('names every file when several are attached at once', async () => {
    uploadMediaMock
      .mockResolvedValueOnce({ path: 'u1/a.png', name: 'passport.png', mime: 'image/png' })
      .mockResolvedValueOnce({ path: 'u1/b.png', name: 'ikamet.png', mime: 'image/png' });
    const { container } = setup();

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [
          new File(['x'], 'passport.png', { type: 'image/png' }),
          new File(['x'], 'ikamet.png', { type: 'image/png' }),
        ],
      },
    });

    await waitFor(() => expect(chatMock).toHaveBeenCalled());
    const sent = chatMock.mock.calls[0][0] as { text: string }[];
    const last = sent[sent.length - 1].text;
    expect(last).toContain('passport.png');
    expect(last).toContain('ikamet.png');
  });

  it('says nothing to the assistant when the upload fails', async () => {
    uploadMediaMock.mockRejectedValue(new Error('no bucket'));
    const { container } = setup();

    attach(container, 'passport.png');

    // give the failed upload a chance to settle
    await waitFor(() => expect(uploadMediaMock).toHaveBeenCalled());
    expect(chatMock).not.toHaveBeenCalled();
  });
});

describe('a topic ends when the appointment is booked', () => {
  it('closes the chat and offers a new topic', async () => {
    chatMock.mockResolvedValue({ reply: 'ready', done: true });
    setup();

    // say something so the assistant can reach the "ready to book" state
    fireEvent.change(screen.getByPlaceholderText('chat.placeholder'), { target: { value: 'أريد تجديد الإقامة' } });
    fireEvent.click(screen.getByText('common.send'));

    const confirm = await screen.findByText('chat.ready.cta');
    fireEvent.click(confirm);

    // the assistant already has the account's phone, so the in-chat card
    // offers to confirm the auto-picked slot directly — no form to open.
    const autoBookConfirm = await screen.findByText('chat.autoBook.confirm');
    fireEvent.click(autoBookConfirm);

    await waitFor(() => expect(createBookingMock).toHaveBeenCalled());

    // the topic is now closed: the "new topic" card replaces the composer
    expect(await screen.findByText('chat.closed.bookedTitle')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('chat.closed.placeholder')).toBeDisabled();
    expect((screen.getByText('common.send') as HTMLButtonElement).disabled).toBe(true);
  });

  it('stays closed after a reload', async () => {
    localStorage.setItem('rafiq_chat_closed_u1', 'true');
    setup();

    expect(await screen.findByText('chat.closed.title')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('chat.closed.placeholder')).toBeDisabled();
  });
});
