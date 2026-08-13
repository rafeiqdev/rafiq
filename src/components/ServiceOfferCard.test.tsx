import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ServiceOffer, ServicePayment } from '../lib/types';

/**
 * Render-state and lightbox-navigation coverage for ServiceOfferCard — the
 * customer-facing offer card wired into MyRequests / MobileMyRequests. Pins
 * the pay/reject decision surface and the OfferPhotoLightbox's prev/next
 * arrows, keyboard arrows, and swipe-threshold behaviour.
 */

const rejectMock = vi.fn();
const createSessionMock = vi.fn();
const resumeUrlMock = vi.fn();

vi.mock('../lib/api', () => ({
  serviceOffers: { reject: (id: string) => rejectMock(id) },
  servicePayments: {
    createSession: (id: string) => createSessionMock(id),
    resumeUrl: (payment: unknown, path: string) => resumeUrlMock(payment, path),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
  }),
}));

function offer(over: Partial<ServiceOffer> = {}): ServiceOffer {
  return {
    id: 'offer1',
    requestId: 'req1',
    price: 1500,
    currency: 'TL',
    details: 'Some details',
    imagePaths: [],
    expiresAt: null,
    status: 'sent',
    createdAt: '2026-08-01T10:00:00Z',
    ...over,
  };
}

function payment(over: Partial<ServicePayment> = {}): ServicePayment {
  return {
    id: 'pay1',
    requestId: 'req1',
    offerId: 'offer1',
    amount: 1500,
    currency: 'TL',
    status: 'pending',
    createdAt: '2026-08-01T10:00:00Z',
    verifiedAt: null,
    gatewaySessionId: 'sess1',
    ...over,
  };
}

async function renderCard(props: { offer: ServiceOffer; payment?: ServicePayment; onChanged?: () => void }) {
  const { ServiceOfferCard } = await import('./ServiceOfferCard');
  return render(
    <ServiceOfferCard offer={props.offer} payment={props.payment} onChanged={props.onChanged ?? vi.fn()} />,
  );
}

beforeEach(() => {
  rejectMock.mockReset().mockResolvedValue({ ok: true });
  createSessionMock.mockReset();
  resumeUrlMock.mockReset().mockReturnValue('https://example.test/pay?session=sess1');
});

describe('render states', () => {
  it('a freshly sent offer shows pay/reject actions', async () => {
    await renderCard({ offer: offer({ status: 'sent' }) });
    expect(screen.getByText('serviceOffer.payCta')).toBeInTheDocument();
    expect(screen.getByText('serviceOffer.reject')).toBeInTheDocument();
  });

  it('a rejected offer shows the rejected note, not pay/reject actions', async () => {
    await renderCard({ offer: offer({ status: 'rejected' }) });
    expect(screen.getByText('serviceOffer.youRejected')).toBeInTheDocument();
    expect(screen.queryByText('serviceOffer.payCta')).toBeNull();
  });

  it('an expired offer shows the expired note, not pay/reject actions', async () => {
    await renderCard({ offer: offer({ status: 'expired' }) });
    expect(screen.getByText('serviceOffer.offerExpired')).toBeInTheDocument();
    expect(screen.queryByText('serviceOffer.payCta')).toBeNull();
  });

  it('a superseded offer shows the superseded note', async () => {
    await renderCard({ offer: offer({ status: 'superseded' }) });
    expect(screen.getByText('serviceOffer.superseded')).toBeInTheDocument();
  });

  it('a verified payment shows the paid badge instead of any action', async () => {
    await renderCard({ offer: offer(), payment: payment({ status: 'verified' }) });
    expect(screen.getByText('serviceOffer.paid')).toBeInTheDocument();
    expect(screen.queryByText('serviceOffer.payCta')).toBeNull();
  });

  it('a pending payment shows a resume-payment link built from the stored session', async () => {
    await renderCard({ offer: offer(), payment: payment({ status: 'pending' }) });
    const link = screen.getByText('serviceOffer.resumePayment').closest('a');
    expect(link).toHaveAttribute('href', 'https://example.test/pay?session=sess1');
  });

  it('a rejected payment shows a rejected note (offer stays sent, admin can be paid another way)', async () => {
    await renderCard({ offer: offer(), payment: payment({ status: 'rejected' }) });
    expect(screen.getByText('serviceOffer.paymentRejected')).toBeInTheDocument();
  });

  it('an offer past its expiry date shown as "sent" still hides pay/reject (client-side expiry mirrors server check)', async () => {
    await renderCard({ offer: offer({ status: 'sent', expiresAt: '2000-01-01T00:00:00Z' }) });
    expect(screen.queryByText('serviceOffer.payCta')).toBeNull();
  });
});

