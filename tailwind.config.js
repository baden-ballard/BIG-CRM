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
          DEFAULT: '#3b82f6',
          dark: '#2563eb',
          light: '#60a5fa',
        },
        accent: {
          DEFAULT: '#ef4444',
          dark: '#dc2626',
          light: '#f87171',
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
        'glass': '0 8px 32px 0 rgba(59, 130, 246, 0.1)',
        'glass-hover': '0 12px 40px 0 rgba(59, 130, 246, 0.15)',
        'glass-inset': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.5)',
      },
    },
  },
  plugins: [],
}

