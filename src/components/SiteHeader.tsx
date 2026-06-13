// 공유 헤더 — 도감/드래프트/결과 페이지 공통 (도감 헤더 기준)
// activePage: 현재 페이지에 active 스타일 적용
// fixed: true → fixed top-0 전체 폭 (dex·/r), false → 페이지 플로우 inline (draft)
// fixedMobile: 모바일 헤더만 독립적으로 fixed 제어 (draft 전용 — 데스크톱은 fixed 그대로)
// rightSlot: 헤더 우측 커스텀 콘텐츠 (draft 슬롯 미니 등)
import Link from 'next/link'
import type { ReactNode } from 'react'

type Props = {
  activePage?: 'collection' | 'draft'
  fixed?: boolean
  fixedMobile?: boolean
  rightSlot?: ReactNode
}

export default function SiteHeader({ activePage, fixed = false, fixedMobile, rightSlot }: Props) {
  const desktopPos = fixed
    ? 'fixed top-0 left-0 w-full z-50'
    : 'relative z-20 shrink-0'
  // fixedMobile이 명시되면 모바일은 그 값 우선, 아니면 fixed 상속
  const mobilePos  = (fixedMobile ?? fixed)
    ? 'fixed top-0 left-0 w-full z-50'
    : 'relative z-20 shrink-0'

  const navActive = 'font-heading-md text-heading-md text-secondary border-b-2 border-secondary pb-1 uppercase'
  const navIdle   = 'font-heading-md text-heading-md text-on-surface-variant hover:text-secondary transition-colors uppercase'

  return (
    <>
      {/* 데스크톱 헤더 */}
      <header
        className={`hidden md:flex items-center px-10 py-4 border-b border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-md ${desktopPos}`}
        style={{ paddingTop: fixed ? 'max(1rem, env(safe-area-inset-top))' : undefined }}
      >
        <Link
          href="/"
          className="font-ovr-display text-ovr-display-mobile tracking-tighter text-on-surface hover:text-secondary transition-colors mr-8"
        >
          GRANDSLAM
        </Link>
        <nav className="flex gap-6">
          <Link href="/dex" className={activePage === 'collection' ? navActive : navIdle}>
            COLLECTION
          </Link>
          <Link href="/draft" className={activePage === 'draft' ? navActive : navIdle}>
            PLAY GAME
          </Link>
        </nav>
        {rightSlot && <div className="ml-auto">{rightSlot}</div>}
      </header>

      {/* 모바일 헤더 */}
      <header
        className={`flex md:hidden items-center justify-between px-5 py-4 border-b border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-md ${mobilePos}`}
        style={{ paddingTop: (fixedMobile ?? fixed) ? 'max(1rem, env(safe-area-inset-top))' : undefined }}
      >
        <Link href="/" className="font-ovr-display text-ovr-display-mobile tracking-tighter text-on-surface">
          GRANDSLAM
        </Link>
        <div className="flex gap-4">
          <Link
            href="/dex"
            className={`font-label-caps text-[11px] uppercase tracking-wider transition-colors ${activePage === 'collection' ? 'text-secondary' : 'text-on-surface-variant hover:text-secondary'}`}
          >
            COLLECTION
          </Link>
          <Link
            href="/draft"
            className={`font-label-caps text-[11px] uppercase tracking-wider transition-colors ${activePage === 'draft' ? 'text-secondary' : 'text-on-surface-variant hover:text-secondary'}`}
          >
            PLAY GAME
          </Link>
        </div>
      </header>
    </>
  )
}
