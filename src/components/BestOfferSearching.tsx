import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

/**
 * Full-screen "searching Istanbul offices for your best offer" animation,
 * shown right after a service order is confirmed. Purely visual/timed —
 * it has no idea whether a real offer ever arrives; the caller decides
 * where "Track your request" and "Back to home" actually go.
 */

const DURATION_S = 6.4;
const PIN_TARGET = 34;
const PIN_MIN_DIST = 158;
/** Fixed seed so the pin layout is stable across renders/reloads. */
const PIN_SEED = 20260723;
/** User marker position in the 2025x777 map viewBox. */
const USER_X = 955;
const USER_Y = 420;

/**
 * Shared geometry for the two success-screen CTAs. Identical padding, radius,
 * size and weight is what makes "track" and "WhatsApp" read as equal choices —
 * only the colour differs. Also keeps both above the 44px touch minimum.
 */
const CTA_BASE: CSSProperties = {
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 'clamp(16px,1.9vw,19px)',
  fontWeight: 700,
  border: 'none',
  borderRadius: 14,
  padding: '15px 34px',
  minHeight: 44,
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

/** Deterministic pin layout, avoiding water (Bosphorus, Golden Horn, the two lakes) on the map art. */
function buildPins(): Pin[] {
  let s = PIN_SEED;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const inLand = (x: number, y: number) => {
    if (x < 165 || x > 1875 || y < 90 || y > 452) return false;
    if (x > 1000 && x < 1100) return false;
    if (x > 935 && x < 1175 && y > 405) return false;
    if (x < 560 && y > 400) return false;
    if (x > 1720 && y > 415) return false;
    const dx = (x - 302) / 82;
    const dy = (y - 342) / 112;
    if (dx * dx + dy * dy < 1) return false;
    const bx = (x - 640) / 70;
    const by = (y - 300) / 90;
    if (bx * bx + by * by < 1) return false;
    return true;
  };

  const pins: Pin[] = [];
  let tries = 0;
  while (pins.length < PIN_TARGET && tries < 6000) {
    tries++;
    const x = 165 + rand() * 1710;
    const y = 90 + rand() * 362;
    if (!inLand(x, y)) continue;
    let ok = true;
    for (const p of pins) {
      const a = p.x - x;
      const b = p.y - y;
      if (a * a + b * b < PIN_MIN_DIST * PIN_MIN_DIST) {
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
  const [time, setTime] = useState(0);
  const [done, setDone] = useState(false);
  const rafRef = useRef<number>();
  const startRef = useRef(0);
  const pins = useMemo(buildPins, []);

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
  const mapOp = clamp01((tt - 0.6) / 1.0);
  const litP = clamp01((tt - 5.0) / 0.6);

  let count = tt <= 3.5 ? 0 : tt >= 5.0 ? officeCount : Math.round(((tt - 3.5) / 1.5) * officeCount);
  if (done) count = officeCount;

  const statusOpacity = tt >= 5.0 ? 0 : tt < 0.6 ? clamp01(tt / 0.6) : tt > 4.6 ? clamp01((5.0 - tt) / 0.4) : 1;
  const counterOpacity = tt >= 5.0 ? clamp01((5.4 - tt) / 0.4) : clamp01((tt - 3.4) / 0.4);
  const successP = clamp01((tt - 5.0) / 0.6);
  const checkP = clamp01((tt - 5.05) / 0.7);
  const detailP = clamp01((tt - 5.7) / 0.5);
  const circLen = 2 * Math.PI * 36;
  const markLen = 62;

  const userPulse = 0.5 + 0.5 * Math.sin(tt * 2.4);
  const lineFade = clamp01(1 - (tt - 5.5) / 0.6);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        width: '100%',
        minHeight: '100vh',
        height: '100vh',
        background: 'radial-gradient(circle at 50% 38%, #10254a 0%, #0a1a33 60%, #071227 100%)',
        color: '#eaf1ff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ position: 'absolute', bottom: 16, insetInlineEnd: 20, zIndex: 30, display: 'flex', gap: 8 }}>
        {!done && (
          <button
            onClick={skip}
            style={{
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              color: '#9db6da',
              background: 'rgba(16,32,64,0.6)',
              border: '1px solid rgba(90,170,255,0.28)',
              borderRadius: 999,
              padding: '8px 16px',
              backdropFilter: 'blur(6px)',
            }}
          >
            {t('bestOffer.skip')}
          </button>
        )}
        {done && (
          <button
            onClick={start}
            style={{
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              color: '#9db6da',
              background: 'rgba(16,32,64,0.6)',
              border: '1px solid rgba(90,170,255,0.28)',
              borderRadius: 999,
              padding: '8px 16px',
              backdropFilter: 'blur(6px)',
            }}
          >
            {t('bestOffer.replay')}
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(20px,4vw,44px) clamp(0px,3vw,48px) 0',
          minHeight: 0,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 1120, margin: 'auto' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(rgba(5,10,24,0.34),rgba(5,10,24,0.34)),linear-gradient(rgba(12,42,92,0.20),rgba(12,42,92,0.20)),url(/img/istanbul-map.webp) center/contain no-repeat',
              opacity: mapOp,
              pointerEvents: 'none',
            }}
          />
          <svg
            viewBox="0 0 2025 777"
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block', position: 'relative' }}
          >
            <defs>
              <filter id="bestOfferGlow" x="-70%" y="-70%" width="240%" height="240%">
                <feGaussianBlur stdDeviation="3.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle cx={USER_X} cy={USER_Y} r={48 + 20 * userPulse} fill="#3aa5ff" opacity={mapOp * 0.12} />
            <circle
              cx={USER_X}
              cy={USER_Y}
              r={24 + 11 * userPulse}
              fill="none"
              stroke="#5bb2ff"
              strokeWidth={2.8}
              opacity={mapOp * (0.55 - 0.4 * userPulse)}
            />
            <circle cx={USER_X} cy={USER_Y} r={12} fill="#eaf5ff" opacity={mapOp} filter="url(#bestOfferGlow)" />

            {pins.map((p, i) => {
              const lp = clamp01((tt - p.line) / 0.5);
              const op = lp * lineFade;
              if (op <= 0.02) return null;
              const dx = USER_X + (p.x - USER_X) * lp;
              const dy = USER_Y + (p.y - USER_Y) * lp;
              return (
                <g key={`line-${i}`}>
                  <line
                    x1={USER_X}
                    y1={USER_Y}
                    x2={dx}
                    y2={dy}
                    stroke="#4aa8ff"
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    opacity={op * 0.55}
                    filter="url(#bestOfferGlow)"
                  />
                  <circle cx={dx} cy={dy} r={4.8} fill="#bfe0ff" opacity={op} filter="url(#bestOfferGlow)" />
                </g>
              );
            })}

            {pins.map((p, i) => {
              const ap = clamp01((tt - p.appear) / 0.45);
              if (ap <= 0.02) return null;
              const pulse = 0.5 + 0.5 * Math.sin(tt * 3 + i);
              const haloR = (12 + 5.5 * pulse) * (0.7 + 0.6 * ap);
              const fill = litP > 0 ? mixColor('#3aa5ff', '#a9d6ff', litP) : '#3aa5ff';
              return (
                <g key={`pin-${i}`}>
                  <circle cx={p.x} cy={p.y} r={haloR} fill="#3aa5ff" opacity={ap * (0.16 + 0.12 * pulse + 0.22 * litP)} />
                  <circle cx={p.x} cy={p.y} r={7.5 * ap + 2.6 * litP} fill={fill} opacity={ap} filter="url(#bestOfferGlow)" />
                  {litP > 0.35 && <circle cx={p.x} cy={p.y} r={3 * litP} fill="#eaf5ff" opacity={litP} />}
                </g>
              );
            })}
          </svg>

          <div
            style={{
              position: 'absolute',
              top: '5%',
              left: '50%',
              transform: 'translateX(-50%)',
              opacity: counterOpacity,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px',
              borderRadius: 999,
              background: 'rgba(10,26,54,0.72)',
              border: '1px solid rgba(90,170,255,0.38)',
              boxShadow: '0 0 28px rgba(58,165,255,0.28)',
              backdropFilter: 'blur(8px)',
              fontSize: 'clamp(14px,1.7vw,19px)',
              fontWeight: 700,
              color: '#dbebff',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#5bb2ff',
                boxShadow: '0 0 12px 2px rgba(91,178,255,0.9)',
                flex: 'none',
              }}
            />
            <span>{t('bestOffer.counter', { count })}</span>
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              opacity: successP,
              pointerEvents: successP > 0.6 ? 'auto' : 'none',
              background: 'radial-gradient(circle at 50% 45%, rgba(9,20,42,0.62) 0%, rgba(9,20,42,0.82) 70%)',
              backdropFilter: 'blur(3px)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                width: 'min(520px,92%)',
                padding: 'clamp(28px,4vw,44px) clamp(22px,4vw,40px)',
                background: '#ffffff',
                borderRadius: 26,
                boxShadow: '0 30px 70px rgba(4,14,34,0.55), 0 0 0 1px rgba(120,175,235,0.25)',
                transform: `translateY(${(1 - successP) * 22}px) scale(${0.94 + 0.06 * successP})`,
              }}
            >
              <div style={{ position: 'relative', width: 'clamp(84px,11vw,104px)', height: 'clamp(84px,11vw,104px)' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: '-14%',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(37,143,230,0.30) 0%, rgba(37,143,230,0) 70%)',
                    opacity: clamp01((checkP - 0.2) / 0.5),
                  }}
                />
                <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ position: 'relative' }}>
                  <circle cx={50} cy={50} r={44} fill="#eef6ff" />
                  <circle cx={50} cy={50} r={36} fill="none" stroke="#e0edfb" strokeWidth={7} />
                  <circle
                    cx={50}
                    cy={50}
                    r={36}
                    fill="none"
                    stroke="#2a8fe6"
                    strokeWidth={7}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    style={{ strokeDasharray: circLen, strokeDashoffset: circLen * (1 - clamp01(checkP * 1.15)) }}
                  />
                  <polyline
                    points="34,51 45,63 68,37"
                    fill="none"
                    stroke="#1b7fd6"
                    strokeWidth={7.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ strokeDasharray: markLen, strokeDashoffset: markLen * (1 - clamp01((checkP - 0.4) / 0.6)) }}
                  />
                </svg>
              </div>
              <div style={{ opacity: detailP, transform: `translateY(${(1 - detailP) * 10}px)` }}>
                <h2 style={{ margin: '20px 0 10px', fontSize: 'clamp(23px,3vw,33px)', fontWeight: 800, color: '#0e1f3d', letterSpacing: '-0.3px' }}>
                  {t('bestOffer.successTitle')}
                </h2>
                <p style={{ margin: '0 auto', maxWidth: 460, fontSize: 'clamp(15px,1.9vw,19px)', color: '#4a6690', lineHeight: 1.6 }}>
                  {t('bestOffer.successSub', { service: serviceName })}
                </p>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    marginTop: 20,
                    padding: '10px 18px',
                    borderRadius: 999,
                    background: '#eafaf0',
                    border: '1px solid rgba(37,211,102,0.4)',
                  }}
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="#25d366" style={{ flex: 'none' }}>
                    <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 .9-2.2.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5.2.6.8 2 .9 2.1.1.1.1.3 0 .5-.1.2-.2.3-.3.5l-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1.2.1 1.5.7 1.7.9.2.1.4.2.4.3.1.1.1.6-.1 1.2Z" />
                  </svg>
                  <span style={{ fontSize: 'clamp(13px,1.6vw,16px)', color: '#12603a', fontWeight: 600 }}>{t('bestOffer.whatsapp')}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginTop: 28 }}>
                  {/* Two peers, not a primary and an afterthought. WhatsApp used
                      to be a window.open() fired at submit, which ejected the
                      customer from the browser before this screen rendered — so
                      the track button, the only pointer to /requests in the
                      product, was never seen. Both are now choices made here,
                      after reading, and share one geometry so neither reads as
                      the "real" action. */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
                    <button onClick={onTrack} style={{ ...CTA_BASE, color: '#ffffff', background: '#1b8ae6', boxShadow: '0 10px 26px rgba(27,138,230,0.4)' }}>
                      {t('bestOffer.track')}
                    </button>
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={onWhatsApp}
                        style={{ ...CTA_BASE, color: '#ffffff', background: '#25d366', boxShadow: '0 10px 26px rgba(37,211,102,0.4)', textDecoration: 'none' }}
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
                    style={{ fontSize: 'clamp(14px,1.7vw,16px)', fontWeight: 600, color: '#5f7699' }}
                  >
                    {t('bestOffer.back')}
                  </a>
                </div>
              </div>
            </div>
          </div>
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
            fontSize: 'clamp(15px,1.9vw,21px)',
            fontWeight: 600,
            color: '#a9c6ee',
            textAlign: 'center',
            maxWidth: 640,
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          {t(tt < 1.6 ? 'bestOffer.preparing' : 'bestOffer.sending')}
        </div>
      </footer>
    </div>,
    document.body,
  );
}
