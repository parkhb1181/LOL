// 공유 푸터 — 전 페이지 공통 (CURSOR_GUIDE §10 면책 문구 포함)
import Link from 'next/link'

export default function SiteFooter() {
  return (
    <footer className="bg-surface-container-lowest border-t border-outline-variant/30 w-full py-8 px-5 md:px-10 relative z-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <span className="font-ovr-display text-ovr-display-mobile text-outline opacity-40">
          GRANDSLAM
        </span>
        <div className="flex flex-wrap justify-center md:justify-end gap-6">
          <Link
            href="/about"
            className="text-outline hover:text-on-surface transition-colors font-label-caps text-label-caps uppercase"
          >
            Rating System
          </Link>
          <a
            href="mailto:parkhb1181@gmail.com"
            className="text-outline hover:text-on-surface transition-colors font-label-caps text-label-caps uppercase"
          >
            Contact
          </a>
        </div>
      </div>
      <div className="mt-5 text-center space-y-0.5 font-label-caps text-[10px] text-outline/40 leading-relaxed">
        <p>GRANDSLAM is a fan-made project. Not affiliated with or endorsed by Riot Games.</p>
        <p>League of Legends is a trademark of Riot Games, Inc. Data sourced from Leaguepedia.</p>
        <p>팬메이드 프로젝트입니다. Riot Games와 무관하며 공식 후원을 받지 않습니다.</p>
      </div>
    </footer>
  )
}
