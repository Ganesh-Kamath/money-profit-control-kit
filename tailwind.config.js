/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0F7FF',
          100: '#E0EFFF',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          900: '#0F172A',
        },
        surface: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          subtle: '#F1F5F9',
          border: '#E2E8F0',
          borderStrong: '#CBD5E1',
        },
        finance: {
          income: '#059669',     // Restrained Emerald
          incomeBg: '#ECFDF5',
          expense: '#DC2626',    // Muted Red
          expenseBg: '#FEF2F2',
          transfer: '#2563EB',   // Blue
          transferBg: '#EFF6FF',
          warning: '#D97706',    // Amber
          warningBg: '#FFFBEB',
        },
        navy: {
          950: '#0A0F1D',
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'control': '10px',
        'card': '14px',
      }
    },
  },
  plugins: [],
}
