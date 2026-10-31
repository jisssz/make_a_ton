/** Design tokens from DESIGN.md — "SubSync Enterprise Precision" */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        plum: { DEFAULT: '#714B67', dark: '#5E3D56', subtle: '#F1EBF0', light: '#F5EFF4', soft: '#F3EEF3' },
        charcoal: '#252633',
        muted: '#747783',
        canvas: '#F7F7F8',
        line: '#E8E8EC',
        teal: { DEFAULT: '#008784', soft: '#E6F4F3' },
        gold: '#FDBA2F',
        marker: { cyan: '#00A5E8', coral: '#FF7676', turquoise: '#00CBA9' },
        ok: { DEFAULT: '#16845B', bg: '#EBF5F1' },
        warn: { DEFAULT: '#D69A35', bg: '#FCF6EA' },
        bad: { DEFAULT: '#C75C55', bg: '#FAF0EF' },
        sidebar: '#180d1e',
        'sidebar-hover': '#2a1835',
        'subtle-bg': '#f8f7fc',
        'card-border': '#eeeaf6',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
        hand: ['Kalam', 'cursive'],
      },
      boxShadow: {
        l1: '0 2px 4px rgba(37,38,51,0.04), 0 1px 2px rgba(37,38,51,0.02)',
        l2: '0 8px 24px rgba(37,38,51,0.08), 0 2px 6px rgba(37,38,51,0.04)',
      },
      fontSize: { label: ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }] },
    },
  },
  plugins: [],
};
