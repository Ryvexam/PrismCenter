/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        porcelain: '#fbfbf8',
        paper: '#f5f2ea',
        ink: '#141414',
        graphite: '#303030',
        mist: '#dfe8ec',
        pewter: '#8c8f8a',
        solar: '#e7c85d',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Newsreader', 'Iowan Old Style', 'Georgia', 'serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        editorial: '0 28px 80px rgba(20, 20, 20, 0.08)',
      },
    },
  },
  plugins: [],
};
