import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0B0C0F',
          700: '#40424C',
          500: '#6E7180',
          400: '#9497A6',
          200: '#E3E4E9',
          100: '#EEEFF2',
        },
        paper:        '#FFFFFF',
        canvas:       '#FBFBFC',
        accent:       '#3B4CE0',
        'accent-dim': '#EEF0FD',
        'accent-ink': '#2C3AB8',
        good:  '#1B8A5A',
        warn:  '#C6790A',
        bad:   '#C0344A',
        mark:  '#FFE270',
        sticky: {
          'a':   '#FFF4D6', 'a-b': '#EBD9A0',
          'b':   '#E4ECFB', 'b-b': '#C3D4F5',
          'c':   '#EAE6F7', 'c-b': '#CBC0EC',
          'd':   '#E6F7EB', 'd-b': '#A8D9B4',
          'e':   '#FDEDEE', 'e-b': '#F4B8BC',
          'f':   '#FEF3E8', 'f-b': '#F5CFA0',
          'g':   '#FFF9E6', 'g-b': '#EDE0A8',
        },
      },
      borderRadius: {
        sm:   '6px',
        md:   '10px',
        lg:   '14px',
        pill: '999px',
      },
      boxShadow: {
        1:    '0 1px 2px rgba(11,12,15,0.06)',
        2:    '0 8px 24px rgba(11,12,15,0.10)',
        glow: '0 0 0 3px #EEF0FD',
      },
      fontFamily: {
        sans: ['-apple-system', '"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['2.15rem', { lineHeight: '1.22', letterSpacing: '-0.025em', fontWeight: '650' }],
        'h1':      ['1.9rem',  { lineHeight: '1.2',  letterSpacing: '-0.02em',  fontWeight: '650' }],
        'h2':      ['1.35rem', { lineHeight: '1.3',  letterSpacing: '-0.015em', fontWeight: '650' }],
        'card':    ['0.85rem', { lineHeight: '1.4',  letterSpacing: '-0.01em',  fontWeight: '600' }],
        'body':    ['0.95rem', { lineHeight: '1.85', fontWeight: '400' }],
        'meta':    ['0.82rem', { lineHeight: '1.4',  fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.4',  fontWeight: '400' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
