import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * The success screen is the ONLY place in the product that tells a customer
 * /requests exists. It used to be unreachable in practice: ServiceRequestModal
 * fired window.open() to WhatsApp at submit, which on a phone is an app switch,
 * so the customer left the browser before this rendered and never saw the track
 * button.
 *
 * With the redirect gone, both actions live here as peers. These tests pin that
 * shape: two CTAs, equal geometry, and no automatic navigation.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, vars?: Record<string, unknown>) =>
      vars && Object.keys(vars).length ? `${k} ${Object.values(vars).join(' ')}` : k,
  }),
}));

const WA = 'https://wa.me/905551112233?text=hello';

async function renderSuccess(over: { waHref?: string | null; onTrack?: () => void; onWhatsApp?: () => void } = {}) {
  const { BestOfferSearching } = await import('./BestOfferSearching');
  const view = render(
    <BestOfferSearching
      serviceName="İkamet"
      onTrack={over.onTrack ?? (() => {})}
      onBack={() => {}}
      waHref={over.waHref === undefined ? WA : over.waHref}
      onWhatsApp={over.onWhatsApp}
    />,
  );
  // The animation runs on requestAnimationFrame for 6.4s; "skip" jumps to the
  // success state without waiting on real time.
  fireEvent.click(screen.getByRole('button', { name: 'bestOffer.skip' }));
  return view;
}

describe('success screen CTAs', () => {
  it('renders BOTH the track button and the WhatsApp button', async () => {
    await renderSuccess();

    expect(screen.getByRole('button', { name: 'bestOffer.track' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'services.modal.whatsapp' })).toBeInTheDocument();
  });

  it('gives them equal visual weight — same size, padding, radius and weight', async () => {
    await renderSuccess();

    const track = screen.getByRole('button', { name: 'bestOffer.track' });
    const wa = screen.getByRole('link', { name: 'services.modal.whatsapp' });

    // Only colour may differ; if geometry drifts, one becomes the "real" action
    // and the other an afterthought, which is the bug this screen just fixed.
    for (const prop of ['fontSize', 'fontWeight', 'borderRadius', 'padding'] as const) {
      expect(wa.style[prop]).toBe(track.style[prop]);
    }
  });

  it('keeps both above the 44px touch minimum', async () => {
    await renderSuccess();

    for (const el of [
      screen.getByRole('button', { name: 'bestOffer.track' }),
      screen.getByRole('link', { name: 'services.modal.whatsapp' }),
    ]) {
      expect(parseInt(el.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    }
  });

  it('track is a real callback, not a navigation side effect', async () => {
    const onTrack = vi.fn();
    await renderSuccess({ onTrack });

    fireEvent.click(screen.getByRole('button', { name: 'bestOffer.track' }));
    expect(onTrack).toHaveBeenCalledTimes(1);
  });

  it('reports the WhatsApp tap so the choice is measurable', async () => {
    const onWhatsApp = vi.fn();
    await renderSuccess({ onWhatsApp });

    fireEvent.click(screen.getByRole('link', { name: 'services.modal.whatsapp' }));
    expect(onWhatsApp).toHaveBeenCalledTimes(1);
  });

  it('omits WhatsApp entirely when no number is configured — never a dead link', async () => {
    await renderSuccess({ waHref: null });

    expect(screen.getByRole('button', { name: 'bestOffer.track' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'services.modal.whatsapp' })).toBeNull();
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
  });

  it('opens WhatsApp in a new tab so the confirmation is never lost', async () => {
    await renderSuccess();

    const wa = screen.getByRole('link', { name: 'services.modal.whatsapp' });
    expect(wa.getAttribute('target')).toBe('_blank');
    expect(wa.getAttribute('rel')).toContain('noreferrer');
  });
});
