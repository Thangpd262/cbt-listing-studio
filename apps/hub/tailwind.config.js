/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette mirrors ui-mockup-dark.html
        bg: '#0e0e12',
        panel: '#16161c', // card
        panel2: '#1e1e27', // card2
        line: '#2a2a38', // border
        fg: '#dddde8', // text
        muted: '#5e5e78',
        brand: {
          DEFAULT: '#5b9bf5', // accent
          soft: 'rgba(91,155,245,0.13)',
        },
        ok: { DEFAULT: '#35c97a', soft: 'rgba(53,201,122,0.12)' },
        warn: { DEFAULT: '#e89940', soft: 'rgba(232,153,64,0.12)' },
        danger: { DEFAULT: '#e05252', soft: 'rgba(224,82,82,0.12)' },
        amazon: '#ff9900',
        walmart: '#4dabf7',
      },
    },
  },
  plugins: [],
}
