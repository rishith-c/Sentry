import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
        sans: ['Fira Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        sentinel: {
          bg: '#000000',
          surface: '#111111',
          surface2: '#1a1a1a',
          surface3: '#222222',
          border: '#2a2a2a',
          border2: '#333333',
          text: '#ffffff',
          'text-2': '#aaaaaa',
          'text-3': '#555555',
          blue: '#4a9eff',
          red: '#ff4444',
          amber: '#ffaa00',
          green: '#33dd77',
        },
      },
      keyframes: {
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'pulse-fast': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.2' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out-left': {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(-100%)', opacity: '0' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { transform: 'translateY(0)', opacity: '1' },
          to: { transform: 'translateY(-100%)', opacity: '0' },
        },
        'seismic-wave': {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px 2px rgba(255,68,68,0.3)' },
          '50%': { boxShadow: '0 0 16px 4px rgba(255,68,68,0.5)' },
        },
        flash: {
          '0%': { backgroundColor: 'rgba(255,170,0,0.4)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(0)', opacity: '0.05' },
          '100%': { transform: 'translateY(100%)', opacity: '0.05' },
        },
        'hud-flicker': {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '0.97' },
          '93%': { opacity: '0.85' },
          '94%': { opacity: '0.97' },
        },
      },
      animation: {
        'pulse-slow': 'pulse-slow 2s ease-in-out infinite',
        'pulse-fast': 'pulse-fast 0.8s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.2s ease-out forwards',
        'slide-out-left': 'slide-out-left 0.2s ease-in forwards',
        'fade-out': 'fade-out 0.2s ease-in forwards',
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'slide-up': 'slide-up 0.3s ease-in forwards',
        'seismic-wave': 'seismic-wave 3s ease-out forwards',
        'glow-pulse': 'glow-pulse 1.5s ease-in-out infinite',
        flash: 'flash 0.5s ease-out forwards',
        'scan-line': 'scan-line 4s linear infinite',
        'hud-flicker': 'hud-flicker 8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
