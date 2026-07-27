import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useApp } from '../context/AppContext';

/**
 * The notification entry point: a bell that rings while something is unread.
 *
 * Drawn from four positioned divs rather than an icon font or SVG because the
 * clapper has to swing INDEPENDENTLY of the bell body — that lag is the whole
 * effect, and it needs two separately animated nodes to exist.
 *
 * The glyph is authored once in a fixed 46x46 space (the proportions come from
 * the design) and scaled to whatever `size` the caller needs, so a 36px header
 * chip and a 40px hero chip stay pixel-identical in shape.
 *
 * Keyframes live in index.css (.bell-*), where prefers-reduced-motion already
 * switches them off — a silent bell still shows its badge, so nothing is lost.
 */

/** The coordinate space the bell shape is authored in. */
const GLYPH = 46;
/** The button size that glyph was drawn against — everything scales off this. */
const BASE_BUTTON = 84;

export function NotificationBell({
  size = 40,
  tone = 'light',
  className = '',
}: {
  /** Button edge length in px. The bell scales to match. */
  size?: number;
  /** `onNavy` for the mobile hero (white bell); `light` for white headers. */
  tone?: 'light' | 'onNavy';
  /**
   * Margin/z-index are fine here, but NOT position: the bell is `relative` for
   * its own badge and ring, and Tailwind emits .relative after .absolute, so an
   * `absolute` passed in silently loses. Wrap the bell instead.
   */
  className?: string;
}) {
  const { t } = useTranslation();
  const { unread } = useApp();

  const hasUnread = unread > 0;
  const scale = size / BASE_BUTTON;
  const ink = tone === 'onNavy' ? '#ffffff' : '#12306e';
  const surface = tone === 'onNavy' ? 'bg-white/15 active:bg-white/25' : 'bg-navy-50 hover:bg-navy-100';

  /** Shared by the four bell parts — they are all just solid rounded blocks. */
  const part = (style: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    background: ink,
    ...style,
  });

  return (
    <Link
      to="/notifications"
      aria-label={hasUnread ? t('nav.notificationsUnread', { count: unread }) : t('nav.notifications')}
      className={`relative inline-flex shrink-0 items-center justify-center transition-transform active:scale-95 ${surface} ${className}`}
      style={{ width: size, height: size, borderRadius: size / 3 }}
    >
      {/* pulse escaping the button — only while something is waiting */}
      {hasUnread && (
        <span
          aria-hidden
          className="bell-ring pointer-events-none absolute inset-0"
          style={{
            opacity: 0,
            borderRadius: size / 3,
            border: `${Math.max(2, size * 0.036)}px solid ${tone === 'onNavy' ? 'rgba(255,255,255,0.45)' : 'rgba(18,48,110,0.35)'}`,
          }}
        />
      )}

      <span
        aria-hidden
        style={{ width: GLYPH, height: GLYPH, transform: `scale(${scale})`, transformOrigin: 'center', flex: 'none' }}
      >
        <span
          className={hasUnread ? 'bell-shake' : undefined}
          style={{ position: 'relative', display: 'block', width: GLYPH, height: GLYPH }}
        >
          {/* crown */}
          <span style={part({ left: '50%', top: 1, width: 7, height: 7, marginLeft: -3.5, borderRadius: '50%' })} />
          {/* body */}
          <span style={part({ left: 7, top: 6, width: 32, height: 27, borderRadius: '16px 16px 5px 5px' })} />
          {/* lip */}
          <span style={part({ left: 1, top: 31, width: 44, height: 7, borderRadius: 4 })} />
          {/* clapper — swings a beat behind the body */}
          <span
            className={hasUnread ? 'bell-clap' : undefined}
            style={part({ left: '50%', top: 39, width: 10, height: 10, marginLeft: -5, borderRadius: '50%' })}
          />
        </span>
      </span>

      {hasUnread && (
        <span
          className="bell-badge absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white"
          /* the ring punches the badge out of whatever it sits on */
          style={{ boxShadow: `0 0 0 2px ${tone === 'onNavy' ? '#1a3a6b' : '#ffffff'}` }}
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
