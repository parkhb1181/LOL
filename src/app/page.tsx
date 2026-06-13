'use client'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { useLang } from '@/i18n'

export default function Home() {
  const { t } = useLang()

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface flex flex-col relative overflow-x-hidden">

      {/* 배경 — 중앙 골드 스포트라이트 */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(circle at 50% 0%, #1a1a24 0%, transparent 80%)' }}
      />
      <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden">
        <div
          className="blur-[120px] rounded-full opacity-30"
          style={{
            width: '900px',
            height: '900px',
            background: 'radial-gradient(circle, rgba(233,195,73,0.8) 0%, rgba(233,195,73,0.3) 30%, transparent 70%)',
          }}
        />
      </div>

      <SiteHeader fixed />
      <div className="h-[57px] md:h-[65px] shrink-0" />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative z-10">
        <div className="text-center max-w-xl mx-auto flex flex-col items-center gap-10">

          <p className="font-label-caps text-label-caps text-on-surface-variant tracking-[0.2em] uppercase">
            {t.home.subtitle}
          </p>

          <h1
            className="font-heading-lg leading-[0.85] tracking-tighter drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]"
            style={{ fontSize: 'clamp(80px, 22vw, 140px)' }}
          >
            <span className="block text-on-surface">GRAND</span>
            <span
              className="block text-secondary"
              style={{ textShadow: 'rgba(233,195,73,0.5) 0px 0px 10px, rgba(233,195,73,0.2) 0px 0px 20px' }}
            >
              SLAM
            </span>
          </h1>

          <p className="font-body-main text-body-main text-on-surface-variant max-w-sm text-center" style={{ wordBreak: 'keep-all' }}>
            {t.home.desc}
          </p>

          <div className="flex flex-col w-full max-w-[400px] gap-4">
            <Link
              href="/draft"
              className="w-full py-4 px-8 bg-secondary text-on-secondary font-label-caps text-label-caps uppercase tracking-widest text-center hover:opacity-90 hover:shadow-[0_0_20px_rgba(233,195,73,0.3)] active:scale-[0.98] transition-all"
            >
              {t.home.draftStart}
            </Link>
            <Link
              href="/dex"
              className="w-full py-4 px-8 bg-surface-container border border-outline-variant text-on-surface font-label-caps text-label-caps uppercase tracking-widest text-center hover:bg-surface-container-high active:scale-[0.98] transition-all"
            >
              {t.home.collection}
            </Link>
          </div>

          <Link
            href="/about"
            className="font-label-caps text-label-caps text-on-surface-variant opacity-60 hover:opacity-100 hover:text-on-surface transition-all"
          >
            {t.home.ratingSystem}
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
