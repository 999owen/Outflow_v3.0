/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark slate / cyan theme tokens from theme.css "default"
        'bg-outer':   '#0d131f',
        'bg-inner':   '#121826',
        'panel':      '#182234',
        'border':     'rgba(255,255,255,0.08)',
        'text-main':  '#f9fafb',
        'text-muted': '#9ca3af',
        'accent-green':  '#4ADE80',
        'accent-blue':   '#38bdf8',
        'accent-red':    '#F87171',
        'accent-yellow': '#FBBF24',
        'hover-bg':   '#1F2937',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 0 15px rgba(0,0,0,0.2)',
        'card-glow': '0 0 10px rgba(56,189,248,0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}
