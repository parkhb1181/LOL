'use client'
// 공유 헤더 — 전 페이지 공통 (홈/도감/드래프트/결과)
// rightSlot: 헤더 우측 커스텀 콘텐츠 (draft 슬롯 미니 등)
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useLang } from '@/i18n'

type Props = {
  activePage?: 'collection' | 'draft'
  fixed?: boolean
  fixedMobile?: boolean
  rightSlot?: ReactNode
}

function LangToggle() {
  const { lang, toggleLang } = useLang()
  return (
    <button
      onClick={toggleLang}
      aria-label="언어 전환"
      className="flex items-center gap-1 font-label-caps text-[11px] tracking-wider shrink-0"
    >
      <span className={lang === 'ko' ? 'text-secondary' : 'text-outline/50 hover:text-outline'}>KO</span>
      <span className="text-outline/30">|</span>
      <span className={lang === 'en' ? 'text-secondary' : 'text-outline/50 hover:text-outline'}>EN</span>
    </button>
  )
}

export default function SiteHeader({ activePage, fixed = false, fixedMobile, rightSlot }: Props) {
  const { t } = useLang()

  const desktopPos = fixed
    ? 'fixed top-0 left-0 w-full z-50'
    : 'relative z-20 shrink-0'
  const mobilePos = (fixedMobile ?? fixed)
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
            {t.nav.collection}
          </Link>
          <Link href="/draft" className={activePage === 'draft' ? navActive : navIdle}>
            {t.nav.playGame}
          </Link>
        </nav>
        {/* 우측: 커스텀 슬롯(있으면 우선) + 언어 토글 */}
        <div className="ml-auto flex items-center gap-4">
          {rightSlot && <div>{rightSlot}</div>}
          <LangToggle />
        </div>
      </header>

      {/* 모바일 헤더 */}
      <header
        className={`flex md:hidden items-center justify-between px-5 py-4 border-b border-outline-variant/30 bg-surface-container-lowest/90 backdrop-blur-md ${mobilePos}`}
        style={{ paddingTop: (fixedMobile ?? fixed) ? 'max(1rem, env(safe-area-inset-top))' : undefined }}
      >
        <Link href="/" className="font-ovr-display text-ovr-display-mobile tracking-tighter text-on-surface">
          GRANDSLAM
        </Link>
        <LangToggle />
      </header>
    </>
  )
}
