import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Anton, Bebas_Neue } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { LangProvider } from '@/i18n'
import './globals.css'

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-anton',
})

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bebas',
})

// 본문/UI: Pretendard — 한글+영문 통일 (Inter 대체)
const pretendard = localFont({
  src: [
    { path: '../../public/fonts/Pretendard-Regular.woff',   weight: '400', style: 'normal' },
    { path: '../../public/fonts/Pretendard-Medium.woff',    weight: '500', style: 'normal' },
    { path: '../../public/fonts/Pretendard-SemiBold.woff',  weight: '600', style: 'normal' },
    { path: '../../public/fonts/Pretendard-Bold.woff',      weight: '700', style: 'normal' },
  ],
  variable: '--font-pretendard',
  display: 'swap',
})

const BASE_URL = 'https://grandslamlol.vercel.app'

const SEO_TITLE = 'GRANDSLAM - LoL 올타임 드래프트'
const SEO_DESCRIPTION =
  '역대 LoL 프로 선수로 올타임 팀을 드래프트하고 시즌을 시뮬레이션하는 무료 웹게임'
const OG_DESCRIPTION = '역대 LoL 프로 선수로 나만의 올타임 팀을 만들어보세요'
const OG_IMAGE = `${BASE_URL}/og-image.png`

export const metadata: Metadata = {
  title: SEO_TITLE,
  description: SEO_DESCRIPTION,
  metadataBase: new URL(BASE_URL),
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: SEO_TITLE,
    description: OG_DESCRIPTION,
    url: BASE_URL,
    siteName: 'GRANDSLAM',
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'GRANDSLAM' }],
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: SEO_TITLE,
    description: OG_DESCRIPTION,
    images: [OG_IMAGE],
  },
  verification: {
    google: 'jg_M-Yy2R7r62UJFFUvHj6jrkmjG9qdLFTd9-ZEzm28',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${anton.variable} ${bebasNeue.variable} ${pretendard.variable}`}>
      <body className="bg-[#0d0d1a]">
        <LangProvider>
          {children}
        </LangProvider>
        {/* §10 Disclaimer — all pages */}
        <footer className="border-t border-[#2a2a4a] px-4 py-5 text-center text-[10px] text-[#6868a0] leading-relaxed">
          Unofficial fan project · Images:{' '}
          <a href="https://lol.fandom.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white/40 transition-colors">
            Leaguepedia
          </a>{' '}
          (CC BY-SA 4.0) · Not affiliated with Riot Games
          <span className="mx-2 opacity-40">·</span>
          <a href="/about" className="underline underline-offset-2 hover:text-white/40 transition-colors">
            Legal
          </a>
          <span className="mx-2 opacity-40">·</span>
          <a href="/privacy" className="underline underline-offset-2 hover:text-white/40 transition-colors">
            Privacy
          </a>
        </footer>
        <Analytics />
        <SpeedInsights />
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
})(window, document, "clarity", "script", "x5vfsj5unv");`}
        </Script>
      </body>
    </html>
  )
}
