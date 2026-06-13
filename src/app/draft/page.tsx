'use client'
// §6.1 Draft game body — IDLE→SPIN→PICK→SIM→REVEAL→RESULT
// §13.4 Data flow comments required (first React project)
// §13.5 Hydration guard: initial render matches server, fetch after mount
// v0 디자인 통합: stage-lighting 배경, 카드 fly/shuffle 애니메이션, v0 헤더

import { useEffect, useRef, useState, type ReactNode } from 'react'
import PlayerCard from '@/components/PlayerCard'
import SiteHeader from '@/components/SiteHeader'
import BottomNav from '@/components/BottomNav'
import { useDraftMachine, ROLES } from '@/lib/useDraftMachine'
import type { DraftData } from '@/lib/useDraftMachine'
import type { PlayerSeason } from '@/lib/data'
import type { SimStep } from '@/lib/sim'
import { highlightRoundLabel, pickHighlightSteps, type HighlightStep } from '@/lib/simHighlight'

function sectionShort(h: HighlightStep): string {
  if (h.section === 'Spring Split') return 'Spring'
  if (h.section === 'Summer Split') return 'Summer'
  return h.section
}

// ── Data load hook ────────────────────────────────────────────────────────────
// §13.5: fetch only after mount (no window/fetch needed in SSR)
function useDraftData() {
  const [data, setData] = useState<DraftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Parallel load of 4 JSON files after mount
    Promise.all([
      fetch('/data/players.json').then(r => r.json()),
      fetch('/data/teams.json').then(r => r.json()),
      fetch('/data/spin-index.json').then(r => r.json()),
      fetch('/data/opponents-2026.json').then(r => r.json()),
    ]).then(([players, teams, spinIndex, opponents]) => {
      setData({ players, teams, spinIndex, opponents })
      setLoading(false)
    }).catch(e => {
      setError(String(e))
      setLoading(false)
    })
  }, []) // run once on mount — data is build-time fixed

  return { data, loading, error }
}

// ── 슬롯 아이템 (v0 스타일) ────────────────────────────────────────────────────
// 비어있으면 점선 사각, 채워지면 PlayerCard slot 사이즈
function SlotItem({ role, player }: { role: string; player: PlayerSeason | null }) {
  if (!player) {
    return (
      <div className="w-[110px] md:w-[140px] aspect-[5/7] rounded border-2 border-dashed border-outline-variant/30 flex items-center justify-center bg-[#14141c]/50 flex-shrink-0">
        <span className="font-label-caps text-[11px] text-outline/50">{role}</span>
      </div>
    )
  }
  return <PlayerCard player={player} size="slot" />
}

// 상단 5슬롯 행
function DraftSlotRow({ picks }: { picks: (ReturnType<typeof useDraftMachine>['state']['picks'][0])[] }) {
  return (
    <div className="flex gap-3 md:gap-4 justify-center w-full flex-nowrap">
      {ROLES.map((role, i) => (
        <SlotItem key={role} role={role} player={picks[i]?.player ?? null} />
      ))}
    </div>
  )
}

// 모바일 5슬롯 그리드 (grid-cols-5)
// isPickPhase: true → 비어있는 슬롯에 골드 테두리+글로우 (Stitch 디자인)
function MobileSlotRow({ picks, isPickPhase }: {
  picks: (ReturnType<typeof useDraftMachine>['state']['picks'][0])[]
  isPickPhase: boolean
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ROLES.map((role, i) => {
        const player = picks[i]?.player ?? null
        if (!player) {
          return isPickPhase ? (
            // PICK 중: 골드 테두리 + 은은한 글로우
            <div key={role} className="aspect-[5/7] rounded border-2 border-secondary/60 bg-surface-container-lowest flex flex-col items-center justify-center gap-0.5 shadow-[0_0_8px_rgba(233,195,73,0.2)]">
              <span className="text-secondary text-sm font-bold leading-none">+</span>
              <span className="font-label-caps text-[8px] text-secondary font-bold">{role}</span>
            </div>
          ) : (
            // SPIN/기타: 점선 빈 슬롯
            <div key={role} className="aspect-[5/7] rounded border-2 border-dashed border-outline-variant/30 flex items-center justify-center bg-[#14141c]/50">
              <span className="text-[9px] text-outline/50 font-semibold">{role}</span>
            </div>
          )
        }
        return <PlayerCard key={role} player={player} size="slot" />
      })}
    </div>
  )
}

