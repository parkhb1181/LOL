import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GRANDSLAM — LoL All-Time Draft',
  description: 'Build your all-time LoL roster and simulate a season.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* §10 면책 — 전 페이지 공통 */}
        <footer className="border-t border-[#2a2a4a] mt-12 px-4 py-5 text-center text-[10px] text-[#6868a0] leading-relaxed">
          Unofficial fan project · Images:{' '}
          <a href="https://lol.fandom.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white/40 transition-colors">
            Leaguepedia
          </a>{' '}
          (CC BY-SA 4.0) · Not affiliated with Riot Games
          <span className="mx-2 opacity-40">·</span>
          <a href="/about" className="underline underline-offset-2 hover:text-white/40 transition-colors">
            Legal
          </a>
        </footer>
      </body>
    </html>
  )
}
