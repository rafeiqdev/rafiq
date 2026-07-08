/**
 * Animated Istanbul skyline banner — bundled SVG (no CDN), on-brand navy/cream,
 * with a drifting sun, floating seagulls and a shimmering Bosphorus. Used as a
 * hero strip across the marketing/service pages so the app feels alive and
 * unmistakably "Istanbul".
 */
export function IstanbulSkyline({ className = '', height = 200 }: { className?: string; height?: number }) {
  return (
    <div className={`relative overflow-hidden rounded-card ${className}`} style={{ height }} aria-hidden>
      <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice" className="w-full h-full">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a3a6b" />
            <stop offset="55%" stopColor="#2c4f8a" />
            <stop offset="100%" stopColor="#3d63a5" />
          </linearGradient>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2c4f8a" />
            <stop offset="100%" stopColor="#1a3a6b" />
          </linearGradient>
        </defs>

        <rect width="1200" height="320" fill="url(#sky)" />

        {/* sun */}
        <circle cx="980" cy="92" r="40" fill="#faf8f0" opacity="0.92">
          <animate attributeName="cy" values="92;84;92" dur="9s" repeatCount="indefinite" />
        </circle>
        <circle cx="980" cy="92" r="58" fill="#faf8f0" opacity="0.12">
          <animate attributeName="r" values="58;66;58" dur="9s" repeatCount="indefinite" />
        </circle>

        {/* seagulls */}
        <g fill="none" stroke="#faf8f0" strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
          <path d="M120 70 q10 -9 20 0 q10 -9 20 0">
            <animateTransform attributeName="transform" type="translate" values="0 0; 60 -16; 140 -6" dur="14s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.85;0" dur="14s" repeatCount="indefinite" />
          </path>
          <path d="M120 70 q7 -6 14 0 q7 -6 14 0">
            <animateTransform attributeName="transform" type="translate" values="220 40; 320 18; 460 30" dur="18s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.7;0" dur="18s" repeatCount="indefinite" />
          </path>
        </g>

        {/* skyline silhouette */}
        <g fill="#13294d">
          {/* Galata Tower (left) */}
          <rect x="70" y="150" width="34" height="120" />
          <path d="M64 150 h46 l-8 -16 h-30 z" />
          <polygon points="87,116 104,134 70,134" />
          <rect x="84" y="104" width="6" height="14" />

          {/* Blue-Mosque style complex (center) */}
          <path d="M470 270 v-70 a70 70 0 0 1 140 0 v70 z" />
          <path d="M505 200 a35 35 0 0 1 70 0" fill="#1a3a6b" />
          <rect x="537" y="120" width="6" height="34" />
          <circle cx="540" cy="116" r="5" />
          {/* minarets */}
          <rect x="452" y="150" width="9" height="120" />
          <polygon points="456.5,126 463,150 450,150" />
          <rect x="619" y="150" width="9" height="120" />
          <polygon points="623.5,126 630,150 617,150" />
          <rect x="496" y="170" width="7" height="100" />
          <polygon points="499.5,150 505,170 494,170" />
          <rect x="577" y="170" width="7" height="100" />
          <polygon points="580.5,150 586,170 575,170" />

          {/* Hagia Sophia style dome (right of center) */}
          <path d="M700 270 v-46 a52 52 0 0 1 104 0 v46 z" />
          <path d="M726 224 a26 26 0 0 1 52 0" fill="#1a3a6b" />
          <rect x="749" y="168" width="6" height="20" />
          <rect x="690" y="200" width="8" height="70" />
          <rect x="806" y="200" width="8" height="70" />

          {/* misc towers / city blocks */}
          <rect x="180" y="200" width="40" height="70" />
          <rect x="230" y="180" width="28" height="90" />
          <rect x="280" y="210" width="46" height="60" />
          <rect x="350" y="190" width="30" height="80" />
          <rect x="870" y="195" width="34" height="75" />
          <rect x="912" y="175" width="26" height="95" />
          <rect x="948" y="210" width="44" height="60" />
          <rect x="1020" y="185" width="30" height="85" />
          <rect x="1062" y="205" width="40" height="65" />
          <rect x="1112" y="190" width="28" height="80" />
        </g>

        {/* lit windows */}
        <g fill="#faf8f0" opacity="0.5">
          <rect x="190" y="212" width="5" height="6" />
          <rect x="202" y="212" width="5" height="6" />
          <rect x="238" y="196" width="5" height="6" />
          <rect x="292" y="224" width="5" height="6" />
          <rect x="880" y="210" width="5" height="6" />
          <rect x="922" y="190" width="5" height="6" />
          <rect x="1030" y="200" width="5" height="6" />
          <rect x="1120" y="206" width="5" height="6" />
        </g>

        {/* Bosphorus */}
        <rect y="270" width="1200" height="50" fill="url(#sea)" />
        <g stroke="#faf8f0" strokeWidth="2" opacity="0.18">
          <path d="M0 286 q60 -8 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0">
            <animate attributeName="opacity" values="0.18;0.06;0.18" dur="6s" repeatCount="indefinite" />
          </path>
          <path d="M0 300 q60 8 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0">
            <animate attributeName="opacity" values="0.1;0.22;0.1" dur="7s" repeatCount="indefinite" />
          </path>
        </g>
      </svg>
    </div>
  );
}
