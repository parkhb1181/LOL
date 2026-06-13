'use client'
// §6.1 Draft game body — IDLE→SPIN→PICK→SIM→REVEAL→RESULT
// §13.4 Data flow comments required (first React project)
// §13.5 Hydration guard: initial render matches server, fetch after mount
// v0 디자인 통합: stage-lighting 배경, 카드 fly/shuffle 애니메이션, v0 헤더

import { useEffect, useRef, useState, type ReactNode } from 'react'
import PlayerCard from '@/components/PlayerCard'
import SiteHeader from '@/components/SiteHeader'
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
function MobileSlotRow({ picks }: { picks: (ReturnType<typeof useDraftMachine>['state']['picks'][0])[] }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ROLES.map((role, i) => {
        const player = picks[i]?.player ?? null
        if (!player) {
          return (
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
function PickButtons({
  onPlayAgain,
  onReroll,
  rerollLeft,
}: {
  onPlayAgain: () => void
  onReroll: () => void
  rerollLeft: number
}) {
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
  isShuffling,
  layout,
}: {
  roster: PlayerSeason[]
  pickedPlayerIds: Set<string>
  emptyRoles: string[]
  onPick: (p: PlayerSeason) => void
  isShuffling: boolean
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

  const rowCls = layout === 'mobile'
    ? 'flex flex-wrap gap-3 justify-center'
    : 'flex flex-nowrap gap-4 justify-center w-full'

  return (
    <div className={rowCls}>
      {[...roster]
        .sort((a, b) => ROLES.indexOf(a.role as (typeof ROLES)[number]) - ROLES.indexOf(b.role as (typeof ROLES)[number]))
        .map((p, idx) => {
          const isFilled  = !emptyRoles.includes(p.role)
          const isPicked  = pickedPlayerIds.has(p.playerId)
          const isDisabled = isFilled || isPicked
          return (
            <div
              key={p.id}
              // 리롤 시차: CSS --card-idx 변수로 계산 (rerollCycle animation-delay 에서 사용)
              style={{ '--card-idx': idx } as React.CSSProperties}
            >
              <PlayerCard
                player={p}
                size="pick"
                disabled={isDisabled}
                isFlying={flyingId === p.id}
                isShuffling={isShuffling && !isDisabled}
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
  onReroll, onPlayAgain, rerollLeft, spunTeam, isShuffling,
}: {
  roster: PlayerSeason[]
  pickedPlayerIds: Set<string>
  emptyRoles: string[]
  onPick: (p: PlayerSeason) => void
  onReroll: () => void
  onPlayAgain: () => void
  rerollLeft: number
  spunTeam: { team: string; year: number } | null
  isShuffling: boolean
}) {
  return (
    <div className="flex flex-col gap-5 w-full">
      <PickRosterGrid
        roster={roster}
        pickedPlayerIds={pickedPlayerIds}
        emptyRoles={emptyRoles}
        onPick={onPick}
        isShuffling={isShuffling}
        layout="mobile"
      />
      <PickButtons onPlayAgain={onPlayAgain} onReroll={onReroll} rerollLeft={rerollLeft} />
    </div>
  )
}

// ── PICK 화면 (데스크톱) ───────────────────────────────────────────────────────
function DesktopPickScreen({
  roster, pickedPlayerIds, emptyRoles, onPick,
  onReroll, onPlayAgain, rerollLeft, spunTeam, isShuffling,
}: {
  roster: PlayerSeason[]
  pickedPlayerIds: Set<string>
  emptyRoles: string[]
  onPick: (p: PlayerSeason) => void
  onReroll: () => void
  onPlayAgain: () => void
  rerollLeft: number
  spunTeam: { team: string; year: number } | null
  isShuffling: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <PickRosterGrid
        roster={roster}
        pickedPlayerIds={pickedPlayerIds}
        emptyRoles={emptyRoles}
        onPick={onPick}
        isShuffling={isShuffling}
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

// Grade accent colors
const GRADE_COLOR: Record<string, string> = {
  'GRAND SLAM':   'text-secondary',
  'LEGENDARY':    'text-[#c080ff]',
  'ELITE':        'text-[#60c0ff]',
  'CONTENDER':    'text-[#40d4a0]',
  'PLAYOFF TEAM': 'text-on-surface',
  'REBUILD':      'text-outline',
}

// ── RESULT screen ──────────────────────────────────────────────────────────────
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

  // DNQ=dim / 우승=gold / 그 외=일반 white (Stitch 컬러 체계)
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
    <div className="flex flex-col items-center gap-6 py-4">

      {/* Season Result 헤더 */}
      <div className="text-center">
        <p className="font-label-caps text-label-caps text-outline uppercase tracking-widest mb-2">
          Season Result
        </p>
        <h2 className={`font-ovr-display text-[48px] md:text-[72px] leading-none tracking-tighter uppercase drop-shadow-lg ${gradeColor}`}>
          {simResult.grade}
        </h2>
        <p className="font-heading-md text-heading-md text-on-surface-variant uppercase tracking-wide mt-1">
          Team OVR {simResult.teamOvr}
        </p>
      </div>

      {/* 4-column 시즌 결과 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-3">
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

      {/* 선수 카드 가로 스크롤 */}
      <div className="w-full flex overflow-x-auto gap-3 md:gap-4 pb-3 md:justify-center px-4 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ROLES.map((_, i) => picks[i] && (
          <div key={i} className="flex-shrink-0">
            <PlayerCard player={picks[i]!.player} size="result" />
          </div>
        ))}
      </div>
      <p className="font-label-caps text-[10px] text-outline/40 select-none -mt-3">
        grandslamlol.vercel.app
      </p>

      {/* 액션 버튼 */}
      <div className="flex flex-col md:flex-row gap-3 items-center w-full max-w-sm justify-center">
        <button
          onClick={handleCopy}
          className="w-full md:w-auto px-6 py-3 rounded border border-outline-variant bg-surface-container hover:bg-surface-variant text-on-surface font-label-caps text-label-caps flex items-center justify-center gap-2 transition-colors"
        >
          {copied ? '✓ Copied!' : 'Copy Link'}
        </button>
        <button
          onClick={onReset}
          className="w-full md:w-auto px-8 py-3 rounded bg-secondary hover:opacity-90 text-surface-container-lowest font-label-caps text-label-caps font-bold flex items-center justify-center gap-2 transition-opacity"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DraftPage() {
  const { data, loading } = useDraftData()
  const machine = useDraftMachine(data)
  const { state } = machine

  // shuffle 상태 — Reroll 클릭 시 1.2s 동안 카드 흔들기
  const [isShuffling, setIsShuffling] = useState(false)

  const handlePlayAgain = () => {
    const hasPicks = state.picks.some(Boolean)
    if (hasPicks && !window.confirm('Start over?')) return
    machine.reset()
  }

  function handleReroll() {
    setIsShuffling(true)
    machine.fullReroll()
    setTimeout(() => setIsShuffling(false), 1300)
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
        isDraftScreen ? 'md:fixed md:inset-0 md:z-10 md:min-h-0 md:overflow-hidden' : ''
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* ── 헤더 (SiteHeader 공유) ── */}
      <SiteHeader
        activePage="draft"
        fixed={false}
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
      <main className={`mx-auto px-4 py-8 w-full relative z-10 md:flex-1 md:flex md:flex-col md:justify-center ${
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
            {/* ── 모바일 ── */}
            <div className="md:hidden flex flex-col gap-5 w-full">
              <MobileSlotRow picks={state.picks} />
              <p className="text-center font-label-caps text-label-caps text-outline">
                Round {state.round + 1} / 5
              </p>
              {state.phase === 'SPIN' && (
                <p className="text-center text-on-surface animate-pulse font-label-caps text-label-caps">Spinning...</p>
              )}
              {state.phase === 'PICK' && state.spunTeam && (
                <MobilePickScreen
                  roster={machine.currentRoster}
                  pickedPlayerIds={machine.pickedPlayerIds}
                  emptyRoles={machine.emptyRoles}
                  onPick={(p) => machine.pick(p, state.spunTeam!)}
                  onReroll={handleReroll}
                  onPlayAgain={handlePlayAgain}
                  rerollLeft={state.rerollLeft}
                  spunTeam={state.spunTeam}
                  isShuffling={isShuffling}
                />
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
                  isShuffling={isShuffling}
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
    </div>
  )
}
