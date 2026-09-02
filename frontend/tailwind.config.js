/** @type {import('tailwindcss').Config} */

// Every cs-* token resolves to a CSS variable holding "R G B" channels, so the
// theme can be swapped at runtime (see src/theme/themes.js + ThemeContext).
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cs-dark': v('cs-dark'),
        'cs-darker': v('cs-darker'),
        'cs-darkest': v('cs-darkest'),
        'cs-primary': v('cs-primary'),
        'cs-mint': v('cs-mint'),
        'cs-cyan': v('cs-cyan'),
        'cs-blue': v('cs-blue'),
        'cs-violet': v('cs-violet'),
        'cs-green': v('cs-green'),
        'cs-orange': v('cs-orange'),
        'cs-red': v('cs-red'),
        'cs-gold': v('cs-gold'),
        'cs-teal': v('cs-teal'),
        'cs-deep-teal': v('cs-deep-teal'),
        'cs-text': v('cs-text'),
        'cs-text-dim': v('cs-text-dim'),
        'cs-text-muted': v('cs-text-muted'),
        'cs-btn-text': v('cs-btn-text'),
        'cs-line': v('cs-line'),
        'cs-overlay': v('cs-overlay'),
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Kantumruy Pro', 'monospace'],
        'sans': ['Inter', 'Kantumruy Pro', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.5s ease',
        'rain': 'rain 10s linear infinite',
        'spin-slow': 'spin 1.5s linear infinite',
        'blink': 'blink 1s step-end infinite',
        'grid-pan': 'gridPan 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgb(var(--cs-primary) / 0.35)' },
          '50%': { boxShadow: '0 0 40px rgb(var(--cs-primary) / 0.55)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        rain: {
          to: { transform: 'translateY(100vh)', opacity: '0' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        gridPan: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        // End on --cs-teal (a vivid mid-tone in every theme), NOT --cs-deep-teal
        // which is a near-black "faint border" colour and made the gradient fade
        // to black on most dark themes.
        'gradient-main': 'linear-gradient(135deg, rgb(var(--cs-green)) 0%, rgb(var(--cs-teal)) 100%)',
        'gradient-dev': 'linear-gradient(120deg, rgb(var(--cs-primary)) 0%, rgb(var(--cs-blue)) 45%, rgb(var(--cs-violet)) 100%)',
      },
    },
  },
  plugins: [],
}
