/**
 * Stylized Turkish residence-permit ("İkamet İzni") card illustration — bundled
 * SVG, no photo dependency. Used as the visual header on residency type cards.
 * `label` prints the permit type; `accent` tints the card band.
 */
export function IkametCard({ label, accent = '#1a3a6b' }: { label: string; accent?: string }) {
  return (
    // dir/direction forced to LTR: the ID card is a graphic and must never
    // mirror or re-flow its Latin text in RTL (Arabic/Farsi) pages.
    <svg
      viewBox="0 0 340 200"
      className="w-full h-full"
      role="img"
      aria-label={label}
      style={{ direction: 'ltr' }}
    >
      <defs>
        <linearGradient id={`ik-${label}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor="#12294d" />
        </linearGradient>
      </defs>

      {/* card body */}
      <rect x="14" y="18" width="312" height="164" rx="16" fill={`url(#ik-${label})`} />
      <rect x="14" y="18" width="312" height="164" rx="16" fill="none" stroke="#faf8f0" strokeOpacity="0.25" strokeWidth="1.5" />

      {/* header strip */}
      <text x="34" y="48" fill="#faf8f0" fontFamily="Inter, sans-serif" fontSize="13" fontWeight="800" letterSpacing="1.5">
        T.C. İKAMET İZNİ
      </text>
      <text x="34" y="64" fill="#faf8f0" fillOpacity="0.7" fontFamily="Inter, sans-serif" fontSize="9" letterSpacing="1">
        RESIDENCE PERMIT
      </text>

      {/* Turkish crescent + star */}
      <g transform="translate(296 46)">
        <circle cx="0" cy="0" r="11" fill="#c0392b" />
        <circle cx="3" cy="0" r="9" fill={accent} />
        <path d="M9 -4 l1.6 3.4 3.7 .4 -2.7 2.5 .7 3.6 -3.3 -1.8 -3.3 1.8 .7 -3.6 -2.7 -2.5 3.7 -.4 z" fill="#c0392b" transform="translate(2 0) scale(0.5)" />
      </g>

      {/* photo placeholder */}
      <rect x="34" y="84" width="72" height="84" rx="8" fill="#faf8f0" fillOpacity="0.92" />
      <circle cx="70" cy="116" r="16" fill={accent} fillOpacity="0.35" />
      <path d="M48 168 a22 22 0 0 1 44 0 z" fill={accent} fillOpacity="0.35" />

      {/* chip */}
      <rect x="122" y="86" width="30" height="22" rx="4" fill="#e8c66a" />
      <rect x="122" y="93" width="30" height="1.5" fill={accent} fillOpacity="0.5" />
      <rect x="135" y="86" width="1.5" height="22" fill={accent} fillOpacity="0.5" />

      {/* permit-type label */}
      <text x="166" y="102" fill="#faf8f0" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="700">
        {label}
      </text>

      {/* data lines */}
      <g fill="#faf8f0" fillOpacity="0.55">
        <rect x="122" y="120" width="150" height="7" rx="3.5" />
        <rect x="122" y="134" width="120" height="7" rx="3.5" />
        <rect x="122" y="148" width="172" height="7" rx="3.5" />
        <rect x="122" y="162" width="96" height="7" rx="3.5" />
      </g>
    </svg>
  );
}