// ── Reroll 아이콘 ──────────────────────────────────────────────────────────────
const RerollIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0 transition-transform duration-500 group-hover:-rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6"/>
    <path d="M1 20v-6h6"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
)

// ── 픽 화면 버튼 ───────────────────────────────────────────────────────────────
// layout="mobile": 전체 너비 버튼 스타일 (Stitch), layout="desktop": 기존 컴팩트 스타일
function PickButtons({
  onPlayAgain,
  onReroll,
  rerollLeft,
  layout = 'desktop',
}: {
  onPlayAgain: () => void
  onReroll: () => void
  rerollLeft: number
  layout?: 'mobile' | 'desktop'
}) {
  if (layout === 'mobile') {
    return (
      <div className="flex flex-col gap-2">
        <button
          onClick={onReroll}
          disabled={rerollLeft <= 0}
          className="group w-full py-3.5 border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface font-heading-md text-heading-md uppercase rounded flex items-center justify-center gap-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RerollIcon />
          Reroll ({rerollLeft} left)
        </button>
        <button
          onClick={onPlayAgain}
          className="font-label-caps text-[11px] text-outline hover:text-secondary transition-colors py-2 text-center"
        >
          Play Again
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center gap-5 mt-2">
      <button
        onClick={onReroll}
        disabled={rerollLeft <= 0}
        className="group flex items-center gap-2 font-label-caps text-label-caps py-3 px-8 rounded bg-surface-bright hover:bg-surface-variant border border-outline-variant hover:border-secondary/50 text-on-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <RerollIcon />
        Reroll ({rerollLeft})
      </button>
      <button
        onClick={onPlayAgain}
        className="font-label-caps text-[11px] text-outline hover:text-secondary transition-colors"
      >
        Play Again
      </button>
    </div>
  )
}

// ── 픽 카드 그리드 (fly + shuffle 애니메이션 포함) ─────────────────────────────
function PickRosterGrid({
  roster,
  pickedPlayerIds,
  emptyRoles,
  onPick,
  shufflePhase,
  layout,
}: {
  roster: PlayerSeason[]
  pickedPlayerIds: Set<string>
  emptyRoles: string[]
  onPick: (p: PlayerSeason) => void
  shufflePhase: 'out' | 'in' | null
  layout: 'mobile' | 'desktop'
}) {
  // flyingId: 클릭된 카드가 날아가는 동안 추적 (600ms 후 실제 pick 실행)
  const [flyingId, setFlyingId] = useState<string | null>(null)

  function handlePickWithFly(p: PlayerSeason) {
    if (flyingId) return  // 이미 fly 중이면 무시
    setFlyingId(p.id)
    setTimeout(() => {
      setFlyingId(null)
      onPick(p)
    }, 550)
  }

  // 모바일: grid-cols-3 (Stitch) / 데스크톱: flex nowrap
  const rowCls = layout === 'mobile'
    ? 'grid grid-cols-3 gap-2'
    : 'flex flex-nowrap gap-4 justify-center w-full'

  return (
    <div className={rowCls}>
      {[...roster]
        .sort((a, b) => ROLES.indexOf(a.role as (typeof ROLES)[number]) - ROLES.indexOf(b.role as (typeof ROLES)[number]))
        .map((p, idx) => {
          const isFilled  = !emptyRoles.includes(p.role)
          const isPicked  = pickedPlayerIds.has(p.playerId)
          const isDisabled = isFilled || isPicked
          // 리롤 시차: --card-idx → animation-delay calc() (is-shuffle-out/in)
          // 비활성 카드도 동일하게 애니메이션 (shufflePhase 무조건 적용)
          const shuffleCls = shufflePhase === 'out' ? 'is-shuffle-out'
                           : shufflePhase === 'in'  ? 'is-shuffle-in'
                           : ''
          return (
            <div
              key={p.id}
              style={{ '--card-idx': idx } as React.CSSProperties}
              className={shuffleCls}
            >
              <PlayerCard
                player={p}
                size={layout === 'mobile' ? 'dex' : 'pick'}
                disabled={isDisabled}
                isFlying={flyingId === p.id}
                onClick={() => !isDisabled && handlePickWithFly(p)}
              />
            </div>
          )
        })}
    </div>
  )
}

// ── PICK 화면 (모바일) ─────────────────────────────────────────────────────────
function MobilePickScreen({
  roster, pickedPlayerIds, emptyRoles, onPick,
  onReroll, onPlayAgain, rerollLeft, spunTeam, shufflePhase,
}: {
  roster: PlayerSeason[]
  pickedPlayerIds: Set<string>
  emptyRoles: string[]
  onPick: (p: PlayerSeason) => void
  onReroll: () => void
  onPlayAgain: () => void
  rerollLeft: number
  spunTeam: { team: string; year: number } | null
  shufflePhase: 'out' | 'in' | null
}) {
  return (
    <div className="flex flex-col gap-3 w-full">
      <PickRosterGrid
        roster={roster}
        pickedPlayerIds={pickedPlayerIds}
        emptyRoles={emptyRoles}
        onPick={onPick}
        shufflePhase={shufflePhase}
        layout="mobile"
      />
      <PickButtons onPlayAgain={onPlayAgain} onReroll={onReroll} rerollLeft={rerollLeft} layout="mobile" />
    </div>
  )
}

// ── PICK 화면 (데스크톱) ───────────────────────────────────────────────────────
function DesktopPickScreen({
  roster, pickedPlayerIds, emptyRoles, onPick,
  onReroll, onPlayAgain, rerollLeft, spunTeam, shufflePhase,
}: {
  roster: PlayerSeason[]
  pickedPlayerIds: Set<string>
  emptyRoles: string[]
  onPick: (p: PlayerSeason) => void
  onReroll: () => void
  onPlayAgain: () => void
  rerollLeft: number
  spunTeam: { team: string; year: number } | null
  shufflePhase: 'out' | 'in' | null
}) {
  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <PickRosterGrid
        roster={roster}
        pickedPlayerIds={pickedPlayerIds}
        emptyRoles={emptyRoles}
        onPick={onPick}
        shufflePhase={shufflePhase}
        layout="desktop"
      />
      <PickButtons onPlayAgain={onPlayAgain} onReroll={onReroll} rerollLeft={rerollLeft} />
    </div>
  )
}

