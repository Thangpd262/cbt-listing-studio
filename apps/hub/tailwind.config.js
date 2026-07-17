/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette mirrors ui-prototype-v2.html (ECB·POD light theme)
        bg: '#F7F8FA', // paper / shell background
        panel: '#FFFFFF', // card, sidebar, topbar
        panel2: '#F7F8FA', // input/select bg, hover surfaces
        line: '#E3E7EC', // default border
        line2: '#CBD2DA', // stronger / interactive border
        fg: '#1B2129', // primary text
        muted: '#6B7684', // secondary / muted text
        faint: '#98A2B0', // placeholder / disabled
        brand: {
          DEFAULT: '#FF9408', // orange accent — active nav, primary/save, links
          soft: '#FFF3E6', // active-nav / soft-orange fill
        },
        brand2: '#E8720F', // orange hover
        ok: { DEFAULT: '#0E9F6E', soft: '#D1FAE5' }, // success / clone
        warn: { DEFAULT: '#F5B301', soft: '#FEF3C7' },
        danger: { DEFAULT: '#E63946', soft: '#FEE2E2' },
        cyan: { DEFAULT: '#00AEEF', soft: 'rgba(0,174,239,0.10)' }, // sync btn + config key
        amazon: '#FF9900',
        walmart: '#4dabf7',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'], // default body
        disp: ['Space Grotesk', 'ui-sans-serif', 'sans-serif'], // brand, titles, headings
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'], // SKU / ASIN / UUID / code / date
      },
    },
  },
  plugins: [],
}
