/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c1915',
        paper: '#f3efe7',
        card: '#fffdf8',
        line: '#e4dcd0',
        mute: '#6f675e',
        accent: '#b8421a',
        accentdark: '#8d3012',
      },
      fontFamily: {
        sans: ['Figtree', 'Segoe UI', 'sans-serif'],
        serif: ['Instrument Serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(28, 25, 21, 0.04), 0 16px 40px rgba(28, 25, 21, 0.06)',
      },
    },
  },
  plugins: [],
}
