'use client'
// §6.1 Draft game body — IDLE→SPIN→PICK→SIM→REVEAL→RESULT
// §13.4 Data flow comments required (first React project)
// §13.5 Hydration guard: initial render matches server, fetch after mount
// v0 디자인 통합: stage-lighting 배경, 카드 fly/shuffle 애니메이션, v0 헤더

import { useEffect, useRef, useState } from 'react'
import PlayerCard from '@/components/PlayerCard'
import SiteHeader from '@/components/SiteHeader'
import BottomNav from '@/components/BottomNav'
import { useLang } from '@/i18n'
import { useDraftMachine, ROLES } from '@/lib/useDraftMachine'
import type { DraftData, SimMode } from '@/lib/useDraftMachine'
import type { PlayerSeason } from '@/lib/data'
import type { SimStep } from '@/lib/sim'
import { highlightRoundLabel, pickHighlightSteps, pickHardHighlights, type HighlightStep, type HardHighlight } from '@/lib/simHighlight'

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

// 모바일 상단 슬롯 카드 — 사진 위 / OVR·이름 아래 분리 레이아웃
// 텍스트가 사진을 가리지 않도록 영역 분리 (compact prop 대신 전용 컴포넌트)
function MobileSlotCard({ player }: { player: PlayerSeason }) {
  const [imgError, setImgError] = useState(false)
  const src = process.env.NEXT_PUBLIC_PHOTOS_ENABLED === 'false' ? null : (player.photo ?? null)
  const hasPhoto = !!src && !imgError
  // PlayerCard.avatarBg와 동일 로직
  const h = [...player.teamSlug].reduce((a, c) => a + c.charCodeAt(0), 0)
  const avatarColor = `hsl(${[210, 150, 30, 280, 350, 190, 60, 320][h % 8]}, 35%, 28%)`

  return (
    <div className="flex flex-col">
      {/* 사진 — 3:4 비율, 텍스트 오버레이 없음 */}
      <div className="w-full aspect-[3/4] rounded-t overflow-hidden bg-surface-container-high border border-outline-variant/30">
        {hasPhoto ? (
          <img
            src={src}
            alt={player.nameEn}
            loading="lazy"
            className="w-full h-full object-cover object-top"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-black text-white/60 text-lg"
            style={{ background: avatarColor }}
          >
            {player.nameEn.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      {/* OVR + 이름 — 사진 아래 (얼굴 비가림) */}
      <div className="bg-[#1a1a2e] rounded-b px-0.5 py-[3px] text-center">
        <div className="font-ovr-display leading-none text-[12px] text-secondary">{player.ovr}</div>
        <div className="font-heading-md text-[7px] text-on-surface/80 truncate uppercase leading-tight">{player.nameEn}</div>
      </div>
    </div>
  )
}

// 모바일 5슬롯 그리드 (grid-cols-5)
// isPickPhase: true → 비어있는 슬롯에 골드 테두리+글로우
function MobileSlotRow({ picks, isPickPhase }: {
  picks: (ReturnType<typeof useDraftMachine>['state']['picks'][0])[]
  isPickPhase: boolean
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {ROLES.map((role, i) => {
        const player = picks[i]?.player ?? null
        if (!player) {
          return (
            <div key={role} className="flex flex-col">
              {/* 빈 사진 영역 — 채워진 슬롯과 동일 3:4 비율 */}
              <div className={`w-full aspect-[3/4] rounded-t flex items-center justify-center ${
                isPickPhase
                  ? 'border border-secondary/60 bg-surface-container-lowest shadow-[0_0_8px_rgba(233,195,73,0.2)]'
                  : 'border border-dashed border-outline-variant/30 bg-[#14141c]/50'
              }`}>
                <span className={`font-label-caps text-[8px] font-bold ${isPickPhase ? 'text-secondary' : 'text-outline/50'}`}>
                  {role}
                </span>
              </div>
              {/* 텍스트 자리 확보 — MobileSlotCard 하단 바와 높이 통일 */}
              <div className="bg-[#1a1a2e] rounded-b" style={{ minHeight: '28px' }} />
            </div>
          )
        }
        return <MobileSlotCard key={role} player={player} />
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

// ── NORMAL / HARD 모드 토글 ────────────────────────────────────────────────────
function ModeToggle({ mode, onChange }: { mode: SimMode; onChange: (m: SimMode) => void }) {
  const isHard = mode === 'hard'
  return (
    <div className="flex items-center rounded border border-outline-variant overflow-hidden select-none">
      <button
        onClick={() => onChange('normal')}
        className={`px-2.5 py-1.5 font-label-caps text-[10px] uppercase transition-colors ${
          !isHard
            ? 'bg-surface-container text-on-surface'
            : 'bg-transparent text-outline hover:text-on-surface'
        }`}
      >
        NORMAL
      </button>
      <button
        onClick={() => onChange('hard')}
        className={`px-2.5 py-1.5 font-label-caps text-[10px] uppercase transition-colors ${
          isHard
            ? 'bg-red-600/80 text-white'
            : 'bg-transparent text-outline hover:text-red-400'
        }`}
      >
        HARD
      </button>
    </div>
  )
}

// ── 픽 화면 버튼 ───────────────────────────────────────────────────────────────
// layout="mobile": 전체 너비 버튼 스타일 (Stitch), layout="desktop": 기존 컴팩트 스타일
function PickButtons({
  onPlayAgain,
  onReroll,
  rerollLeft,
  mode,
  onModeChange,
  layout = 'desktop',
}: {
  onPlayAgain: () => void
  onReroll: () => void
  rerollLeft: number
  mode: SimMode
  onModeChange: (m: SimMode) => void
  layout?: 'mobile' | 'desktop'
}) {
  const { t } = useLang()
  if (layout === 'mobile') {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-row gap-2">
          <button
            onClick={onReroll}
            disabled={rerollLeft <= 0}
            className="group flex-1 py-2 border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface font-label-caps text-[11px] uppercase rounded flex items-center justify-center gap-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RerollIcon />
            {t.draft.reroll(rerollLeft)}
          </button>
          <button
            onClick={onPlayAgain}
            className="flex-1 py-2 border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container text-outline hover:text-on-surface font-label-caps text-[11px] uppercase rounded flex items-center justify-center transition-colors"
          >
            {t.draft.playAgain}
          </button>
        </div>
        {/* 토글 — PLAY AGAIN 아래 (BottomNav 겹침 방지, 버튼 줄보다 아래) */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-end">
            <ModeToggle mode={mode} onChange={onModeChange} />
          </div>
          {mode === 'hard' && (
            <p className="font-label-caps text-[9px] text-outline/40 text-right leading-relaxed">
              {t.draft.hardModeDesc}
            </p>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-row items-center gap-3 mt-2">
      <button
        onClick={onPlayAgain}
        className="font-label-caps text-label-caps py-3 px-6 rounded border border-outline-variant/50 bg-surface-container-low hover:bg-surface-bright text-outline hover:text-on-surface transition-colors"
      >
        {t.draft.playAgain}
      </button>
      <button
        onClick={onReroll}
        disabled={rerollLeft <= 0}
        className="group flex items-center gap-2 font-label-caps text-label-caps py-3 px-6 rounded bg-surface-bright hover:bg-surface-variant border border-outline-variant hover:border-secondary/50 text-on-surface transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <RerollIcon />
        {t.draft.rerollShort(rerollLeft)}
      </button>
      {/* 구분선 + 토글 — relative로 설명 텍스트 absolute 기준점 */}
      <div className="ml-1 pl-3 border-l border-outline-variant/30 relative">
        <ModeToggle mode={mode} onChange={onModeChange} />
        {/* 설명 텍스트: absolute(left: 100%)로 토글 오른쪽에 붙음 — 버튼 레이아웃에 영향 0 */}
        {mode === 'hard' && (
          <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 font-label-caps text-[9px] text-outline/40 whitespace-nowrap pointer-events-none">
            {t.draft.hardModeDesc}
          </span>
        )}
      </div>
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

  // 모바일: flex-wrap justify-center (마지막 행 중앙 정렬) / 데스크톱: flex nowrap
  const rowCls = layout === 'mobile'
    ? 'flex flex-wrap justify-center gap-2'
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
          // 모바일: w-[30%] 고정 → 3장/행 + 나머지 행 justify-center 자동 중앙
          const wrapCls = layout === 'mobile'
            ? ['w-[30%] shrink-0', shuffleCls].filter(Boolean).join(' ')
            : shuffleCls
          return (
            <div
              key={p.id}
              style={{ '--card-idx': idx } as React.CSSProperties}
              className={wrapCls}
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
  onReroll, onPlayAgain, rerollLeft, spunTeam, shufflePhase, mode, onModeChange,
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
  mode: SimMode
  onModeChange: (m: SimMode) => void
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
      <PickButtons onPlayAgain={onPlayAgain} onReroll={onReroll} rerollLeft={rerollLeft} mode={mode} onModeChange={onModeChange} layout="mobile" />
    </div>
  )
}

// ── PICK 화면 (데스크톱) ───────────────────────────────────────────────────────
function DesktopPickScreen({
  roster, pickedPlayerIds, emptyRoles, onPick,
  onReroll, onPlayAgain, rerollLeft, spunTeam, shufflePhase, mode, onModeChange,
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
  mode: SimMode
  onModeChange: (m: SimMode) => void
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
      <PickButtons onPlayAgain={onPlayAgain} onReroll={onReroll} rerollLeft={rerollLeft} mode={mode} onModeChange={onModeChange} />
    </div>
  )
}

// ── REVEAL ─────────────────────────────────────────────────────────────────────
function RevealScreen({
  highlights, revealStep, onSkip, simResult,
}: {
  highlights: HighlightStep[]
  revealStep: number
  onSkip: () => void
  simResult: ReturnType<typeof useDraftMachine>['state']['simResult']
}) {
  const { t } = useLang()

  // HARD 모드: NORMAL과 동일한 단계별 큰 중앙 텍스트 (7스테이지)
  if (simResult?.mode === 'hard') {
    const hardHighlights = pickHardHighlights(simResult.steps)
    const current = revealStep > 0 ? hardHighlights[revealStep - 1] : null
    const isWin = current?.status === 'win'
    const isDNQ = current?.status === 'dnq'

    return (
      <div className="flex flex-col items-center" style={{ minHeight: '55vh' }}>
        <div className="w-full max-w-sm flex justify-end mt-4 mb-2">
          <button
            onClick={onSkip}
            className="font-label-caps text-[10px] px-3 py-1.5 rounded border border-outline-variant text-outline hover:text-on-surface hover:border-secondary/40 transition-colors"
          >
            {t.draft.skip}
          </button>
        </div>

        {current && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center py-6 w-full max-w-sm">
            {/* 대회명 — NORMAL의 sectionShort 위치와 동일 */}
            <p className="font-label-caps text-label-caps text-outline/50 uppercase">
              {current.label}
            </p>
            {/* 결과 라운드 — NORMAL의 roundLabel 위치와 동일 */}
            <p className={`text-2xl font-black tracking-wide ${
              isWin ? 'text-on-surface' : isDNQ ? 'text-outline/40' : 'text-on-surface/60'
            }`}>
              {current.roundLabel}
            </p>
            {/* 상대 팀 (DNQ 제외) */}
            {current.opp && !isDNQ && (
              <h2 className={`text-xl font-bold leading-snug px-2 ${isWin ? 'text-green-300' : 'text-red-300'}`}>
                {isWin ? 'WIN' : 'LOSS'} vs {current.opp}
              </h2>
            )}
            {/* 스코어 */}
            {current.score && !isDNQ && (
              <div className={`text-5xl font-black tabular-nums ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                {current.score}
              </div>
            )}
            {/* DNQ 표시 */}
            {isDNQ && <span className="text-outline/40 text-sm tracking-widest">DNQ</span>}
          </div>
        )}

        {/* 진행 점 — 7개, NORMAL과 동일 스타일 */}
        <div className="flex justify-center gap-2 mt-6 pb-2">
          {hardHighlights.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i < revealStep ? 'w-8 h-2 bg-secondary/60' : 'w-2 h-2 bg-outline/20'
              }`}
            />
          ))}
        </div>
        <p className="font-label-caps text-[10px] text-outline/30 mt-2 tabular-nums">
          {Math.min(revealStep, hardHighlights.length)} / {hardHighlights.length}
        </p>
      </div>
    )
  }

  // NORMAL 모드: 기존 단일-스텝 표시 (변경 없음)
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
      <div className="w-full max-w-sm flex justify-end mt-4 mb-2">
        <button
          onClick={onSkip}
          className="font-label-caps text-[10px] px-3 py-1.5 rounded border border-outline-variant text-outline hover:text-on-surface hover:border-secondary/40 transition-colors"
        >
          {t.draft.skip}
        </button>
      </div>

      {current && step && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center py-6 w-full max-w-sm">
          <p className="font-label-caps text-label-caps text-outline/50 uppercase">
            {t.draft.sectionShort[current.section] ?? current.section}
          </p>
          <p className={`text-2xl font-black tracking-wide ${
            cur === 'win' ? 'text-on-surface' : cur === 'lose' ? 'text-on-surface/60' : 'text-outline'
          }`}>
            {(l => t.draft.roundLabel[l] ?? l)(highlightRoundLabel(current))}
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

// ── 결과 화면 아이콘 ──────────────────────────────────────────────────────────
const ListIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
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
  'GRAND SLAM':       'text-grade-grandslam',
  'LEGENDARY':        'text-grade-legendary',
  'ELITE':            'text-grade-elite',
  'CONTENDER':        'text-grade-contender',
  'PLAYOFF TEAM':     'text-on-surface',
  'REBUILD':          'text-outline',
  'TRUE GOLDEN ROAD': 'text-grade-true-golden-road',
  'GOLDEN ROAD':      'text-grade-golden-road',
  'WORLD CHAMPION':       'text-grade-world-king',
  'CHALLENGER':       'text-grade-challenger',
}

// ── 경기 상세 모달 ─────────────────────────────────────────────────────────────
// §13.4: simResult.steps 전체 표시 — 단일 시리즈(플옵/국제전)는 경기 결과 포함
// 정규시즌(series 18개)은 step.label 요약만 표시
function DetailModal({ steps, onClose }: { steps: SimStep[]; onClose: () => void }) {
  const { t } = useLang()

  // stage prefix → 섹션 번역명 (NORMAL + HARD)
  function getSection(stage: string): string {
    if (stage.startsWith('Spring_')) return t.draft.sectionShort['Spring Split'] ?? 'SPRING'
    if (stage.startsWith('msi_'))    return t.draft.sectionShort['MSI'] ?? 'MSI'
    if (stage.startsWith('Summer_')) return t.draft.sectionShort['Summer Split'] ?? 'SUMMER'
    if (stage.startsWith('worlds_')) return t.draft.sectionShort['Worlds'] ?? 'WORLDS'
    // HARD 전용
    if (stage.startsWith('LCK_CUP'))    return 'LCK CUP'
    if (stage.startsWith('first_stand')) return 'FIRST STAND'
    if (stage.startsWith('REGULAR_1'))  return 'REGULAR 1'
    if (stage.startsWith('ewc_'))       return 'EWC'
    if (stage.startsWith('REGULAR_2'))  return 'REGULAR 2'
    return '—'
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface-container rounded-t-2xl md:rounded-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30 flex-shrink-0">
          <h3 className="font-heading-md text-heading-md text-on-surface uppercase tracking-wide">
            {t.draft.detailTitle}
          </h3>
          <button
            onClick={onClose}
            className="font-label-caps text-[11px] text-outline hover:text-on-surface transition-colors px-2.5 py-1 rounded border border-outline-variant/40"
          >
            {t.draft.closeDetail}
          </button>
        </div>
        {/* 스텝 목록 */}
        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {steps.map((step, i) => {
            // series가 정확히 1개 = 플옵/국제전 단일 경기 → 상세 표시
            // series가 복수(정규시즌 18경기) = 레이블 요약만
            const singleSer = step.series?.length === 1 ? step.series[0] : undefined
            return (
              <div key={i} className="flex flex-col gap-0.5">
                <p className="font-label-caps text-[9px] text-outline/40 uppercase tracking-wider">
                  {getSection(step.stage)}
                </p>
                <p className="font-body-main text-[13px] text-on-surface-variant">
                  {step.label}
                </p>
                {singleSer && (
                  <p className={`font-body-main text-[12px] ${singleSer.win ? 'text-green-400' : 'text-red-400'}`}>
                    {singleSer.win
                      ? t.draft.matchWin(singleSer.opp, singleSer.score)
                      : t.draft.matchLoss(singleSer.opp, singleSer.score)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 모바일 결과 전용 헬퍼 ─────────────────────────────────────────────────────────────────
// 달성 단계 → 영문 라벨 (모바일 시즌 카드)
function mobileRoundLabel(h: HighlightStep): string {
  const stage = h.step.stage
  const won   = h.step.series?.[0]?.win ?? stage.endsWith('win')
  if (stage === 'Spring_missed' || stage === 'Summer_missed') return 'DNQ'
  if (stage === 'worlds_swiss_out')
    return h.step.label.includes('DNQ') ? 'DNQ' : 'SWISS ELIM'
  if (stage === 'msi_out')
    return h.step.label.includes('DNQ') ? 'DNQ' : 'ELIMINATED'
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

// 시즌 결과 개별 항목 (2x2 그리드 — 박스 없음, 텍스트만)
function MobileSeasonCard({ h, isHighlight }: { h: HighlightStep; isHighlight: boolean }) {
  const { t } = useLang()
  const roundLabel = mobileRoundLabel(h)
  const isDNQ = roundLabel === 'DNQ'
  const displayLabel = t.draft.roundLabel[roundLabel] ?? roundLabel
  const ser = h.step.series?.[0]

  return (
    <div className="flex flex-col items-center gap-px py-1">
      <span className={`font-label-caps text-[8px] uppercase ${isHighlight ? 'text-secondary' : 'text-outline/50'}`}>
        {t.draft.sectionShort[h.section] ?? h.section.toUpperCase()}
      </span>
      <span className={`font-heading-md text-[13px] leading-tight text-center ${isDNQ ? 'text-outline/40' : isHighlight ? 'text-secondary' : 'text-on-surface'}`}>
        {displayLabel}
      </span>
      {ser && !isDNQ && (
        <div className={`text-center font-body-main text-[9px] leading-snug ${ser.win ? 'text-green-400' : 'text-red-400'}`}>
          {ser.win ? t.draft.matchWin(ser.opp, ser.score) : t.draft.matchLoss(ser.opp, ser.score)}
        </div>
      )}
    </div>
  )
}

// 모바일 결과 화면 전체 레이아웃 (Stitch 모바일 디자인)
function MobileResultScreen({
  simResult, picks, onReset, onShowDetail, onCopyLink, copiedLabel,
}: {
  simResult: NonNullable<ReturnType<typeof useDraftMachine>['state']['simResult']>
  picks: ReturnType<typeof useDraftMachine>['state']['picks']
  onReset: () => void
  onShowDetail: () => void
  onCopyLink: () => void
  copiedLabel: string
}) {
  const { t } = useLang()
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
      <h1 className={`font-heading-lg text-heading-lg uppercase text-center mb-2 ${gradeColor}`}>
        {simResult.grade}
      </h1>

      {/* 시즌 결과 2x2 그리드 — 컴팩트 */}
      <div className="w-full grid grid-cols-2 gap-1.5 mb-3">
        {highlights.map(h => (
          <MobileSeasonCard
            key={h.section}
            h={h}
            isHighlight={h.section === highlightSection}
          />
        ))}
      </div>

      {/* 선수 카드 3+2 (TOP/JGL/MID → ADC/SUP) */}
      <div className="w-full flex flex-col items-center gap-2 mb-3">
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

      {/* URL 워터마크 — 카드 아래, 스샷 캡처용 */}
      <p className="font-label-caps text-[9px] text-outline/50 text-center mb-3">
        grandslamlol.vercel.app
      </p>

      {/* 버튼 영역 */}
      <div className="flex flex-col gap-2 w-full">
        <div className="flex gap-2">
          <button
            onClick={onShowDetail}
            className="flex-1 py-3.5 border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface font-label-caps text-label-caps rounded flex items-center justify-center gap-2 transition-colors"
          >
            <ListIcon />
            {t.draft.detailBtn}
          </button>
          <button
            onClick={onCopyLink}
            className="flex-1 py-3.5 border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface font-label-caps text-label-caps rounded flex items-center justify-center transition-colors"
          >
            {copiedLabel}
          </button>
        </div>
        <button
          onClick={onReset}
          className="w-full bg-secondary hover:opacity-90 text-on-secondary font-heading-md text-heading-md py-4 rounded uppercase tracking-widest transition-all active:scale-[0.98] shadow-[0_0_20px_rgba(233,195,73,0.2)]"
        >
          {t.draft.playAgain}
        </button>
        {simResult.grade === 'GRAND SLAM' && (
          <p className="font-label-caps text-[10px] text-on-surface-variant text-center">
            Grand Slam cleared! Try HARD?
          </p>
        )}
      </div>
    </div>
  )
}

// ── HARD 모드 결과 화면 ────────────────────────────────────────────────────────

// 7스테이지 타임라인 한 행 — win🟢/lose🔴/dnq⚪
function HardTimelineRow({ h }: { h: HardHighlight }) {
  const isWin = h.status === 'win'
  const isDNQ = h.status === 'dnq'
  // DNQ: 높이·불투명도 절반 (중요도 낮음)
  if (isDNQ) {
    return (
      <div className="flex items-center gap-2 py-0.5 opacity-30">
        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-outline/30" />
        <span className="w-[60px] flex-shrink-0 font-label-caps text-[9px] uppercase text-outline/50 leading-none">{h.label}</span>
        <span className="font-body-main text-[10px] text-outline/40 leading-none">DNQ</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 py-1">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isWin ? 'bg-green-400' : 'bg-red-400/70'}`} />
      <span className="w-[60px] flex-shrink-0 font-label-caps text-[9px] uppercase text-outline/60 leading-none">
        {h.label}
        {h.isBonus && (
          <span className="ml-1 inline-block px-0.5 bg-amber-400/15 text-amber-400/70 text-[7px] rounded leading-none align-middle">
            BONUS
          </span>
        )}
      </span>
      <span className={`font-body-main text-[11px] leading-none flex-shrink-0 ${isWin ? 'text-green-400' : 'text-on-surface/70'}`}>
        {h.roundLabel}
      </span>
      {h.opp && (
        <span className="font-body-main text-[10px] text-outline/50 leading-none min-w-0 truncate">
          vs {h.opp}{h.score ? ` (${h.score})` : ''}
        </span>
      )}
    </div>
  )
}

// HARD 모드 모바일 결과 화면
function HardMobileResultScreen({
  simResult, picks, onReset, onShowDetail, onCopyLink, copiedLabel,
}: {
  simResult: NonNullable<ReturnType<typeof useDraftMachine>['state']['simResult']>
  picks: ReturnType<typeof useDraftMachine>['state']['picks']
  onReset: () => void
  onShowDetail: () => void
  onCopyLink: () => void
  copiedLabel: string
}) {
  const { t } = useLang()
  const hardHighlights = pickHardHighlights(simResult.steps)
  const gradeColor = GRADE_COLOR[simResult.grade] ?? 'text-on-surface'

  return (
    <div className="flex flex-col items-center w-full pb-24">
      {/* HARD MODE 뱃지 + 등급 — 한 줄 압축 */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-label-caps text-[8px] px-1.5 py-0.5 rounded border border-outline-variant/40 text-outline/50 uppercase tracking-wider">
          HARD
        </span>
        <h1 className={`font-heading-lg text-[22px] uppercase leading-tight ${gradeColor}`}>
          {simResult.grade}
        </h1>
      </div>

      {/* 7스테이지 타임라인 (압축됨) */}
      <div className="w-full bg-surface-container-high/40 rounded-lg px-3 py-0.5 mb-2">
        {hardHighlights.map((h, i) => (
          <HardTimelineRow key={i} h={h} />
        ))}
      </div>

      {/* 선수 카드 3+2 — NORMAL 결과 카드와 동일 레이아웃 */}
      <div className="w-full flex flex-col items-center gap-2 mb-3">
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

      <p className="font-label-caps text-[8px] text-outline/40 text-center mb-2">
        grandslamlol.vercel.app
      </p>

      {/* 버튼 3개 — 압축 */}
      <div className="flex flex-col gap-2 w-full">
        <div className="flex gap-2">
          <button
            onClick={onShowDetail}
            className="flex-1 py-2.5 border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface font-label-caps text-[10px] rounded flex items-center justify-center gap-1.5 transition-colors"
          >
            <ListIcon />
            {t.draft.detailBtn}
          </button>
          <button
            onClick={onCopyLink}
            className="flex-1 py-2.5 border border-outline-variant bg-surface-container hover:bg-surface-container-high text-on-surface font-label-caps text-[10px] rounded flex items-center justify-center transition-colors"
          >
            {copiedLabel}
          </button>
        </div>
        <button
          onClick={onReset}
          className="w-full bg-secondary hover:opacity-90 text-on-secondary font-label-caps text-[10px] py-2.5 rounded uppercase tracking-widest transition-all active:scale-[0.98]"
        >
          {t.draft.playAgain}
        </button>
      </div>
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
  const { t } = useLang()
  // 상세 보기 모달 — 모바일(MobileResultScreen)과 데스크톱 공유
  const [showDetail, setShowDetail] = useState(false)
  const [copied, setCopied] = useState(false)

  const isHard = simResult.mode === 'hard'

  // §8.1 공유 URL — 클릭 시점에 window.origin 사용 (SSR 시 undefined 방지)
  // navigator.share 지원 시 OS 네이티브 공유창, 미지원 시 clipboard 폴백
  async function handleCopyLink() {
    const ids = ROLES.map((_, i) => picks[i]?.player.id ?? '').join('.')
    const mParam = isHard ? '&m=hard' : ''
    const url = `${window.location.origin}/r?p=${ids}&s=${seed}${mParam}`
    if (navigator.share) {
      try {
        await navigator.share({ url })
      } catch {
        // 취소(AbortError) 또는 지원 불가 — 조용히 무시
      }
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }
  // NORMAL 전용 하이라이트 (HARD에서는 사용 안 함)
  const highlights: HighlightStep[] = isHard ? [] : pickHighlightSteps(simResult.steps)
  const hardHighlights: HardHighlight[] = isHard ? pickHardHighlights(simResult.steps) : []
  const gradeColor = GRADE_COLOR[simResult.grade] ?? 'text-on-surface'

  // DNQ=dim / 우승=gold / 그 외=white (데스크톱 NORMAL 시즌 그리드)
  function sectionTone(h: HighlightStep): string {
    const stage = h.step.stage
    const isDNQ =
      stage === 'Spring_missed' || stage === 'Summer_missed' ||
      (stage === 'msi_out' && h.step.label.includes('DNQ')) ||
      (stage === 'worlds_swiss_out' && h.step.label.includes('DNQ'))
    if (isDNQ) return 'text-outline/50'
    const isWin =
      stage === 'msi_win' || stage === 'worlds_win' ||
      ((stage === 'Spring_final' || stage === 'Summer_final' || stage === 'worlds_final' || stage === 'msi_r3') &&
        (h.step.series?.[0]?.win ?? false))
    if (isWin) return 'text-secondary'
    return 'text-on-surface'
  }

  return (
    <div className="w-full py-4">

      {/* 경기 상세 모달 — 모바일+데스크톱 공통 */}
      {showDetail && (
        <DetailModal steps={simResult.steps} onClose={() => setShowDetail(false)} />
      )}

      {/* ── 모바일 전용 ── */}
      <div className="md:hidden">
        {isHard ? (
          <HardMobileResultScreen
            simResult={simResult}
            picks={picks}
            onReset={onReset}
            onShowDetail={() => setShowDetail(true)}
            onCopyLink={handleCopyLink}
            copiedLabel={copied ? t.draft.copied : t.draft.copyLink}
          />
        ) : (
          <MobileResultScreen
            simResult={simResult}
            picks={picks}
            onReset={onReset}
            onShowDetail={() => setShowDetail(true)}
            onCopyLink={handleCopyLink}
            copiedLabel={copied ? t.draft.copied : t.draft.copyLink}
          />
        )}
      </div>

      {/* ── 데스크톱 전용 ── */}
      <div className="hidden md:flex flex-col items-center">

        {/* 등급 헤더 */}
        <div className="text-center mb-6">
          {isHard && (
            <span className="font-label-caps text-[10px] px-2 py-0.5 rounded border border-outline-variant/40 text-outline/60 uppercase tracking-wider inline-block mb-2">
              Hard Mode
            </span>
          )}
          <p className="font-label-caps text-label-caps text-outline uppercase tracking-widest mb-2">
            {t.draft.seasonResult}
          </p>
          <h2 className={`font-ovr-display text-[72px] leading-none tracking-tighter uppercase drop-shadow-lg ${gradeColor}`}>
            {simResult.grade}
          </h2>
          <p className="font-heading-md text-heading-md text-on-surface-variant uppercase tracking-wide mt-1">
            {t.draft.teamOvr} {simResult.teamOvr}
          </p>
        </div>

        {/* 시즌 결과 — HARD: 7칸 가로 그리드(NORMAL 4칸 구조 동일) / NORMAL: 4칸 그리드 */}
        {isHard ? (
          <div className="grid grid-cols-7 gap-x-3 mb-8 w-full max-w-[1100px]">
            {hardHighlights.map((h) => {
              const isDnq = h.status === 'dnq'
              const isWin = h.status === 'win'
              return (
                <div key={h.stageKey} className={`flex flex-col gap-1 ${isDnq ? 'opacity-30' : ''}`}>
                  <span className="font-label-caps text-[9px] text-on-surface-variant uppercase tracking-wider leading-none">
                    {h.label}
                  </span>
                  {h.isBonus && (
                    <span className="inline-block px-0.5 bg-amber-400/15 text-amber-400/70 text-[7px] rounded leading-none self-start">
                      BONUS
                    </span>
                  )}
                  <span className={`font-body-main text-[13px] leading-tight ${
                    isWin ? 'text-secondary' : isDnq ? 'text-outline/40' : 'text-on-surface'
                  }`}>
                    {t.draft.roundLabel[h.roundLabel] ?? h.roundLabel}
                  </span>
                  {h.opp && (
                    <span className={`text-[11px] leading-tight truncate ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                      {isWin ? t.draft.matchWin(h.opp, h.score ?? '') : t.draft.matchLoss(h.opp, h.score ?? '')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-x-8 gap-y-3 mb-8 text-sm">
            {highlights.map(h => {
              const ser = h.step.series?.[0]
              return (
                <div key={h.section} className="flex flex-col gap-0.5">
                  <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">
                    {t.draft.sectionShort[h.section] ?? h.section}
                  </span>
                  <span className={`font-body-main text-sm ${sectionTone(h)}`}>
                    {(l => t.draft.roundLabel[l] ?? l)(highlightRoundLabel(h))}
                  </span>
                  {ser && (
                    <span className={`font-body-main text-[12px] mt-0.5 ${ser.win ? 'text-green-400' : 'text-red-400'}`}>
                      {ser.win ? t.draft.matchWin(ser.opp, ser.score) : t.draft.matchLoss(ser.opp, ser.score)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 선수 카드 가로 스크롤 (snap) */}
        <div className="w-full max-w-[1100px] flex overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4 justify-center gap-4">
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
        <div className="flex flex-row gap-3 items-center w-full max-w-lg justify-center">
          <button
            onClick={() => setShowDetail(true)}
            className="px-5 py-3 rounded border border-outline-variant bg-surface-container hover:bg-surface-bright text-on-surface font-label-caps text-label-caps flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <ListIcon />
            {t.draft.detailBtn}
          </button>
          <button
            onClick={handleCopyLink}
            className="px-5 py-3 rounded border border-outline-variant bg-surface-container hover:bg-surface-bright text-on-surface font-label-caps text-label-caps flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            {copied ? t.draft.copied : t.draft.copyLink}
          </button>
          <div className="flex-1 flex flex-col gap-1">
            <button
              onClick={onReset}
              className="w-full px-5 py-3 rounded bg-secondary hover:opacity-90 text-on-secondary font-label-caps text-label-caps font-bold flex items-center justify-center gap-2 transition-opacity whitespace-nowrap"
            >
              <ReplayIcon />
              {t.draft.playAgain}
            </button>
            {!isHard && simResult.grade === 'GRAND SLAM' && (
              <p className="font-label-caps text-[10px] text-on-surface-variant text-center">
                Grand Slam cleared! Try HARD?
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function DraftPage() {
  const { data, loading } = useDraftData()
  const { t } = useLang()
  const machine = useDraftMachine(data)
  const { state } = machine

  // 모드 토글 — component state만 (localStorage 저장 금지, CURSOR_GUIDE §6.1)
  const [mode, setMode] = useState<SimMode>('normal')

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

  // SIM phase → 동기 시뮬 실행 (1초 미만), 5번째 픽 시점의 mode를 주입
  useEffect(() => {
    if (state.phase !== 'SIM') return
    machine.runSim(mode)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  // REVEAL phase: NORMAL 1800ms / HARD 500ms 간격 순차 공개
  // state.simResult는 REVEAL 진입 시점에 이미 확정 — phase 변경 시 참조 안전
  const revealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (state.phase !== 'REVEAL') {
      if (revealIntervalRef.current) { clearInterval(revealIntervalRef.current); revealIntervalRef.current = null }
      return
    }
    const ms = state.simResult?.mode === 'hard' ? 500 : 1800
    revealIntervalRef.current = setInterval(() => { machine.revealNext() }, ms)
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
          state.phase !== 'IDLE' && !isDraftScreen && state.phase !== 'RESULT' ? (
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
              {loading ? t.draft.loading : t.draft.preparing}
            </p>
          </div>
        )}

        {/* SPIN / PICK */}
        {(state.phase === 'SPIN' || state.phase === 'PICK') && (
          <>
            {/* ── 모바일 (Stitch 디자인) ── */}
            <div className="md:hidden flex flex-col gap-4 w-full pt-5">

              {/* 5슬롯 그리드 — PICK 중 비어있는 슬롯은 골드 테두리 */}
              <MobileSlotRow picks={state.picks} isPickPhase={state.phase === 'PICK'} />

              {state.phase === 'SPIN' && (
                <p className="text-center text-on-surface animate-pulse font-label-caps text-label-caps">{t.draft.spinning}</p>
              )}

              {state.phase === 'PICK' && state.spunTeam && (
                <div className="flex flex-col gap-3">
                  {/* 팀명 + 라운드 카운터 — 같은 행 */}
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-heading-md text-heading-md text-on-surface uppercase truncate">
                      {state.spunTeam.team} ({state.spunTeam.year})
                    </h2>
                    <span className="shrink-0 font-label-caps text-label-caps text-outline bg-surface-container-high px-2 py-1 rounded">
                      {t.draft.round(state.round + 1, 5).toUpperCase()}
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
                    mode={mode}
                    onModeChange={setMode}
                  />
                </div>
              )}
            </div>

            {/* ── 데스크톱 ── */}
            <div className="hidden md:flex md:flex-col md:items-center md:gap-6 md:w-full md:flex-1 md:justify-center md:pt-8">
              {/* 상단 5슬롯 */}
              <DraftSlotRow picks={state.picks} />

              {/* Round 카운터 */}
              <p className="font-label-caps text-[10px] text-outline/60 uppercase tracking-[0.2em]">
                {t.draft.round(state.round + 1, 5)}
              </p>

              {state.phase === 'SPIN' && (
                <p className="text-center text-on-surface animate-pulse font-label-caps text-label-caps">{t.draft.spinning}</p>
              )}
              {state.phase === 'PICK' && state.spunTeam && (
                <>
                  <h2 className="font-heading-lg text-heading-lg text-on-surface uppercase text-center tracking-wide -mt-2">
                    {state.spunTeam.team}
                    <span className="text-outline/60 ml-2">({state.spunTeam.year})</span>
                  </h2>
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
                    mode={mode}
                    onModeChange={setMode}
                  />
                </>
              )}
            </div>
          </>
        )}

        {state.phase === 'SIM' && (
          <p className="text-center text-on-surface animate-pulse py-12 font-label-caps text-label-caps">{t.draft.spinning}</p>
        )}

        {state.phase === 'REVEAL' && state.simResult && (
          <RevealScreen
            highlights={pickHighlightSteps(state.simResult.steps)}
            revealStep={state.revealStep}
            onSkip={machine.revealSkip}
            simResult={state.simResult}
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
