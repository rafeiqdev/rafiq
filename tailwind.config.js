/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ── Design tokens: navy + gold brand (restored) ──
      // The signature Rafiq palette — deep navy primary, warm gold accent, cream
      // surfaces. Keep these hex values in sync with the CSS variables in
      // src/index.css (:root), which mirror them.
      colors: {
        navy: {
          DEFAULT: '#1a3a6b',
          dark: '#12294d',
          light: '#2c4f8a',
          50: '#eef2f8',
          100: '#d6e0ee',
        },
        cream: {
          DEFAULT: '#faf8f0',
          dark: '#efeadb',
        },
        // P-recolor: gold accent retired per brand direction — navy + white now
        // carry the site, black is reserved for emphasis/urgent moments. Token
        // NAMES kept as `gold*` on purpose (dozens of components reference
        // `bg-gold`, `text-gold-dark`, `icon-chip-gold`, etc.) — only the
        // values changed, so every existing usage repaints automatically
        // without a risky rename across the codebase.
        gold: {
          DEFAULT: '#111111', // solid accent bg (was warm gold) → near-black
          dark: '#000000', // hover/active + dark text on light bg → pure black
          light: '#ffffff', // icon/text color on navy-dark surfaces → white for contrast
          soft: '#f1f1f1', // subtle badge background wash → light neutral gray
        },
        brand: {
          red: '#c0392b',
          blue: '#e8f0fb',
        },
        // ── shadcn/ui token aliases ──
        // shadcn primitives (e.g. src/components/ui/order-tracking.tsx) reference
        // `primary` / `foreground` / `muted-foreground`. This project uses static
        // hex tokens rather than shadcn's CSS-variable convention, so map those
        // three names onto the navy palette — `text-primary/70`, `bg-primary/70`,
        // `text-muted-foreground`, `text-foreground/80` then all repaint in-brand.
        primary: '#1a3a6b', // navy — completed/active marks
        foreground: '#12294d', // navy-dark — primary text
        'muted-foreground': '#64748b', // muted slate — secondary text + pending marks
      },
      fontFamily: {
        // one Latin family + one Arabic family (plus system fallbacks)
        latin: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        // Cairo/Tajawal — used only by the /health-tourism landing page
        // (src/pages/HealthTourism.tsx), ported 1:1 from an external mockup.
        cairo: ['Cairo', 'sans-serif'],
        tajawal: ['Tajawal', 'sans-serif'],
        rubik: ['Rubik', 'sans-serif'],
      },
      // ── Radius scale ──
      borderRadius: {
        btn: '12px',
        card: '16px',
        xl2: '20px',
      },
      // ── Shadow scale ──
      boxShadow: {
        soft: '0 1px 4px rgba(26, 58, 107, 0.06)',
        card: '0 2px 12px rgba(26, 58, 107, 0.08)',
        cardHover: '0 8px 24px rgba(26, 58, 107, 0.14)',
        gold: '0 6px 20px rgba(0, 0, 0, 0.25)',
        float: '0 8px 24px rgba(18, 41, 77, 0.22)',
      },
      // ── Spacing additions (section rhythm) ──
      spacing: {
        18: '4.5rem',
        '11.5': '2.875rem',
      },
      maxWidth: {
        prose: '70ch',
      },
    },
  },
  plugins: [],
};
