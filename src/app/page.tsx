import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen text-on-surface flex flex-col">

      {/* 헤더 */}
      <header
        className="flex items-center px-5 md:px-10 py-4 border-b border-outline-variant/40 bg-surface-container-lowest/70 backdrop-blur-md relative z-10"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {/* 로고 — 좌측 고정 */}
        <span className="font-ovr-display text-ovr-display-mobile tracking-tighter text-on-surface">
          GRANDSLAM
        </span>

        {/* 네비 — 헤더 중앙 절대 배치 */}
        <nav className="hidden md:flex gap-8 absolute left-1/2 -translate-x-1/2">
          <Link
            href="/dex"
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-secondary transition-colors tracking-widest"
          >
            COLLECTION
          </Link>
          <Link
            href="/draft"
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-secondary transition-colors tracking-widest"
          >
            PLAY GAME
          </Link>
        </nav>
      </header>

      {/* 히어로 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16 pt-8">
        <div className="text-center max-w-sm w-full">

          <p className="font-label-caps text-label-caps text-outline/50 uppercase tracking-[0.4em] mb-8">
            LoL All-Time Draft Simulator
          </p>

          {/* GRANDSLAM 대형 타이틀 */}
          <h1 className="font-ovr-display leading-none tracking-tighter mb-8"
              style={{ fontSize: 'clamp(72px, 20vw, 120px)' }}>
            <span className="block text-on-surface">GRAND</span>
            <span className="block text-secondary text-glow-gold">SLAM</span>
          </h1>

          <p className="text-outline text-sm leading-relaxed mb-10 font-label-caps text-label-caps">
            Draft the greatest players of all time<br />
            and compete for the World Championship
          </p>

          {/* 메인 버튼 — DRAFT START */}
          <Link
            href="/draft"
            className="block w-full py-4 bg-secondary text-surface-container-lowest font-label-caps text-label-caps tracking-[0.15em] uppercase rounded hover:opacity-90 active:scale-[0.98] transition-all font-bold"
          >
            Draft Start
          </Link>

          {/* 보조 버튼 — COLLECTION */}
          <Link
            href="/dex"
            className="block w-full mt-3 py-4 border border-secondary/60 text-secondary font-label-caps text-label-caps tracking-[0.15em] uppercase rounded hover:border-secondary hover:bg-secondary/10 active:scale-[0.98] transition-all"
          >
            Collection
          </Link>

          <div className="mt-6 flex justify-center gap-6 text-[10px] text-outline/40 font-label-caps">
            <Link href="/about" className="hover:text-outline transition-colors">
              Rating System →
            </Link>
          </div>
        </div>
      </div>

    </main>
  )
}
