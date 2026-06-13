import Link from 'next/link'
import type { Metadata } from 'next'
import SiteHeader from '@/components/SiteHeader'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: '개인정보처리방침 — GRANDSLAM',
  robots: { index: false, follow: false },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen text-on-surface">
      <SiteHeader fixed />

      <main className="max-w-lg mx-auto px-6 pt-24 pb-28 flex flex-col gap-10">

        <div>
          <Link href="/" className="text-xs text-outline/40 hover:text-outline/80 transition-colors">
            ← GRANDSLAM
          </Link>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-on-surface">개인정보처리방침</h1>
          <p className="mt-1 text-xs text-outline/40">Privacy Policy · 최종 수정: 2026-06-14</p>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">수집하는 정보</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            GRANDSLAM은 개인 식별 정보를 수집하지 않습니다.
            브라우저에는 언어 설정(<code className="text-xs bg-white/5 px-1 py-0.5 rounded">lang</code>) 키 1개만 저장합니다(localStorage).
            이 외 쿠키·세션·계정 데이터는 없습니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">분석 도구</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            서비스 개선을 위해 Vercel Analytics(집계 트래픽 통계)와 Google Analytics 4를 사용합니다.
            수집 데이터는 페이지뷰·이벤트 집계이며, 개인을 식별하거나 제3자에게 판매하지 않습니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">외부 서비스</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            선수 이미지 및 데이터는{' '}
            <a
              href="https://lol.fandom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-outline/60 underline underline-offset-2 hover:text-on-surface-variant transition-colors"
            >
              Leaguepedia
            </a>
            에서 제공됩니다(CC BY-SA 4.0).
            Leaguepedia의 개인정보처리방침은 해당 사이트를 참고하세요.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">저작권 및 이미지 삭제 요청</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            이미지 저작권 관련 삭제 요청은 GitHub Issues를 통해 접수됩니다.
            서비스 운영 특성상 이메일 문의는 지원하지 않습니다.
          </p>
        </section>

        <div className="pt-2">
          <Link href="/about" className="text-xs text-outline/40 hover:text-outline/80 transition-colors underline underline-offset-2">
            ← Legal &amp; Attribution
          </Link>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
