'use client'
// /dex — PLAYER COLLECTION (Stitch v0 디자인 기준)
// §13.4 데이터 플로우: players.json fetch → 팀별 그룹핑 → 필터 → 렌더
// §13.5 hydration: fetch는 mount 후, 초기 렌더는 서버와 동일 상태

import { useEffect, useState, useMemo } from 'react'
import PlayerCard from '@/components/PlayerCard'
import SiteHeader from '@/components/SiteHeader'
import BottomNav from '@/components/BottomNav'
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

      <SiteHeader activePage="collection" fixed />

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
        {/* 모바일: 수평 스크롤 pill 칩 행 / 데스크톱: flex row */}
        <div className="mb-6">

          {/* 리그 칩 + 시즌 — 모바일 가로 스크롤 */}
          <div className="flex overflow-x-auto gap-2 pb-3 -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap md:items-center md:gap-3 scrollbar-hide">
            {/* ALL */}
            <button
              onClick={() => setSelectedLeague(null)}
              className={`shrink-0 px-4 py-1.5 rounded-full font-label-caps text-[11px] uppercase tracking-wider transition-all border whitespace-nowrap ${
                selectedLeague === null
                  ? 'border-on-surface-variant/60 bg-surface-variant text-on-surface'
                  : 'border-outline-variant/40 text-outline/60 hover:text-outline'
              }`}
            >
              ALL REGIONS
            </button>
            {LEAGUES.map(l => {
              const isActive = selectedLeague === l
              const isDimmed = selectedLeague !== null && !isActive
              return (
                <button
                  key={l}
                  onClick={() => toggleLeague(l)}
                  className={`shrink-0 px-4 py-1.5 rounded-full font-label-caps text-[11px] uppercase tracking-wider transition-all whitespace-nowrap ${
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

            {/* 구분선 — 데스크톱만 */}
            <div className="w-px h-4 bg-outline-variant hidden md:block self-center" />

            {/* 시즌 드롭다운 */}
            <div className="shrink-0 flex items-center gap-2">
              <span className="font-label-caps text-[11px] text-on-surface uppercase tracking-wider">SEASON</span>
              <select
                value={selectedYear ?? 'ALL'}
                onChange={e => setSelectedYear(e.target.value === 'ALL' ? null : Number(e.target.value))}
                className="bg-surface-container-high border border-outline-variant font-label-caps text-label-caps text-on-surface rounded-full py-1 pl-3 pr-7 focus:outline-none focus:ring-1 focus:ring-outline/50 cursor-pointer"
              >
                <option value="ALL">ALL</option>
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 선수 검색 — 모바일 별도 행, 데스크톱에서도 아래에 배치 */}
          <div className="relative mt-3">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search players..."
              className="bg-surface-container-lowest/60 border border-outline-variant/60 focus:border-secondary/60 w-full md:max-w-sm rounded-full text-sm font-body-main text-on-surface py-2 pl-4 pr-9 focus:outline-none focus:ring-1 focus:ring-secondary/30 transition-all"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-outline">
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
                {/* 모바일 3열 (3+2 레이아웃), 데스크톱 5열 */}
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
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

      {/* 모바일 하단 탭바 — §6 공유 컴포넌트 */}
      <BottomNav activePage="collection" />

    </div>
  )
}