// ── REVEAL ─────────────────────────────────────────────────────────────────────
function RevealScreen({
  highlights, revealStep, onSkip,
}: {
  highlights: HighlightStep[]
  revealStep: number
  onSkip: () => void
}) {
  const current = revealStep > 0 ? highlights[revealStep - 1] : null
  const step = current?.step

  function stepResult(s: SimStep): 'win' | 'lose' | 'neutral' {
    if (s.stage.endsWith('_missed') || s.stage === 'worlds_swiss_out' || s.stage === 'msi_out') return 'lose'
    if (s.stage.endsWith('win')) return 'win'
    const s0 = s.series?.[0]
    if (s0) return s0.win ? 'win' : 'lose'
    return 'neutral'
  }

  const cur = step ? stepResult(step) : 'neutral'
  const isMissed = step && (step.stage.includes('_missed') || step.stage === 'worlds_swiss_out' || step.stage === 'msi_out')
  const ser = step?.series?.[0]

  return (
    <div className="flex flex-col items-center" style={{ minHeight: '55vh' }}>
      <div className="w-full max-w-sm flex justify-end mb-2">
        <button
          onClick={onSkip}
          className="font-label-caps text-[10px] px-3 py-1.5 rounded border border-outline-variant text-outline hover:text-on-surface hover:border-secondary/40 transition-colors"
        >
          Skip
        </button>
      </div>

      {current && step && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center py-6 w-full max-w-sm">
          <p className="font-label-caps text-label-caps text-outline/50 uppercase">
            {current.section}
          </p>
          <p className={`text-2xl font-black tracking-wide ${
            cur === 'win' ? 'text-on-surface' : cur === 'lose' ? 'text-on-surface/60' : 'text-outline'
          }`}>
            {highlightRoundLabel(current)}
          </p>
          <h2 className={`text-xl font-bold leading-snug px-2 ${
            cur === 'win' ? 'text-green-300' : cur === 'lose' ? 'text-red-300' : 'text-outline'
          }`}>
            {ser ? `${ser.win ? 'WIN' : 'LOSS'} vs ${ser.opp}` : step.label}
          </h2>
          {ser && (
            <div className="flex flex-col items-center gap-3">
              <div className={`text-5xl font-black tabular-nums ${ser.win ? 'text-green-400' : 'text-red-400'}`}>
                {ser.score}
              </div>
              {ser.games && ser.games.length > 0 && (
                <div className="flex gap-2.5">
                  {ser.games.map((gWin, idx) => (
                    <div key={idx} className={`w-4 h-4 rounded-full ${gWin ? 'bg-green-400' : 'bg-red-400/80'}`} />
                  ))}
                </div>
              )}
            </div>
          )}
          {isMissed && !ser && <span className="text-outline/40 text-sm tracking-widest">DNQ</span>}
        </div>
      )}

      <div className="flex justify-center gap-2 mt-6 pb-2">
        {highlights.map((h, i) => (
          <div
            key={h.section}
            title={h.section}
            className={`rounded-full transition-all duration-300 ${
              i < revealStep ? 'w-8 h-2 bg-secondary/60' : 'w-2 h-2 bg-outline/20'
            }`}
          />
        ))}
      </div>
      <p className="font-label-caps text-[10px] text-outline/30 mt-2 tabular-nums">
        {Math.min(revealStep, highlights.length)} / {highlights.length}
      </p>
    </div>
  )
}

