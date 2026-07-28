/**
 * Decorative stand-in map shown blurred behind the /map paywall.
 *
 * A locked page used to be a bare white card with a padlock — a visitor never
 * learned the map holds vetted restaurants, hospitals and banks, so there was
 * nothing to want. This gives the gate something real-looking to guard:
 * street grid, water, and three labelled pins. Purely presentational (the
 * gate wraps it in aria-hidden); no data, no Google billing.
 */
export function MapTeaser() {
  const pin = (x: number, y: number, color: string, label: string) => (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M0 0C-9 -14 -14 -20 -14 -28a14 14 0 1 1 28 0c0 8 -5 14 -14 28z"
        fill={color}
        stroke="#fff"
        strokeWidth="2.5"
      />
      <circle cx="0" cy="-28" r="5.5" fill="#fff" />
      <rect x="-34" y="8" width="68" height="20" rx="10" fill="#ffffff" opacity="0.92" />
      <text x="0" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1a3a6b">
        {label}
      </text>
    </g>
  );

  return (
    <div className="h-[70vh] min-h-[420px] w-full overflow-hidden">
      <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        {/* land */}
        <rect width="800" height="600" fill="#eef2e6" />
        {/* the Bosphorus, roughly */}
        <path d="M520 0 C 480 120 560 200 500 320 C 450 420 560 520 520 600 L 800 600 L 800 0 Z" fill="#bcd7ea" />
        {/* park */}
        <ellipse cx="180" cy="140" rx="90" ry="55" fill="#d5e6c3" />
        {/* street grid */}
        <g stroke="#ffffff" strokeWidth="10" strokeLinecap="round">
          <path d="M0 220 L 520 200" />
          <path d="M0 380 L 500 400" />
          <path d="M120 0 L 150 600" />
          <path d="M320 0 L 300 600" />
          <path d="M0 500 L 480 520" />
        </g>
        <g stroke="#ffffff" strokeWidth="5" strokeLinecap="round" opacity="0.8">
          <path d="M60 0 L 80 600" />
          <path d="M220 0 L 230 600" />
          <path d="M420 0 L 400 600" />
          <path d="M0 120 L 540 90" />
          <path d="M0 300 L 520 290" />
        </g>
        {/* three of the vetted places, labelled in the audience's language mix */}
        {pin(180, 250, '#c0392b', 'مطعم ✓')}
        {pin(360, 430, '#1a3a6b', 'مستشفى ✓')}
        {pin(300, 160, '#1f7a4d', 'بنك ✓')}
      </svg>
    </div>
  );
}
