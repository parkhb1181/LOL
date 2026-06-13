import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── 리그 색 (v0 gs.lck/lpl/lec/lcs 확정값) ───────────────────────────
        lck: '#0284c7',
        lpl: '#dc2626',
        lec: '#7e22ce',
        lcs: '#f97316',
        // ── 골드 액센트 ─────────────────────────────────────────────────────
        secondary: '#e9c349',
        'secondary-fixed-dim': '#e9c349',
        'on-secondary': '#14141c',          // 골드 버튼 위 텍스트 (어두운 색)
        // ── 등급 색상 (RESULT 화면 등급명 강조) ─────────────────────────────
        'grade-grandslam': '#e9c349',       // 골드 (= secondary)
        'grade-legendary': '#c080ff',       // 퍼플
        'grade-elite':     '#60c0ff',       // 블루
        'grade-contender': '#40d4a0',       // 민트/초록
        // ── 서피스 팔레트 (v0 tone) ─────────────────────────────────────────
        'on-surface':             '#f3f4f6',   // gs.text
        'on-surface-variant':     '#c8c5cb',
        'outline':                '#9ca3af',   // gs.muted
        'outline-variant':        '#2e2e42',   // gs.border
        'surface-container':      '#1c1c28',
        'surface-container-low':  '#181824',
        'surface-container-high': '#1a1a24',   // gs.card — 카드 배경
        'surface-container-highest': '#222230', // gs.surface
        'surface-container-lowest':  '#14141c', // gs.bg  — 앱 배경
        'surface-bright':         '#2a2a3c',
        'surface-variant':        '#222230',
      },
      borderRadius: {
        DEFAULT: '4px',
      },
      fontFamily: {
        'ovr-display': ['var(--font-anton)', 'Anton', 'sans-serif'],
        'heading-lg':  ['var(--font-bebas)', '"Bebas Neue"', 'sans-serif'],
        'heading-md':  ['var(--font-bebas)', '"Bebas Neue"', 'sans-serif'],
        'label-caps':  ['var(--font-inter)', 'Inter', 'sans-serif'],
        'body-main':   ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      fontSize: {
        'heading-lg':         ['40px', { lineHeight: '1.1' }],
        'heading-md':         ['24px', { lineHeight: '1.2' }],
        'ovr-display':        ['48px', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'ovr-display-mobile': ['32px', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'label-caps':         ['11px', { lineHeight: '1', letterSpacing: '0.05em' }],
      },
    },
  },
  // 딕셔너리·함수 반환값으로 동적 조합되는 Tailwind 클래스 purge 방지
  safelist: [
    'text-lck', 'text-lpl', 'text-lec', 'text-lcs',
    'border-lck/30', 'border-lpl/30', 'border-lec/30', 'border-lcs/30',
    'text-secondary', 'text-sky-300', 'text-on-surface', 'text-outline',
    'text-yellow-300', 'text-secondary/80',
    // 등급 색상
    'text-grade-grandslam', 'text-grade-legendary', 'text-grade-elite', 'text-grade-contender',
    'border-secondary/50', 'border-amber-400/35',
    'bg-surface-container-high', 'bg-surface-bright',
    'is-flying',
  ],
  plugins: [],
}

export default config