describe('reject flow', () => {
  it('requires confirmation before calling the reject RPC', async () => {
    const onChanged = vi.fn();
    await renderCard({ offer: offer(), onChanged });

    fireEvent.click(screen.getByText('serviceOffer.reject'));
    expect(rejectMock).not.toHaveBeenCalled();
    expect(screen.getByText('serviceOffer.rejectConfirm')).toBeInTheDocument();

    fireEvent.click(screen.getByText('serviceOffer.rejectConfirmBtn'));
    await screen.findByText('serviceOffer.reject');
    expect(rejectMock).toHaveBeenCalledWith('offer1');
    expect(onChanged).toHaveBeenCalled();
  });

  it('shows an error instead of silently failing when the reject call rejects', async () => {
    rejectMock.mockRejectedValue(new Error('network'));
    await renderCard({ offer: offer() });

    fireEvent.click(screen.getByText('serviceOffer.reject'));
    fireEvent.click(screen.getByText('serviceOffer.rejectConfirmBtn'));

    expect(await screen.findByText('serviceOffer.error')).toBeInTheDocument();
  });
});

describe('OfferPhotoLightbox navigation', () => {
  const photoOffer = offer({ imagePaths: ['a.jpg', 'b.jpg', 'c.jpg'] });

  /** Thumbnails render with alt="" (decorative) so they aren't exposed with
   *  role "img" — query the raw <img> elements instead. */
  function thumbnails(container: HTMLElement): HTMLImageElement[] {
    return [...container.querySelectorAll('img')];
  }

  it('opens on the clicked thumbnail and shows the position counter', async () => {
    const { container } = await renderCard({ offer: photoOffer });
    fireEvent.click(thumbnails(container)[1].closest('button')!);
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
  });

  it('the next arrow advances, wrapping past the last photo', async () => {
    const { container } = await renderCard({ offer: photoOffer });
    fireEvent.click(thumbnails(container)[2].closest('button')!);
    await screen.findByText('3 / 3');
    fireEvent.click(screen.getByLabelText('realEstate.detail.nextPhoto'));
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
  });

  it('the prev arrow retreats, wrapping before the first photo', async () => {
    const { container } = await renderCard({ offer: photoOffer });
    fireEvent.click(thumbnails(container)[0].closest('button')!);
    await screen.findByText('1 / 3');
    fireEvent.click(screen.getByLabelText('realEstate.detail.prevPhoto'));
    expect(await screen.findByText('3 / 3')).toBeInTheDocument();
  });

  it('ArrowRight/ArrowLeft keys move through the same sequence', async () => {
    const { container } = await renderCard({ offer: photoOffer });
    fireEvent.click(thumbnails(container)[0].closest('button')!);
    await screen.findByText('1 / 3');
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
  });

  it('a swipe past the threshold changes photo; a short swipe (tap) does not', async () => {
    const { container } = await renderCard({ offer: photoOffer });
    fireEvent.click(thumbnails(container)[0].closest('button')!);
    const surface = (await screen.findByText('1 / 3')).parentElement!;

    fireEvent.touchStart(surface, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 195 }] });
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    fireEvent.touchStart(surface, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(surface, { changedTouches: [{ clientX: 100 }] });
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
  });

  it('a single photo renders without arrows or a counter', async () => {
    const { container } = await renderCard({ offer: offer({ imagePaths: ['solo.jpg'] }) });
    fireEvent.click(thumbnails(container)[0].closest('button')!);
    expect(document.querySelectorAll('img')).toHaveLength(2); // thumbnail + lightbox image
    expect(screen.queryByLabelText('realEstate.detail.nextPhoto')).toBeNull();
  });
});
