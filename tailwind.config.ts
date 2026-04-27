import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Central Lab Thai — premium deep-emerald (aliased under "navy" so existing
        // navy-* utility classes keep working; visually it's now a luxury British-Racing green).
        navy: {
          50:  '#ecf7f1',
          100: '#d0ead9',
          200: '#a3d4ba',
          300: '#74bb98',
          400: '#4ba078',
          500: '#2d8660',
          600: '#1c6c4c',
          700: '#13543c',
          800: '#0d402e',
          900: '#0a3d2a',   // brand primary — deep emerald
          950: '#052218',
        },
        // Central Lab Thai — accent gold (unchanged — gold + deep green = luxury combo)
        gold: {
          50:  '#fffaeb',
          100: '#fff4cc',
          200: '#ffe988',
          300: '#ffdb4d',
          400: '#ffd11a',
          500: '#FFCC00',   // brand accent
          600: '#d9a900',
          700: '#b38a00',
          800: '#8c6c00',
          900: '#665000',
        },
        // Keep brand alias (legacy components) — points to new emerald
        brand: {
          50:  '#ecf7f1',
          100: '#d0ead9',
          500: '#2d8660',
          600: '#1c6c4c',
          700: '#13543c',
          900: '#0a3d2a',
        },
      },
      fontFamily: {
        sans:   ['Kanit', 'Inter', 'system-ui', 'sans-serif'],
        kanit:  ['Kanit', 'system-ui', 'sans-serif'],
        inter:  ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-navy':  'linear-gradient(135deg, #0a3d2a 0%, #13543c 100%)',
        'gradient-gold':  'linear-gradient(135deg, #FFCC00 0%, #ffd11a 100%)',
        'gradient-soft':  'linear-gradient(135deg, #ecf7f1 0%, #ffffff 100%)',
      },
      boxShadow: {
        'card':       '0 1px 3px 0 rgba(10, 61, 42, 0.06), 0 1px 2px 0 rgba(10, 61, 42, 0.04)',
        'card-hover': '0 10px 25px -5px rgba(10, 61, 42, 0.12), 0 8px 10px -6px rgba(10, 61, 42, 0.08)',
        'gold-glow':  '0 0 0 3px rgba(255, 204, 0, 0.2)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
