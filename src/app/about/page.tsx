import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'Legal & Attribution — GRANDSLAM',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen text-on-surface">
      <SiteHeader fixed />

      <main className="max-w-lg mx-auto px-6 pt-24 pb-28 flex flex-col gap-10">

        {/* Header */}
        <div>
          <Link href="/" className="text-xs text-outline/40 hover:text-outline/80 transition-colors">
            ← GRANDSLAM
          </Link>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-on-surface">Legal &amp; Attribution</h1>
        </div>

        {/* Disclaimer */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">Disclaimer</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            GRANDSLAM is an unofficial fan-made project. It is not affiliated with, endorsed by,
            or associated with Riot Games, Inc. League of Legends and all related properties
            are trademarks of Riot Games.
          </p>
        </section>

        {/* Data Source */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">Data Source</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Player and team data (tournament results, rosters, awards) are sourced from the{' '}
            <a
              href="https://lol.fandom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-outline/60 underline underline-offset-2 hover:text-on-surface-variant transition-colors"
            >
              Leaguepedia
            </a>{' '}
            Cargo API.
          </p>
        </section>

        {/* Image License */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">Player Images</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Player images are sourced from{' '}
            <a
              href="https://lol.fandom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-outline/60 underline underline-offset-2 hover:text-on-surface-variant transition-colors"
            >
              Leaguepedia
            </a>
            , licensed under{' '}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-outline/60 underline underline-offset-2 hover:text-on-surface-variant transition-colors"
            >
              CC BY-SA 4.0
            </a>
            . Original images and contributors are listed on each player&apos;s Leaguepedia page.
          </p>
        </section>

        {/* Analytics */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">Analytics</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            We use analytics to improve the experience. No personal data is collected or sold.
          </p>
        </section>

        {/* Rating Methodology */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">Rating System</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Player OVR ratings are computed from tournament placement (domestic, MSI, Worlds),
            individual awards (MVP, All-Pro), and editorial adjustments for era fairness.
            Ratings reflect historical peak performance and are not official Riot metrics.
          </p>
        </section>

        {/* Privacy */}
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.4em] uppercase text-outline/40">Privacy</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            <Link href="/privacy" className="text-outline/60 underline underline-offset-2 hover:text-on-surface-variant transition-colors">
              개인정보처리방침 (Privacy Policy)
            </Link>
          </p>
        </section>

      </main>

      <BottomNav />
    </div>
  )
}
