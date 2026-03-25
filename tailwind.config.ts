import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Existing CSS var tokens
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Brand — indigo scale
        brand: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',  // primary brand
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        // Neutral scale (gray)
        neutral: {
          50:  '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        // Semantic colors
        success: {
          bg:   '#D1FAE5',
          text: '#065F46',
          border:'#6EE7B7',
          dot:  '#34D399',
        },
        warning: {
          bg:   '#FEF3C7',
          text: '#92400E',
          border:'#FCD34D',
          dot:  '#F59E0B',
        },
        error: {
          bg:   '#FEE2E2',
          text: '#991B1B',
          border:'#FECACA',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],  // 10px
        xs:    ['0.75rem',  { lineHeight: '1rem' }],       // 12px
        sm:    ['0.875rem', { lineHeight: '1.25rem' }],    // 14px
        base:  ['1rem',     { lineHeight: '1.5rem' }],     // 16px
        lg:    ['1.125rem', { lineHeight: '1.75rem' }],    // 18px
        xl:    ['1.25rem',  { lineHeight: '1.75rem' }],    // 20px
        '2xl': ['1.5rem',   { lineHeight: '2rem' }],       // 24px
      },
      spacing: {
        // Touch targets
        '11': '2.75rem',  // 44px — minimum touch target
        '18': '4.5rem',
      },
      borderRadius: {
        chat: '1rem',   // 16px — main bubble radius
        pill: '9999px', // chip radius
      },
      boxShadow: {
        bubble: '0 1px 2px 0 rgba(0,0,0,0.05)',
        card:   '0 2px 8px 0 rgba(0,0,0,0.08)',
        input:  '0 0 0 3px rgba(79,70,229,0.15)',
      },
      keyframes: {
        // Typing indicator bounce
        'typing-dot': {
          '0%, 80%, 100%': { transform: 'translateY(0)' },
          '40%':            { transform: 'translateY(-4px)' },
        },
        // Card slide-in
        'slide-up': {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        // Proactive greeting fade-in
        'fade-in': {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Skeleton shimmer
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'typing-1': 'typing-dot 600ms ease-in-out infinite 0ms',
        'typing-2': 'typing-dot 600ms ease-in-out infinite 150ms',
        'typing-3': 'typing-dot 600ms ease-in-out infinite 300ms',
        'slide-up': 'slide-up 200ms ease-out forwards',
        'fade-in':  'fade-in 400ms ease-out forwards',
        shimmer:    'shimmer 1.5s linear infinite',
      },
      backgroundSize: {
        'shimmer-size': '200% 100%',
      },
    },
  },
  plugins: [],
}

export default config