// ── 결과 화면 버튼 아이콘 ─────────────────────────────────────────────────────
const LinkIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
)
const ReplayIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4v6h6"/>
    <path d="M3.51 15a9 9 0 1 0 .49-4.17"/>
  </svg>
)

// Grade accent colors — tailwind.config grade-* 토큰 사용
const GRADE_COLOR: Record<string, string> = {
  'GRAND SLAM':   'text-grade-grandslam',
  'LEGENDARY':    'text-grade-legendary',
  'ELITE':        'text-grade-elite',
  'CONTENDER':    'text-grade-contender',
  'PLAYOFF TEAM': 'text-on-surface',
  'REBUILD':      'text-outline',
}

// ── 모바일 결과 전용 헬퍼 ─────────────────────────────────────────────────────
// 달성 단계 → 영문 라벨 (모바일 시즌 카드)
function mobileRoundLabel(h: HighlightStep): string {
  const stage = h.step.stage
  const won   = h.step.series?.[0]?.win ?? stage.endsWith('win')
  if (stage === 'Spring_missed' || stage === 'Summer_missed') return 'DNQ'
  if (stage === 'worlds_swiss_out')
    return (h.step.label.includes('DNQ') || h.step.label.includes('미진출')) ? 'DNQ' : 'SWISS ELIM'
  if (stage === 'msi_out')
    return (h.step.label.includes('DNQ') || h.step.label.includes('미진출')) ? 'DNQ' : 'ELIMINATED'
  if (stage === 'msi_win' || stage === 'worlds_win') return 'CHAMPIONS'
  if (stage === 'Spring_final' || stage === 'Summer_final') return won ? 'CHAMPIONS' : 'FINALIST'
  if (stage === 'Spring_sf'    || stage === 'Summer_sf')    return won ? 'FINALIST'  : 'PLAYOFFS'
  if (stage === 'worlds_final') return won ? 'CHAMPIONS' : 'FINALIST'
  if (stage === 'worlds_sf')    return 'SEMIFINALS'
  if (stage === 'worlds_qf')    return won ? 'SEMIFINALS' : 'QUARTERFINALS'
  if (stage === 'msi_r3') return won ? 'CHAMPIONS' : 'FINALIST'
  if (stage === 'msi_r2') return won ? 'FINALIST'  : 'SEMIFINALS'
  if (stage === 'msi_r1') return won ? 'SEMIFINALS' : 'QUARTERFINALS'
  if (stage.startsWith('worlds_swiss_r')) return 'SWISS'
  return stage.replace(/_/g, ' ').toUpperCase()
}

const MOBILE_SECTION_SHORT: Record<string, string> = {
  'Spring Split': 'SPRING', 'MSI': 'MSI', 'Summer Split': 'SUMMER', 'Worlds': 'WORLDS',
}

