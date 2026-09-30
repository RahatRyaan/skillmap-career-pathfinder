/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Status colours are semantic and always paired with an icon and a
        // text label, so colour is never the only signal.
        strong: '#16a34a',
        developing: '#d97706',
        gap: '#ea580c',
        critical: '#dc2626',
        brand: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          subtle: '#eff6ff',
        },
      },
      spacing: {
        // 8px grid.
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
      },
      borderRadius: { card: '0.75rem' },
      fontFamily: {
        sans: ['Noto Sans', 'Noto Sans Bengali', 'system-ui', 'sans-serif'],
        bengali: ['Noto Sans Bengali', 'Noto Sans', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
      },
    },
  },
  plugins: [],
};
