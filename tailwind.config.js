/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ffffff',
          dark: '#f3f4f6',
          light: '#ffffff',
        },
        secondary: {
          DEFAULT: '#192552',
          dark: '#141d3f',
          light: '#2a3a6b',
        },
        accent: {
          DEFAULT: '#C6282B',
          dark: '#A01F22',
          light: '#E85C5F',
        },
        blue: {
          50: '#e8eaf2',
          100: '#d1d5e5',
          200: '#a3abd0',
          300: '#7581bb',
          400: '#4757a6',
          500: '#192552',
          600: '#141d3f',
          700: '#0f152c',
          800: '#0a0e1a',
          900: '#050709',
        },
        glass: {
          bg: {
            light: 'rgba(255, 255, 255, 0.1)',
            medium: 'rgba(255, 255, 255, 0.2)',
            dark: 'rgba(255, 255, 255, 0.05)',
            primary: 'rgba(255, 255, 255, 0.1)',
          },
          border: {
            light: 'rgba(255, 255, 255, 0.25)',
            medium: 'rgba(255, 255, 255, 0.35)',
            dark: 'rgba(0, 0, 0, 0.08)',
          },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(25, 37, 82, 0.1)',
        'glass-hover': '0 12px 40px 0 rgba(25, 37, 82, 0.15)',
        'glass-inset': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
      },
    },
  },
  plugins: [],
}


