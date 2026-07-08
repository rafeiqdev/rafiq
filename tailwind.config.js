/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ── Design tokens: navy primary + gold secondary, cream surfaces ──
      colors: {
        navy: {
          DEFAULT: '#1a3a6b',
          dark: '#12294d',
          light: '#2c4f8a',
          50: '#eef3f9',
          100: '#dce7f3',
        },
        cream: {
          DEFAULT: '#faf8f0',
          dark: '#efeadb',
        },
        gold: {
          DEFAULT: '#c69749',
          dark: '#a17a33',
          light: '#e2c885',
          soft: '#f6eed9',
        },
        brand: {
          red: '#c0392b',
          blue: '#e8f0fb',
        },
      },
      fontFamily: {
        // one Latin family + one Arabic family (plus system fallbacks)
        latin: ['Inter', 'system-ui', 'sans-serif'],
        arabic: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
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
        gold: '0 6px 20px rgba(198, 151, 73, 0.35)',
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
