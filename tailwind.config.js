/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Golos Text', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        brand: {
          DEFAULT: 'oklch(0.62 0.17 30)',
          dark: '#211f1c',
          bg: '#f1efec',
          border: '#e6e2dc',
          muted: '#8a847c',
          subtle: '#a39c92',
        },
      },
    },
  },
  plugins: [],
}
