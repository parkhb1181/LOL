// §8.1 Shared result page — restore picks from URL params → simulate() recompute
// §8.2 generateMetadata: compute in Node runtime → pass display values to /api/og
// Invalid id/seed → redirect to home
import fs from 'fs'
import path from 'path'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import BottomNav from '@/components/BottomNav'
import ResultCards from '@/components/ResultCards'
import { simulate } from '@/lib/sim'
import type { SimPlayer } from '@/lib/sim'
import type { PlayerSeason } from '@/lib/data'

const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as const

// 등급 색상 — draft/page.tsx 토큰과 동일
const GRADE_COLOR: Record<string, string> = {
  'GRAND SLAM':   '#e9c349',
  'LEGENDARY':    '#c080ff',
  'ELITE':        '#60c0ff',
  'CONTENDER':    '#40d4a0',
  'PLAYOFF TEAM': '#f3f4f6',
  'REBUILD':      '#9ca3af',
}

// generateMetadata + 페이지 양쪽에서 호출 — 데이터 로드 + 시뮬 재계산
function loadAndCompute(pParam: string, sParam: string) {
  const ids = pParam.split('.')
  const seed = parseInt(sParam, 10)
  if (ids.length !== 5 || ids.some(id => !id) || isNaN(seed)) return null

  try {
    const root = process.cwd()
    const players: PlayerSeason[] = JSON.parse(
      fs.readFileSync(path.join(root, 'public', 'data', 'players.json'), 'utf-8')
    )
    const opponents = JSON.parse(
      fs.readFileSync(path.join(root, 'public', 'data', 'opponents-2026.json'), 'utf-8')
    )

    const playerMap = new Map(players.map(pl => [pl.id, pl]))
    const pickedPlayers = ROLES.map((_, i) => playerMap.get(ids[i]) ?? null)
    if (pickedPlayers.some(pk => pk === null)) return null

    const simPicks: SimPlayer[] = (pickedPlayers as PlayerSeason[]).map((pl, i) => ({
      playerId: pl.playerId,
      role: ROLES[i],
      ovr: pl.ovr,
    }))
    const result = simulate(simPicks, opponents, seed)

    return { result, pickedPlayers: pickedPlayers as PlayerSeason[], seed }
  } catch {
    return null
  }
}

// ── generateMetadata — §8.2 OG image generation ──────────────────────────────
export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ p?: string; s?: string }> }
): Promise<Metadata> {
  const { p = '', s = '' } = await searchParams
  const computed = loadAndCompute(p, s)
  if (!computed) return {}

  const { result, pickedPlayers } = computed
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://grandslamlol.vercel.app'

  // §8.2: URLSearchParams 직렬화 — GRAND SLAM 공백 등 특수문자 인코딩 보장
  const params = new URLSearchParams({
    g:   result.grade,
    t:   result.trophies.join('|'),
    ovr: String(result.teamOvr),
    l1:  `${pickedPlayers[0].nameEn}|${ROLES[0]}|${pickedPlayers[0].ovr}`,
    l2:  `${pickedPlayers[1].nameEn}|${ROLES[1]}|${pickedPlayers[1].ovr}`,
    l3:  `${pickedPlayers[2].nameEn}|${ROLES[2]}|${pickedPlayers[2].ovr}`,
    l4:  `${pickedPlayers[3].nameEn}|${ROLES[3]}|${pickedPlayers[3].ovr}`,
    l5:  `${pickedPlayers[4].nameEn}|${ROLES[4]}|${pickedPlayers[4].ovr}`,
  })

  const ogUrl   = `${base}/api/og?${params.toString()}`
  const title   = `GRANDSLAM — ${result.grade}`
  const desc    = `Team OVR ${result.teamOvr}${result.trophies.length > 0 ? ' · ' + result.trophies.join(' ') : ''}`

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, images: [ogUrl] },
  }
}

// ── Page component ────────────────────────────────────────────────────────────
export default async function ResultPage(
  { searchParams }: { searchParams: Promise<{ p?: string; s?: string }> }
) {
  const { p = '', s = '' } = await searchParams
  const computed = loadAndCompute(p, s)

  // §8.1: invalid id/seed → redirect to home
  if (!computed) redirect('/')

  const { result, pickedPlayers } = computed
  const gradeColor = GRADE_COLOR[result.grade] ?? '#f3f4f6'

  const TROPHY_EN: Record<string, string> = {
    SPLIT1: 'Spring', MSI: 'MSI', SPLIT2: 'Summer', WORLDS: 'Worlds',
  }

  return (
    <div className="min-h-screen text-on-surface">
      <SiteHeader activePage="draft" fixed />

      <main className="max-w-2xl mx-auto px-6 pt-24 pb-28 flex flex-col items-center gap-8">
        {/* 트로피 뱃지 */}
        {result.trophies.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-center">
            {result.trophies.map(tr => (
              <span key={tr} className="text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-outline/20 text-outline/60">
                {TROPHY_EN[tr] ?? tr}
              </span>
            ))}
          </div>
        )}

        {/* 등급 */}
        <div className="text-center">
          <p className="text-[10px] tracking-[0.5em] text-outline/40 uppercase mb-3">Season Result</p>
          <h1 style={{ color: gradeColor }} className="text-5xl font-black leading-none">
            {result.grade}
          </h1>
          <p className="text-outline/50 text-sm mt-3">Team OVR {result.teamOvr}</p>
        </div>

        {/* 카드 + 도메인 워터마크 — 스크린샷에 항상 포함 */}
        <div className="flex flex-col items-center gap-2 w-full">
          <ResultCards players={pickedPlayers} />
          <p className="text-[11px] font-semibold tracking-[0.12em] text-outline/40 select-none">
            grandslamlol.vercel.app
          </p>
        </div>

        {/* CTA */}
        <Link
          href="/draft"
          className="mt-2 inline-block w-full max-w-xs py-3.5 bg-white text-[#0d0d1a] font-black text-sm tracking-[0.15em] uppercase rounded-xl text-center hover:bg-white/90 active:scale-95 transition-all"
        >
          Start My Draft
        </Link>
      </main>

      <BottomNav activePage="draft" />
    </div>
  )
}
