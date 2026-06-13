'use client'
// /dex — PLAYER COLLECTION (Stitch v0 디자인 기준)
// §13.4 데이터 플로우: players.json fetch → 팀별 그룹핑 → 필터 → 렌더
// §13.5 hydration: fetch는 mount 후, 초기 렌더는 서버와 동일 상태

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import PlayerCard from '@/components/PlayerCard'
import type { PlayerSeason } from '@/lib/data'

const ROLE_ORDER = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as const
const YEARS = Array.from({ length: 13 }, (_, i) => 2025 - i) // 2025~2013 내림차순
const LEAGUES = ['LCK', 'LPL', 'LEC', 'LCS'] as const
type LeagueCode = (typeof LEAGUES)[number]

// 리그 색상 — 인라인 스타일 사용 (Tailwind purge 우회)
const LEAGUE_COLOR: Record<LeagueCode, string> = {
  LCK: '#0284c7',
  LPL: '#dc2626',
  LEC: '#7e22ce',
  LCS: '#f97316',
}

interface TeamGroup {
  key: string
  team: string
  teamSlug: string
  year: number
  league: LeagueCode
  players: PlayerSeason[]
  avgOvr: number
}

// players.json → 팀+연도 단위 그룹핑
// year=null: 전 시즌 포함 (ALL 모드)
function buildTeamGroups(players: PlayerSeason[], year: number | null): TeamGroup[] {
  const map = new Map<string, TeamGroup>()
  for (const p of players) {
    if (year !== null && p.year !== year) continue
    const key = `${p.teamSlug}_${p.year}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        team: p.team,
        teamSlug: p.teamSlug,
        year: p.year,
        league: p.league as LeagueCode,
        players: [],
        avgOvr: 0,
      })
    }
    map.get(key)!.players.push(p)
  }
  for (const g of map.values()) {
    g.players.sort(
      (a, b) => ROLE_ORDER.indexOf(a.role as (typeof ROLE_ORDER)[number])
              - ROLE_ORDER.indexOf(b.role as (typeof ROLE_ORDER)[number])
    )
    g.avgOvr = Math.round(g.players.reduce((s, p) => s + p.ovr, 0) / g.players.length)
  }
  // ALL 모드: 연도 내림차순 → AVG OVR 내림차순
  return [...map.values()].sort((a, b) =>
    b.year !== a.year ? b.year - a.year : b.avgOvr - a.avgOvr
  )
}

function avgOvrColor(avg: number): string {
  if (avg >= 93) return '#e9c349'
  if (avg >= 88) return '#f3f4f6'
  return '#9ca3af'
}

const SearchIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

export default function DexPage() {
  const [players, setPlayers] = useState<PlayerSeason[]>([])
  const [loading, setLoading] = useState(true)

  // 필터 상태 — number|null (null=ALL 시즌)
  const [selectedLeague, setSelectedLeague] = useState<LeagueCode | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(2024)
  const [searchQuery, setSearchQuery] = useState('')

  // mount 후 fetch — §13.5
  useEffect(() => {
    fetch('/data/players.json')
      .then(r => r.json() as Promise<PlayerSeason[]>)
      .then(data => { setPlayers(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // 팀 그룹 계산 (year=null → 전 시즌)
  const allTeams = useMemo(
    () => buildTeamGroups(players, selectedYear),
    [players, selectedYear]
  )

  // 리그 + 검색 필터
  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let teams = allTeams
    if (selectedLeague) teams = teams.filter(g => g.league === selectedLeague)
    if (q) {
      teams = teams.filter(g =>
        g.players.some(p =>
          p.nameEn.toLowerCase().includes(q) ||
          (p.nameKo?.includes(q) ?? false) ||
          p.playerId.toLowerCase().includes(q)
        )
      )
    }
    return teams
  }, [allTeams, selectedLeague, searchQuery])

  function toggleLeague(l: LeagueCode) {
    setSelectedLeague(prev => (prev === l ? null : l))
  }

  const totalPlayers = filteredTeams.reduce((s, g) => s + g.players.length, 0)

  return (
    <div className="min-h-screen text-on-surface font-body-main">

      {/* ── 데스크톱 헤더 (fixed) — 검색창 제거, COLLECTION+PLAY GAME만 ── */}
      <header className="hidden md:flex fixed top-0 left-0 w-full z-50 items-center px-10 py-4 border-b border-outline-variant/30 bg-[#14141c]/95 backdrop-blur-md">
        <Link href="/" className="font-ovr-display text-ovr-display tracking-tighter text-on-surface hover:text-secondary transition-colors mr-8">
          GRANDSLAM
        </Link>
        <nav className="flex gap-6">
          <span className="font-heading-md text-heading-md text-secondary border-b-2 border-secondary pb-1 uppercase cursor-default">
            COLLECTION
          </span>
          <Link href="/draft" className="font-heading-md text-heading-md text-on-surface-variant hover:text-secondary transition-colors uppercase">
            PLAY GAME
          </Link>
        </nav>
      </header>

      {/* ── 모바일 헤더 (fixed) ── */}
      <header className="flex md:hidden fixed top-0 left-0 w-full z-50 items-center justify-between px-5 py-4 border-b border-outline-variant/30 bg-[#14141c]/95 backdrop-blur-md">
        <Link href="/" className="font-ovr-display text-ovr-display-mobile tracking-tighter text-on-surface">
          GRANDSLAM
        </Link>
        <Link href="/draft" className="font-label-caps text-[11px] text-secondary uppercase tracking-wider">
          PLAY GAME
        </Link>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main className="pt-20 md:pt-28 pb-24 px-5 md:px-10 max-w-7xl mx-auto relative z-10">

        {/* 타이틀 */}
        <div className="mb-8 md:mb-12">
          <h1 className="font-ovr-display text-[40px] md:text-ovr-display tracking-tight text-on-surface uppercase drop-shadow-md">
            PLAYER COLLECTION
          </h1>
          {!loading && (
            <p className="font-label-caps text-label-caps text-outline/50 mt-2 uppercase">
              {filteredTeams.length} Teams · {totalPlayers} Players
              {selectedYear === null && (
                <span className="ml-2 text-secondary/60">· All Seasons</span>
              )}
            </p>
          )}
        </div>

        {/* ── 필터 바 ── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-[#1e1f2a]/50 p-4 rounded-lg border border-outline-variant/30 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3 md:gap-4">

            {/* 리그 칩 — ALL 포함 */}
            <div className="flex gap-1.5">
              {/* ALL 버튼 */}
              <button
                onClick={() => setSelectedLeague(null)}
                className={`px-3 py-1 rounded font-label-caps text-[11px] uppercase tracking-wider transition-all border ${
                  selectedLeague === null
                    ? 'border-on-surface-variant/60 text-on-surface'
                    : 'border-outline-variant/40 text-outline/50 hover:text-outline'
                }`}
              >
                ALL
              </button>
              {LEAGUES.map(l => {
                const isActive = selectedLeague === l
                const isDimmed = selectedLeague !== null && !isActive
                return (
                  <button
                    key={l}
                    onClick={() => toggleLeague(l)}
                    className={`px-3 py-1 rounded font-label-caps text-[11px] uppercase tracking-wider transition-all ${
                      isDimmed ? 'opacity-35 hover:opacity-75' : 'opacity-100'
                    }`}
                    style={{
                      border: `1px solid ${LEAGUE_COLOR[l]}`,
                      color: LEAGUE_COLOR[l],
                      backgroundColor: isActive ? `${LEAGUE_COLOR[l]}1a` : 'transparent',
                    }}
                  >
                    {l}
                  </button>
                )
              })}
            </div>

            <div className="w-px h-4 bg-outline-variant hidden md:block" />

            {/* 시즌 드롭다운 — ALL 옵션 포함 */}
            <div className="flex items-center gap-2">
              <span className="font-label-caps text-label-caps text-on-surface uppercase">SEASON</span>
              <select
                value={selectedYear ?? 'ALL'}
                onChange={e => setSelectedYear(e.target.value === 'ALL' ? null : Number(e.target.value))}
                className="bg-surface-container-high border border-outline-variant font-label-caps text-label-caps text-on-surface rounded py-1 pl-2 pr-6 focus:outline-none focus:ring-1 focus:ring-outline/50 cursor-pointer"
              >
                <option value="ALL">ALL</option>
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 선수 검색 (단일 — 헤더 검색 제거) */}
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Players..."
              className="bg-[#14141c] border border-outline-variant w-full rounded text-sm font-body-main text-on-surface py-1.5 pl-3 pr-8 focus:outline-none focus:ring-1 focus:ring-outline/50"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline">
              <SearchIcon />
            </span>
          </div>
        </div>

        {/* ── 로딩 ── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <p className="font-label-caps text-label-caps text-outline/50 animate-pulse uppercase tracking-widest">
              Loading...
            </p>
          </div>
        )}

        {/* ── 팀 그리드 ── */}
        {!loading && (
          <div className="space-y-12">
            {filteredTeams.length === 0 && (
              <p className="font-label-caps text-label-caps text-outline/40 text-center py-16 uppercase">
                No teams found
              </p>
            )}

            {filteredTeams.map(group => (
              <section key={group.key} className="space-y-4">
                {/* 팀 헤더 */}
                <div className="flex items-baseline gap-3 border-b border-outline-variant/30 pb-2">
                  <h2 className="font-heading-lg text-heading-lg text-on-surface tracking-wide">
                    {group.team}
                  </h2>
                  <span className="font-heading-md text-heading-md text-on-surface-variant">
                    ({group.year})
                  </span>
                  <span className="text-outline">·</span>
                  <span
                    className="font-heading-md text-heading-md"
                    style={{ color: avgOvrColor(group.avgOvr) }}
                  >
                    AVG {group.avgOvr}
                  </span>
                </div>

                {/* 5명 카드 그리드 */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
                  {group.players.map(player => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      size="dex"
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

    </div>
  )
}