// 시즌 결과 개별 카드 (2×2 그리드)
function MobileSeasonCard({ h, isHighlight }: { h: HighlightStep; isHighlight: boolean }) {
  const roundLabel = mobileRoundLabel(h)
  const isDNQ = roundLabel === 'DNQ'
  const ser   = h.step.series?.[0]

  return (
    <div className={[
      'rounded flex flex-col items-center justify-center relative overflow-hidden py-3 px-2 min-h-[90px]',
      isHighlight
        ? 'bg-surface-container-high border-2 border-secondary/50 shadow-[0_0_12px_rgba(233,195,73,0.1)]'
        : 'bg-surface-container-low border border-outline-variant',
    ].join(' ')}>
      {isHighlight && (
        <div className="absolute inset-0 card-shimmer opacity-20 pointer-events-none" aria-hidden />
      )}
      <span className={`font-label-caps text-[10px] mb-1 z-10 ${isHighlight ? 'text-secondary' : 'text-outline'}`}>
        {MOBILE_SECTION_SHORT[h.section] ?? h.section.toUpperCase()}
      </span>
      <span className={`font-heading-md text-[18px] leading-tight text-center z-10 ${isDNQ ? 'text-outline/50' : 'text-on-surface'}`}>
        {roundLabel}
      </span>
      {ser && !isDNQ && (
        <div className={`mt-1 z-10 flex items-start gap-1 font-body-main text-[10px] leading-tight ${ser.win ? 'text-green-400' : 'text-red-400'}`}>
          <span className="flex-shrink-0">{ser.win ? '✓' : '✗'}</span>
          <span>{ser.win ? `def. ${ser.opp} ${ser.score}` : `lost to ${ser.opp} ${ser.score}`}</span>
        </div>
      )}
    </div>
  )
}

