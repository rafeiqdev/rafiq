import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '../hooks/useIsMobile';

/**
 * Full-screen "searching Istanbul offices for your best offer" animation,
 * shown right after a service order is confirmed. Purely visual/timed —
 * it has no idea whether a real offer ever arrives; the caller decides
 * where "Track your request" and "Back to home" actually go.
 *
 * Light "daylight map" redesign: cream canvas, navy accents, and a real
 * satellite photo of Istanbul under the pins. Desktop frames the map in a
 * rounded card with the status line in a footer; phone runs the map
 * edge-to-edge with the status floating above the safe area.
 */

const DURATION_S = 7.4;

const NAVY = '#1a3a6b';
const NAVY_LIGHT = '#2c4f8a';
const CREAM = '#faf8f0';

/**
 * Pin fields and marker sizes are calibrated per layout: the desktop map
 * shows the whole 2025x777 photo (slice-cropped a little), the phone crop
 * only keeps the strip around the Bosphorus, so pins must stay inside it
 * and every radius shrinks with the viewport.
 */
const DESKTOP_VARIANT = {
  seed: 20260723,
  pinTarget: 34,
  pinMinDist: 158,
  userX: 955,
  userY: 420,
  inLand(x: number, y: number) {
    if (x < 165 || x > 1875 || y < 90 || y > 452) return false;
    if (x > 1000 && x < 1100) return false; // Bosphorus strait
    if (x > 935 && x < 1175 && y > 405) return false; // strait mouth / Golden Horn
    if (x < 560 && y > 400) return false; // SW Marmara coastline
    if (x > 1720 && y > 415) return false; // SE coastline
    const dx = (x - 302) / 82;
    const dy = (y - 342) / 112;
    if (dx * dx + dy * dy < 1) return false; // Küçükçekmece lake
    const bx = (x - 640) / 70;
    const by = (y - 300) / 90;
    if (bx * bx + by * by < 1) return false; // Büyükçekmece lake
    return true;
  },
  spawn(r: () => number) {
    return { x: 165 + r() * 1710, y: 90 + r() * 362 };
  },
  user: { halo: [48, 20], ring: [24, 11], coreOuter: 13.5, core: 10, ringWidth: 2.8 },
  pin: { halo: [12, 5.5], r: 7.5, lit: 2.6, outline: 2.2, lineWidth: 2.6, dot: 4.8 },
} as const;

const PHONE_VARIANT = {
  seed: 20260728,
  pinTarget: 16,
  pinMinDist: 74,
  userX: 1012,
  userY: 440,
  inLand(x: number, y: number) {
    if (y < 60 || y > 452) return false;
    if (x >= 1000 && x <= 1100) return false; // Bosphorus strait
    if (x > 935 && x < 1175 && y > 405) return false; // strait mouth
    return (x >= 835 && x <= 995) || (x >= 1105 && x <= 1190);
  },
  spawn(r: () => number) {
    // portrait slice shows roughly x 820–1205 of the 2025-wide map
    return { x: 835 + r() * 355, y: 60 + r() * 392 };
  },
  user: { halo: [34, 14], ring: [17, 8], coreOuter: 9.5, core: 7, ringWidth: 2 },
  pin: { halo: [9, 4], r: 5.4, lit: 1.8, outline: 1.6, lineWidth: 1.8, dot: 3.4 },
} as const;

type Variant = typeof DESKTOP_VARIANT | typeof PHONE_VARIANT;

/**
 * Shared geometry for the two success-screen CTAs. Identical padding, radius,
 * size and weight is what makes "track" and "WhatsApp" read as equal choices —
 * only the colour differs. Also keeps both above the 44px touch minimum.
 */
const CTA_BASE: CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 'clamp(15px,1.8vw,17px)',
  fontWeight: 700,
  border: 'none',
  borderRadius: 12,
  padding: '14px 32px',
  minHeight: 50,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

