import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './hooks/**/*.{ts,tsx}', './store/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-muted': 'var(--color-text-muted)',
        'text-data': 'var(--color-text-data)',
        'threat-green': 'var(--color-threat-green)',
        'threat-amber': 'var(--color-threat-amber)',
        'threat-orange': 'var(--color-threat-orange)',
        'threat-red': 'var(--color-threat-red)',
        'threat-purple': 'var(--color-threat-purple)',
        accent: 'var(--color-accent)',
        // shadcn compatibility
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        ui: ['Inter', 'system-ui', 'sans-serif'],
        data: ['"JetBrains Mono"', 'monospace'],
        brand: ['Raleway', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-in-from-top': {
          from: { transform: 'translateY(-100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'seismic-ring': {
          '0%': { transform: 'translate(-50%, -50%) scale(0)', opacity: '0.8' },
          '100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: '0' },
        },
        'hotspot-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.25)', opacity: '0.9' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'damage-grow': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '65%': { transform: 'scale(1.15)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'live-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in-from-top': 'slide-in-from-top 0.3s ease-out',
        'seismic-ring': 'seismic-ring 2.5s ease-out infinite',
        'hotspot-pop': 'hotspot-pop 0.45s ease-out forwards',
        'damage-grow': 'damage-grow 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards',
        'live-pulse': 'live-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
