/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0f1a2e', light: '#162240', lighter: '#1e2d4f' },
        royal: { DEFAULT: '#1a3a5c', light: '#234b73' },
        gold: { DEFAULT: '#c9a84c', light: '#dbbf6a', dark: '#a88a3a' },
        glass: { DEFAULT: 'rgba(255,255,255,0.08)', light: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.12)', hover: 'rgba(255,255,255,0.15)' },
        'text-primary': '#ffffff',
        'text-secondary': '#b0c4de',
        'text-muted': '#6b82a6',
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#f87171',
        info: '#60a5fa',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