function mixColor(a: string, b: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const A = p(a);
  const B = p(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

interface Pin {
  x: number;
  y: number;
  appear: number;
  line: number;
}

/** Deterministic pin layout, avoiding water (Bosphorus, Golden Horn, the lakes) on the map photo. */
function buildPins(variant: Variant): Pin[] {
  let s: number = variant.seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  const pins: Pin[] = [];
  let tries = 0;
  while (pins.length < variant.pinTarget && tries < 6000) {
    tries++;
    const { x, y } = variant.spawn(rand);
    if (!variant.inLand(x, y)) continue;
    let ok = true;
    for (const p of pins) {
      const a = p.x - x;
      const b = p.y - y;
      if (a * a + b * b < variant.pinMinDist * variant.pinMinDist) {
        ok = false;
        break;
      }
    }
    if (ok) pins.push({ x, y, appear: 0, line: 0 });
  }
  const n = pins.length;
  pins.forEach((p, i) => {
    p.appear = 1.6 + (i / n) * 1.9;
    p.line = 3.5 + (i / n) * 1.25;
  });
  return pins;
}

export function BestOfferSearching({
  serviceName,
  officeCount = 134,
  onTrack,
  onBack,
  waHref = null,
  onWhatsApp,
}: {
  serviceName: string;
  officeCount?: number;
  onTrack: () => void;
  onBack: () => void;
  /** wa.me link, or null when no WhatsApp number is configured. */
  waHref?: string | null;
  onWhatsApp?: () => void;
}) {
  const { t } = useTranslation();
  const isPhone = useIsMobile();
  const variant = isPhone ? PHONE_VARIANT : DESKTOP_VARIANT;
  const [time, setTime] = useState(0);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number>();
  const startRef = useRef(0);
  const pins = useMemo(() => buildPins(variant), [variant]);

  const loop = (now: number) => {
    const elapsed = (now - startRef.current) / 1000;
    if (elapsed >= DURATION_S) {
      setTime(DURATION_S);
      setDone(true);
      return;
    }
    setTime(elapsed);
    rafRef.current = requestAnimationFrame(loop);
  };

  const start = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = performance.now();
    setTime(0);
    setDone(false);
    rafRef.current = requestAnimationFrame(loop);
  };

  const skip = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTime(DURATION_S);
    setDone(true);
  };

  useEffect(() => {
    start();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tt = time;
  /** Photo fades from a hint to full presence; svg markers fade in with it. */
  const layerOp = clamp01((tt - 0.6) / 1.0);
  const mapOp = 0.35 + 0.65 * layerOp;
  const litP = clamp01((tt - 5.0) / 0.6);

  let count = tt <= 3.5 ? 0 : tt >= 5.0 ? officeCount : Math.round(((tt - 3.5) / 1.5) * officeCount);
  if (done) count = officeCount;

  // One text at a time: the sentence bows out as soon as the counter chip lands.
  const statusOpacity = tt < 0.6 ? clamp01(tt / 0.6) : clamp01((3.5 - tt) / 0.4);
  const counterOpacity = tt >= 5.0 ? clamp01((5.4 - tt) / 0.4) : clamp01((tt - 3.4) / 0.4);
  const successP = clamp01((tt - 5.0) / 0.6);
  // The check icon animates alone first; the text follows only once it lands.
  const checkP = clamp01((tt - 5.05) / 0.85);
  const detailP = clamp01((tt - 6.4) / 0.6);
  const circLen = 2 * Math.PI * 36;
  const markLen = 62;

  const userPulse = 0.5 + 0.5 * Math.sin(tt * 2.4);
  const lineFade = clamp01(1 - (tt - 5.5) / 0.6);

  const { userX, userY, user, pin } = variant;

  const chipButton: CSSProperties = {
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    color: NAVY,
    background: 'rgba(255,255,255,0.88)',
    border: '1px solid rgba(26,58,107,0.22)',
    borderRadius: 999,
    padding: '8px 16px',
    backdropFilter: 'blur(6px)',
    boxShadow: '0 2px 10px rgba(26,58,107,0.08)',
  };

  const mapArea = (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(rgba(250,248,240,0.32),rgba(250,248,240,0.32)),url(/img/istanbul-map.webp) center/cover no-repeat`,
          opacity: mapOp,
          pointerEvents: 'none',
        }}
      />
      <svg
        viewBox="0 0 2025 777"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: 'block', position: 'absolute', inset: 0 }}
      >
        <circle cx={userX} cy={userY} r={user.halo[0] + user.halo[1] * userPulse} fill={NAVY} opacity={layerOp * 0.12} />
        <circle
          cx={userX}
          cy={userY}
          r={user.ring[0] + user.ring[1] * userPulse}
          fill="none"
          stroke={NAVY}
          strokeWidth={user.ringWidth}
          opacity={layerOp * (0.55 - 0.4 * userPulse)}
        />
        <circle cx={userX} cy={userY} r={user.coreOuter} fill="#ffffff" opacity={layerOp} />
        <circle cx={userX} cy={userY} r={user.core} fill={NAVY} opacity={layerOp} />

        {pins.map((p, i) => {
          const lp = clamp01((tt - p.line) / 0.5);
          const op = lp * lineFade;
          if (op <= 0.02) return null;
          const dx = userX + (p.x - userX) * lp;
          const dy = userY + (p.y - userY) * lp;
          return (
            <g key={`line-${i}`}>
              <line
                x1={userX}
                y1={userY}
                x2={dx}
                y2={dy}
                stroke={NAVY_LIGHT}
                strokeWidth={pin.lineWidth}
                strokeLinecap="round"
                opacity={op * 0.6}
              />
              <circle cx={dx} cy={dy} r={pin.dot} fill={NAVY} opacity={op} />
            </g>
          );
        })}

        {pins.map((p, i) => {
          const ap = clamp01((tt - p.appear) / 0.45);
          if (ap <= 0.02) return null;
          const pulse = 0.5 + 0.5 * Math.sin(tt * 3 + i);
          const haloR = (pin.halo[0] + pin.halo[1] * pulse) * (0.7 + 0.6 * ap);
          const fill = litP > 0 ? mixColor(NAVY, '#111111', litP) : NAVY;
          const r = pin.r * ap + pin.lit * litP;
          return (
            <g key={`pin-${i}`}>
              <circle cx={p.x} cy={p.y} r={haloR} fill={NAVY} opacity={ap * (0.14 + 0.1 * pulse + 0.18 * litP)} />
              <circle cx={p.x} cy={p.y} r={r + pin.outline} fill="#ffffff" opacity={ap * 0.9} />
              <circle cx={p.x} cy={p.y} r={r} fill={fill} opacity={ap} />
              {litP > 0.35 && <circle cx={p.x} cy={p.y} r={(pin.dot / 1.6) * litP} fill="#ffffff" opacity={litP} />}
            </g>
          );
        })}
      </svg>

      <div
        style={{
          position: 'absolute',
          top: isPhone ? 'calc(env(safe-area-inset-top, 0px) + 20px)' : '5%',
          left: '50%',
          transform: 'translateX(-50%)',
          opacity: counterOpacity,
          display: 'inline-flex',
          alignItems: 'center',
          gap: isPhone ? 8 : 10,
          padding: isPhone ? '9px 16px' : '10px 20px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.92)',
          boxShadow: '0 2px 12px rgba(26,58,107,0.10)',
          fontSize: isPhone ? 14 : 'clamp(14px,1.7vw,19px)',
          fontWeight: 700,
          color: NAVY,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <span
          style={{
            width: isPhone ? 8 : 9,
            height: isPhone ? 8 : 9,
            borderRadius: '50%',
            background: NAVY,
            boxShadow: '0 0 0 4px rgba(26,58,107,0.15)',
            flex: 'none',
          }}
        />
        <span>{t('bestOffer.counter', { count })}</span>
      </div>

      {isPhone && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
            left: 20,
            right: 20,
            opacity: statusOpacity,
            fontSize: 15,
            fontWeight: 600,
            color: 'rgba(26,58,107,0.8)',
            textAlign: 'center',
            lineHeight: 1.7,
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          {t(tt < 1.6 ? 'bestOffer.preparing' : 'bestOffer.sending')}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          opacity: successP,
          pointerEvents: successP > 0.6 ? 'auto' : 'none',
          background: 'rgba(250,248,240,0.72)',
          backdropFilter: 'blur(3px)',
          overflowY: 'auto',
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            margin: 'auto',
            maxHeight: '100%',
            overflowY: 'auto',
            width: isPhone ? 'min(400px,100%)' : 'min(520px,94%)',
            padding: isPhone ? 'clamp(20px,3.5vh,32px) 20px' : 'clamp(18px,3vh,44px) clamp(22px,4vw,40px)',
            background: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(26,58,107,0.10)',
            transform: `translateY(${(1 - successP) * 22}px) scale(${0.94 + 0.06 * successP})`,
          }}
        >
          <div
            style={{
              position: 'relative',
              width: isPhone ? 'clamp(64px,10vh,92px)' : 'clamp(64px,9vh,104px)',
              height: isPhone ? 'clamp(64px,10vh,92px)' : 'clamp(64px,9vh,104px)',
              flex: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '-14%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(26,58,107,0.18) 0%, rgba(26,58,107,0) 70%)',
                opacity: clamp01((checkP - 0.2) / 0.5),
              }}
            />
            <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: 'relative' }}>
              <circle cx={50} cy={50} r={44} fill="#eef2f8" />
              <circle cx={50} cy={50} r={36} fill="none" stroke="#d6e0ee" strokeWidth={7} />
              <circle
                cx={50}
                cy={50}
                r={36}
                fill="none"
                stroke={NAVY}
                strokeWidth={7}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ strokeDasharray: circLen, strokeDashoffset: circLen * (1 - clamp01(checkP * 1.15)) }}
              />
              <polyline
                points="34,51 45,63 68,37"
                fill="none"
                stroke="#12294d"
                strokeWidth={7.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ strokeDasharray: markLen, strokeDashoffset: markLen * (1 - clamp01((checkP - 0.4) / 0.6)) }}
              />
            </svg>
          </div>
          <div
            style={{
              opacity: detailP,
              transform: `translateY(${(1 - detailP) * 10}px)`,
              maxHeight: detailP <= 0 ? 0 : detailP * 600,
              overflow: 'hidden',
              width: '100%',
            }}
          >
            <h2
              style={{
                margin: isPhone ? '14px 0 8px' : 'clamp(12px,2vh,20px) 0 8px',
                fontSize: isPhone ? 'clamp(20px,5.6vw,24px)' : 'clamp(21px,3vh,33px)',
                fontWeight: 800,
                color: NAVY,
                letterSpacing: '-0.3px',
              }}
            >
              {t('bestOffer.successTitle')}
            </h2>
            <p
              style={{
                margin: '0 auto',
                maxWidth: isPhone ? 320 : 460,
                fontSize: isPhone ? 'clamp(14px,3.9vw,16px)' : 'clamp(15px,1.9vw,19px)',
                color: 'rgba(26,58,107,0.7)',
                lineHeight: 1.7,
              }}
            >
              {t('bestOffer.successSub', { service: serviceName })}
            </p>
            <p
              style={{
                margin: isPhone ? '8px 0 0' : '10px 0 0',
                fontSize: isPhone ? 'clamp(12px,3.4vw,13px)' : 'clamp(13px,1.6vw,15px)',
                color: NAVY,
                fontWeight: 700,
              }}
            >
              {t('requests.reassurance.sla')}
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: isPhone ? 8 : 10,
                marginTop: isPhone ? 14 : 'clamp(12px,2vh,20px)',
                padding: isPhone ? '9px 14px' : '10px 18px',
                borderRadius: 999,
                background: '#eafaf0',
                border: '1px solid rgba(37,211,102,0.4)',
              }}
            >
              <svg width={isPhone ? 16 : 18} height={isPhone ? 16 : 18} viewBox="0 0 24 24" fill="#25d366" style={{ flex: 'none' }}>
                <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.6.8 2 .9 2.1.1.1.1.3 0 .5-.1.2-.2.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.7.9.2.1.4.2.4.3.1.1.1.6-.1 1.2Z" />
              </svg>
              <span style={{ fontSize: isPhone ? 'clamp(12px,3.4vw,14px)' : 'clamp(13px,1.6vw,16px)', color: '#12603a', fontWeight: 600 }}>
                {t('bestOffer.whatsapp')}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: isPhone ? 10 : 12,
                marginTop: isPhone ? 18 : 'clamp(14px,2.4vh,28px)',
                width: '100%',
              }}
            >
              {/* Two peers, not a primary and an afterthought. WhatsApp used
                  to be a window.open() fired at submit, which ejected the
                  customer from the browser before this screen rendered — so
                  the track button, the only pointer to /requests in the
                  product, was never seen. Both are now choices made here,
                  after reading, and share one geometry so neither reads as
                  the "real" action. */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: isPhone ? 'column' : 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                  gap: isPhone ? 10 : 12,
                  width: isPhone ? '100%' : 'auto',
                }}
              >
                <button
                  onClick={onTrack}
                  style={{ ...CTA_BASE, color: '#ffffff', background: NAVY, boxShadow: '0 8px 20px rgba(26,58,107,0.28)' }}
                >
                  {t('bestOffer.track')}
                </button>
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={onWhatsApp}
                    style={{ ...CTA_BASE, color: '#ffffff', background: '#25d366', boxShadow: '0 8px 20px rgba(37,211,102,0.3)', textDecoration: 'none' }}
                  >
                    {t('services.modal.whatsapp')}
                  </a>
                )}
              </div>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onBack();
                }}
                style={{
                  fontSize: isPhone ? 15 : 'clamp(14px,1.7vw,16px)',
                  fontWeight: 600,
                  color: 'rgba(26,58,107,0.6)',
                  padding: isPhone ? 8 : 0,
                }}
              >
                {t('bestOffer.back')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        width: '100%',
        minHeight: '100vh',
        height: '100dvh',
        background: CREAM,
        color: NAVY,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'absolute',
          ...(isPhone
            ? { top: 'calc(env(safe-area-inset-top, 0px) + 16px)', insetInlineEnd: 16 }
            : { bottom: 16, insetInlineEnd: 20 }),
          zIndex: 30,
          display: 'flex',
          gap: 8,
        }}
      >
        {!done && (
          <button onClick={skip} style={chipButton}>
            {t('bestOffer.skip')}
          </button>
        )}
        {done && (
          <button onClick={start} style={chipButton}>
            {t('bestOffer.replay')}
          </button>
        )}
      </div>

      {isPhone ? (
        <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>{mapArea}</div>
      ) : (
        <>
          <div
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'clamp(20px,4vw,44px) clamp(16px,3vw,48px) 0',
              minHeight: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                maxWidth: 1120,
                margin: 'auto',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              {mapArea}
            </div>
          </div>

          <footer
            style={{
              padding: 'clamp(16px,3.5vw,30px) 24px',
              minHeight: 88,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <div
              style={{
                opacity: statusOpacity,
                fontSize: 'clamp(15px,1.9vw,20px)',
                fontWeight: 600,
                color: 'rgba(26,58,107,0.75)',
                textAlign: 'center',
                maxWidth: 640,
                margin: '0 auto',
                lineHeight: 1.7,
              }}
            >
              {t(tt < 1.6 ? 'bestOffer.preparing' : 'bestOffer.sending')}
            </div>
          </footer>
        </>
      )}
    </div>,
    document.body,
  );
}