// 모바일 결과 화면 전체 레이아웃 (Stitch 모바일 디자인)
function MobileResultScreen({
  simResult, picks, onReset,
}: {
  simResult: NonNullable<ReturnType<typeof useDraftMachine>['state']['simResult']>
  picks: ReturnType<typeof useDraftMachine>['state']['picks']
  onReset: () => void
}) {
  const highlights  = pickHighlightSteps(simResult.steps)
  const gradeColor  = GRADE_COLOR[simResult.grade] ?? 'text-on-surface'

  // 가장 높은 트로피 획득 섹션에 금테 강조
  const highlightSection: string | null =
    simResult.trophies.includes('WORLDS')  ? 'Worlds'       :
    simResult.trophies.includes('MSI')     ? 'MSI'          :
    simResult.trophies.includes('SPLIT2')  ? 'Summer Split' :
    simResult.trophies.includes('SPLIT1')  ? 'Spring Split' : null

  return (
    <div className="flex flex-col items-center w-full pb-24">

      {/* 등급명 */}
      <h1 className={`font-heading-lg text-heading-lg uppercase text-center mb-4 ${gradeColor}`}>
        {simResult.grade}
      </h1>

      {/* 시즌 결과 2×2 그리드 */}
      <div className="w-full grid grid-cols-2 gap-3 mb-6">
        {highlights.map(h => (
          <MobileSeasonCard
            key={h.section}
            h={h}
            isHighlight={h.section === highlightSection}
          />
        ))}
      </div>

      {/* 선수 카드 3+2 (TOP/JGL/MID → ADC/SUP) */}
      <div className="w-full flex flex-col items-center gap-3 mb-8">
        <div className="flex justify-center gap-2 w-full">
          {[0, 1, 2].map(i => picks[i] && (
            <div key={i} className="w-[30%]">
              <PlayerCard player={picks[i]!.player} size="mob-result" />
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-2 w-full">
          {[3, 4].map(i => picks[i] && (
            <div key={i} className="w-[30%]">
              <PlayerCard player={picks[i]!.player} size="mob-result" />
            </div>
          ))}
        </div>
      </div>

      {/* PLAY AGAIN 버튼 */}
      <button
        onClick={onReset}
        className="w-full bg-secondary hover:opacity-90 text-on-secondary font-heading-md text-heading-md py-4 rounded uppercase tracking-widest transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(233,195,73,0.2)]"
      >
        PLAY AGAIN
      </button>

      {/* URL 워터마크 (공유 캡처용) */}
      <p className="font-label-caps text-[8px] text-outline/30 text-center mt-3">
        grandslamlol.vercel.app
      </p>
    </div>
  )
}

// ── RESULT screen (모바일: Stitch 모바일 / 데스크톱: Stitch v1) ────────────────
function ResultScreen({
  simResult, picks, seed, onReset,
}: {
  simResult: NonNullable<ReturnType<typeof useDraftMachine>['state']['simResult']>
  picks: ReturnType<typeof useDraftMachine>['state']['picks']
  seed: number
  onReset: () => void
}) {
  const [copied, setCopied] = useState(false)

  const pIds = ROLES.map((_, i) => picks[i]?.player.id ?? '').join('.')
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/r?p=${encodeURIComponent(pIds)}&s=${seed}`
    : ''

  const handleCopy = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const highlights = pickHighlightSteps(simResult.steps)
  const gradeColor = GRADE_COLOR[simResult.grade] ?? 'text-on-surface'

  // DNQ=dim / 우승=gold / 그 외=white (데스크톱 시즌 그리드)
  function sectionTone(h: HighlightStep): string {
    const stage = h.step.stage
    const isDNQ =
      stage === 'Spring_missed' || stage === 'Summer_missed' ||
      (stage === 'msi_out' && (h.step.label.includes('DNQ') || h.step.label.includes('미진출'))) ||
      (stage === 'worlds_swiss_out' && h.step.label.includes('DNQ'))
    if (isDNQ) return 'text-outline/50'
    const isWin =
      stage === 'msi_win' || stage === 'worlds_win' ||
      ((stage === 'Spring_final' || stage === 'Summer_final' || stage === 'worlds_final' || stage === 'msi_r3') &&
        (h.step.series?.[0]?.win ?? false))
    if (isWin) return 'text-secondary'
    return 'text-on-surface'
  }

  const SECTION_SHORT: Record<string, string> = {
    'Spring Split': 'Spring', 'MSI': 'MSI', 'Summer Split': 'Summer', 'Worlds': 'Worlds',
  }

  return (
    <div className="w-full py-4">

      {/* ── 모바일 전용 ── */}
      <div className="md:hidden">
        <MobileResultScreen simResult={simResult} picks={picks} onReset={onReset} />
      </div>

      {/* ── 데스크톱 전용 ── */}
      <div className="hidden md:flex flex-col items-center">

        {/* 등급 헤더 */}
        <div className="text-center mb-6">
          <p className="font-label-caps text-label-caps text-outline uppercase tracking-widest mb-2">
            Season Result
          </p>
          <h2 className={`font-ovr-display text-[72px] leading-none tracking-tighter uppercase drop-shadow-lg ${gradeColor}`}>
            {simResult.grade}
          </h2>
          <p className="font-heading-md text-heading-md text-on-surface-variant uppercase tracking-wide mt-1">
            Team OVR {simResult.teamOvr}
          </p>
        </div>

        {/* 시즌 결과 4칸 그리드 */}
        <div className="grid grid-cols-4 gap-x-8 gap-y-2 mb-8 text-sm">
          {highlights.map(h => (
            <div key={h.section} className="flex flex-col gap-0.5">
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">
                {SECTION_SHORT[h.section] ?? h.section}
              </span>
              <span className={`font-body-main text-sm ${sectionTone(h)}`}>
                {highlightRoundLabel(h)}
              </span>
            </div>
          ))}
        </div>

        {/* 선수 카드 가로 스크롤 (snap) */}
        <div className="w-full max-w-[1100px] flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory pb-4 justify-center gap-4">
          {ROLES.map((_, i) => picks[i] && (
            <div key={i} className="flex-shrink-0 snap-center">
              <PlayerCard player={picks[i]!.player} size="result" />
            </div>
          ))}
        </div>

        {/* URL 워터마크 */}
        <p className="font-label-caps text-[10px] text-outline/40 select-none mt-1 mb-6">
          grandslamlol.vercel.app
        </p>

        {/* 액션 버튼 */}
        <div className="flex flex-row gap-3 items-center w-full max-w-sm justify-center">
          <button
            onClick={handleCopy}
            className="w-full px-6 py-3 rounded border border-outline-variant bg-surface-container hover:bg-surface-bright text-on-surface font-label-caps text-label-caps flex items-center justify-center gap-2 transition-colors"
          >
            <LinkIcon />
            {copied ? '✓ COPIED!' : 'COPY LINK'}
          </button>
          <button
            onClick={onReset}
            className="w-full px-8 py-3 rounded bg-secondary hover:opacity-90 text-on-secondary font-label-caps text-label-caps font-bold flex items-center justify-center gap-2 transition-opacity"
          >
            <ReplayIcon />
            PLAY AGAIN
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DraftPage() {
  const { data, loading } = useDraftData()
  const machine = useDraftMachine(data)
  const { state } = machine

  // 리롤 2단계 애니메이션 상태 — out: 기존 카드 페이드아웃, in: 새 카드 페이드인
  const [shufflePhase, setShufflePhase] = useState<'out' | 'in' | null>(null)

  const handlePlayAgain = () => {
    machine.reset()
  }

  function handleReroll() {
    if (shufflePhase !== null) return  // 이미 애니메이션 중이면 무시
    // out 완료 시점: 마지막 카드(idx=9) delay + 250ms 애니메이션 = 9*30+250+20 = 540ms
    const OUT_MS = 540
    // in 완료 시점: 동일 계산 + 여유 = 550ms
    const IN_MS  = 550
    setShufflePhase('out')
    setTimeout(() => {
      machine.fullReroll()
      setShufflePhase('in')
      setTimeout(() => setShufflePhase(null), IN_MS)
    }, OUT_MS)
  }

  // StrictMode fires effects twice — refs guard against double invocation
  const startFiredRef    = useRef(false)
  const spinFiredRoundRef = useRef(-1)

  // GAME_SPEC §1: auto-spin immediately when data loads
  // IDLE + data 준비 → 즉시 start() 호출 (유저 개입 없이 첫 스핀 자동 시작)
  useEffect(() => {
    if (!data || state.phase !== 'IDLE') {
      if (state.phase !== 'IDLE') startFiredRef.current = false
      return
    }
    if (startFiredRef.current) return
    startFiredRef.current = true
    machine.start()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state.phase])

  // SPIN phase → spinNext 자동 호출 (라운드별 1회만)
  useEffect(() => {
    if (state.phase !== 'SPIN' || !data) {
      if (state.phase !== 'SPIN') spinFiredRoundRef.current = -1
      return
    }
    if (spinFiredRoundRef.current === state.round) return
    spinFiredRoundRef.current = state.round
    const emptyRoles = ROLES.filter((_, i) => state.picks[i] === null)
    const pickedIds  = new Set(state.picks.filter(Boolean).map(p => p!.player.playerId))
    machine.spinNext(state.round, pickedIds, emptyRoles)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.round])

  // SIM phase → 동기 시뮬 실행 (1초 미만)
  useEffect(() => {
    if (state.phase !== 'SIM') return
    machine.runSim()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  // REVEAL phase: 1.8s 간격 자동 진행
  const revealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (state.phase !== 'REVEAL') {
      if (revealIntervalRef.current) { clearInterval(revealIntervalRef.current); revealIntervalRef.current = null }
      return
    }
    revealIntervalRef.current = setInterval(() => { machine.revealNext() }, 1800)
    return () => { if (revealIntervalRef.current) clearInterval(revealIntervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  const isDraftScreen = state.phase === 'SPIN' || state.phase === 'PICK'

  return (
    <div
      className={`min-h-[100dvh] text-on-surface md:flex md:flex-col ${
        isDraftScreen ? 'md:h-screen md:min-h-0 md:overflow-hidden' : ''
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── 헤더 (SiteHeader 공유) ── */}
      {/* fixedMobile: 드래프트 페이지는 모바일 헤더 항상 fixed (BottomNav와 쌍) */}
      <SiteHeader
        activePage="draft"
        fixed={false}
        fixedMobile={true}
        rightSlot={
          state.phase !== 'IDLE' && !isDraftScreen ? (
            <div className="flex gap-2">
              {ROLES.map((role, i) => {
                const p = state.picks[i]?.player
                return p ? (
                  <PlayerCard key={role} player={p} size="slot" />
                ) : (
                  <div key={role} className="w-[55px] aspect-[5/7] rounded border border-dashed border-outline-variant/40 flex items-center justify-center">
                    <span className="font-label-caps text-[8px] text-outline/50">{role}</span>
                  </div>
                )
              })}
            </div>
          ) : undefined
        }
      />

      {/* ── Main content ── */}
      {/* pt-16 pb-20: 모바일 fixed 헤더(64px)+탭바(80px) 클리어런스, md:py-8 으로 데스크톱 복원 */}
      <main className={`mx-auto px-4 pt-16 pb-20 md:py-8 w-full relative z-10 md:flex-1 md:flex md:flex-col md:justify-center ${
        state.phase === 'RESULT'
          ? 'max-w-5xl'
          : isDraftScreen
          ? 'max-w-6xl md:px-10 md:py-4 md:min-h-0'
          : 'max-w-3xl'
      }`}>

        {/* IDLE */}
        {state.phase === 'IDLE' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="font-label-caps text-label-caps text-outline animate-pulse">
              {loading ? 'Loading...' : 'Preparing spin...'}
            </p>
          </div>
        )}

        {/* SPIN / PICK */}
        {(state.phase === 'SPIN' || state.phase === 'PICK') && (
          <>
            {/* ── 모바일 (Stitch 디자인) ── */}
            <div className="md:hidden flex flex-col gap-4 w-full">

              {/* 섹션 타이틀 */}
              <h1 className="text-center font-heading-md text-heading-md text-on-surface uppercase">
                Draft Roster
              </h1>

              {/* 5슬롯 그리드 — PICK 중 비어있는 슬롯은 골드 테두리 */}
              <MobileSlotRow picks={state.picks} isPickPhase={state.phase === 'PICK'} />

              {state.phase === 'SPIN' && (
                <p className="text-center text-on-surface animate-pulse font-label-caps text-label-caps">Spinning...</p>
              )}

              {state.phase === 'PICK' && state.spunTeam && (
                <div className="flex flex-col gap-3">
                  {/* 팀명 + 라운드 카운터 — 같은 행 */}
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading-md text-heading-md text-on-surface uppercase truncate">
                      {state.spunTeam.team} ({state.spunTeam.year})
                    </h2>
                    <span className="shrink-0 font-label-caps text-label-caps text-outline bg-surface-container-high px-2 py-1 rounded">
                      ROUND {state.round + 1}/5
                    </span>
                  </div>

                  <MobilePickScreen
                    roster={machine.currentRoster}
                    pickedPlayerIds={machine.pickedPlayerIds}
                    emptyRoles={machine.emptyRoles}
                    onPick={(p) => machine.pick(p, state.spunTeam!)}
                    onReroll={handleReroll}
                    onPlayAgain={handlePlayAgain}
                    rerollLeft={state.rerollLeft}
                    spunTeam={state.spunTeam}
                    shufflePhase={shufflePhase}
                  />
                </div>
              )}
            </div>

            {/* ── 데스크톱 ── */}
            <div className="hidden md:flex md:flex-col md:items-center md:gap-6 md:w-full md:flex-1 md:justify-center">
              {/* 상단 5슬롯 */}
              <DraftSlotRow picks={state.picks} />

              {/* Round 카운터 */}
              <p className="font-label-caps text-[10px] text-outline/60 uppercase tracking-[0.2em]">
                Round {state.round + 1} / 5
              </p>

              {state.phase === 'SPIN' && (
                <p className="text-center text-on-surface animate-pulse font-label-caps text-label-caps">Spinning...</p>
              )}
              {state.phase === 'PICK' && state.spunTeam && (
                <DesktopPickScreen
                  roster={machine.currentRoster}
                  pickedPlayerIds={machine.pickedPlayerIds}
                  emptyRoles={machine.emptyRoles}
                  onPick={(p) => machine.pick(p, state.spunTeam!)}
                  onReroll={handleReroll}
                  onPlayAgain={handlePlayAgain}
                  rerollLeft={state.rerollLeft}
                  spunTeam={state.spunTeam}
                  shufflePhase={shufflePhase}
                />
              )}
            </div>
          </>
        )}

        {state.phase === 'SIM' && (
          <p className="text-center text-on-surface animate-pulse py-12 font-label-caps text-label-caps">Simulating season...</p>
        )}

        {state.phase === 'REVEAL' && state.simResult && (
          <RevealScreen
            highlights={pickHighlightSteps(state.simResult.steps)}
            revealStep={state.revealStep}
            onSkip={machine.revealSkip}
          />
        )}

        {state.phase === 'RESULT' && state.simResult && (
          <ResultScreen
            simResult={state.simResult}
            picks={state.picks}
            seed={state.seed}
            onReset={machine.reset}
          />
        )}
      </main>

      {/* 모바일 하단 탭바 */}
      <BottomNav activePage="draft" />
    </div>
  )
}
