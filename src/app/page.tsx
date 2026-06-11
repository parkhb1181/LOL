// Phase 3: 홈 — 시작 버튼 + 설명 (PRD §3)
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0d0d1a] text-white flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm w-full">
        {/* 서비스 설명 */}
        <p className="text-[10px] tracking-[0.5em] text-white/20 uppercase mb-8">
          LoL All-Time Draft Simulator
        </p>

        {/* 타이틀 */}
        <h1 className="text-[88px] sm:text-[108px] font-black leading-none tracking-tighter mb-8 text-white">
          GRAND<br />SLAM
        </h1>

        {/* 설명 */}
        <p className="text-white/30 text-sm leading-relaxed mb-10">
          역대 최강 선수들로 드림팀을 구성하고<br />
          월드 챔피언에 도전하세요
        </p>

        {/* 시작 버튼 */}
        <Link
          href="/draft"
          className="block w-full py-4 bg-white text-[#0d0d1a] font-black text-sm tracking-[0.2em] uppercase rounded-xl hover:bg-white/90 active:scale-95 transition-all"
        >
          Draft Start
        </Link>

        {/* 보조 링크 */}
        <div className="mt-6 text-xs text-white/20">
          <Link href="/about" className="hover:text-white/50 transition-colors">
            레이팅 산출 기준 →
          </Link>
        </div>
      </div>
    </main>
  )
}
