/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /*
         * Theme-aware tokens. `white` is intentionally remapped to the active
         * theme's "contrast" colour so utilities such as `text-white`,
         * `bg-white/5` and `border-white/10` flip from light-on-dark to
         * dark-on-light when `data-theme` changes (see src/index.css).
         */
        white: 'rgb(var(--contrast-rgb) / <alpha-value>)',
        'text-primary': 'rgb(var(--contrast-rgb) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted-rgb) / <alpha-value>)',

        /* Brand + accent colours stay the same in every theme */
        navy: { DEFAULT: '#0f1a2e', light: '#162240', lighter: '#1e2d4f' },
        royal: { DEFAULT: '#1a3a5c', light: '#234b73' },
        gold: { DEFAULT: '#c9a84c', light: '#dbbf6a', dark: '#a88a3a' },
        glass: { DEFAULT: 'rgba(255,255,255,0.08)', light: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.12)', hover: 'rgba(255,255,255,0.15)' },
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#f87171',
        info: '#60a5fa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        /* Elegant serif used for landing-page headlines */
        display: ['"Playfair Display"', 'Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
};
