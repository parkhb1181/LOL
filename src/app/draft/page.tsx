'use client'
// §6.1 드래프트 게임 본체 — IDLE→SPIN→PICK→SIM→REVEAL→RESULT
// §13.4 데이터 플로우 주석 의무 (호빈: React 첫 경험)
// §13.5 Hydration 방어: 초기 렌더 서버와 동일 상태, mount 후 fetch
// GAME_SPEC §1: 데이터 로드 완료 즉시 자동 스핀 (IDLE 화면 skip)
// GAME_SPEC §2: 리롤 단일 버튼 (fullReroll)
// GAME_SPEC §7: RESULT 4단계 타임라인

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import PlayerCard from '@/components/PlayerCard'
import { useDraftMachine, ROLES } from '@/lib/useDraftMachine'
import type { DraftData } from '@/lib/useDraftMachine'
import { useLang } from '@/i18n'
import type { PlayerSeason } from '@/lib/data'
import type { SimStep } from '@/lib/sim'

// ── 데이터 로드 훅 ────────────────────────────────────────────────────────────
// §13.5: fetch는 mount 후에만 (SSR에서 window/fetch 불요)
function useDraftData() {
  const [data, setData] = useState<DraftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // mount 후 JSON 4종 병렬 로드
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
  }, []) // mount 1회만 — 데이터는 빌드 타임 고정

  return { data, loading, error }
}

// ── LangToggle ────────────────────────────────────────────────────────────────
function LangToggle() {
  const { lang, setLang } = useLang()
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}
      className="text-xs px-2 py-1 rounded border border-[var(--card-border,#2a2a4a)] text-[var(--card-role,#a0a0c0)] hover:text-white transition-colors"
    >
      {lang === 'en' ? 'KR' : 'EN'}
    </button>
  )
}

// ── 픽슬롯 행 ─────────────────────────────────────────────────────────────────
function RosterSlots({ picks }: { picks: (ReturnType<typeof useDraftMachine>['state']['picks'][0])[] }) {
  return (
    <div className="flex gap-2 justify-center flex-wrap">
      {ROLES.map((role, i) => {
        const pick = picks[i]
        return (
          <div key={role} className="flex flex-col items-center gap-1">
            {pick ? (
              <PlayerCard player={pick.player} size="slot" />
            ) : (
              <div className="w-20 h-28 rounded-lg border border-dashed border-[var(--card-border,#2a2a4a)] flex items-center justify-center text-[var(--card-role,#a0a0c0)] text-xs">
                {role}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── PICK 화면 — GAME_SPEC §2: 리롤 단일 버튼 ──────────────────────────────────
function PickScreen({
  roster,
  pickedPlayerIds,
  emptyRoles,
  onPick,
  onFullReroll,
  rerollLeft,
  spunTeam,
}: {
  roster: PlayerSeason[]
  pickedPlayerIds: Set<string>
  emptyRoles: string[]
  onPick: (p: PlayerSeason) => void
  onFullReroll: () => void
  rerollLeft: number
  spunTeam: { team: string; year: number } | null
}) {
  const { t } = useLang()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          {spunTeam ? `${spunTeam.team} (${spunTeam.year})` : t.pickPrompt}
        </h2>
        {/* GAME_SPEC §2: 팀 전체 재스핀 버튼 1개 */}
        <button
          onClick={onFullReroll}
          disabled={rerollLeft <= 0}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--card-border,#2a2a4a)] text-[var(--card-role,#a0a0c0)] hover:text-white hover:border-white/40 disabled:opacity-30 transition-colors"
          title="팀 전체 재스핀"
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"/>
            <path d="M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          재스핀 ({rerollLeft})
        </button>
      </div>

      {/* 로스터 그리드 — TOP→JGL→MID→ADC→SUP 순 정렬 (포지션 잠금 후 위치 고정) */}
      <div className="flex flex-wrap gap-2 justify-center">
        {[...roster]
          .sort((a, b) => ROLES.indexOf(a.role as (typeof ROLES)[number]) - ROLES.indexOf(b.role as (typeof ROLES)[number]))
          .map(p => {
            const isFilled = !emptyRoles.includes(p.role)
            const isPicked = pickedPlayerIds.has(p.playerId)
            return (
              <PlayerCard
                key={p.id}
                player={p}
                size="pick"
                disabled={isFilled || isPicked}
                onClick={() => !isFilled && !isPicked && onPick(p)}
              />
            )
          })
        }
      </div>
    </div>
  )
}

// ── REVEAL 화면 — 한 번에 핵심 하나씩 표시 ───────────────────────────────────
function RevealScreen({
  steps,
  revealStep,
  onSkip,
}: {
  steps: SimStep[]
  revealStep: number
  onSkip: () => void
}) {
  const { t } = useLang()
  const visible = steps.slice(0, revealStep)
  const current = visible[visible.length - 1]
  const past = visible.slice(0, -1)

  // 현재 step의 핵심 판정 (W/L/중립)
  function stepResult(step: SimStep): 'win' | 'lose' | 'neutral' {
    if (step.stage.endsWith('_missed') || step.stage === 'worlds_swiss_out') return 'lose'
    if (step.stage.endsWith('win') || step.stage.endsWith('_out')) return 'neutral'
    const s0 = step.series?.[0]
    if (s0) return s0.win ? 'win' : 'lose'
    return 'neutral'
  }

  const cur = current ? stepResult(current) : 'neutral'
  const isRegular = current?.stage.includes('_regular') ?? false
  const isMissed  = current?.stage.includes('_missed') || current?.stage === 'worlds_swiss_out'

  return (
    <div className="flex flex-col" style={{ minHeight: '70vh' }}>
      {/* 건너뛰기 */}
      <div className="flex justify-end mb-4">
        <button
          onClick={onSkip}
          className="text-xs px-3 py-1.5 rounded border border-white/10 text-white/30 hover:text-white/60 transition-colors"
        >
          {t.skipReveal}
        </button>
      </div>

      {/* 이전 단계 — 소형 요약 */}
      {past.length > 0 && (
        <div className="flex flex-col gap-1 mb-6 opacity-40">
          {past.map((step, i) => {
            const r = stepResult(step)
            return (
              <div key={i} className={`text-xs flex items-center gap-2 ${r === 'win' ? 'text-green-400' : r === 'lose' ? 'text-red-400' : 'text-white/50'}`}>
                <span className="w-3 text-center">{r === 'win' ? '✓' : r === 'lose' ? '✗' : '·'}</span>
                <span className="truncate">{step.label}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* 현재 단계 — 히어로 */}
      {current && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-8">
          <p className="text-[10px] tracking-[0.35em] text-white/20 uppercase">
            {current.stage.replace(/_/g, ' ')}
          </p>
          <h2 className={`text-2xl font-bold leading-snug ${
            cur === 'win'  ? 'text-green-300' :
            cur === 'lose' ? 'text-red-300' :
            isMissed       ? 'text-white/40' : 'text-white'
          }`}>
            {current.label}
          </h2>

          {/* 시리즈 결과 — 정규시즌 제외, 점수 크게 표시 */}
          {!isRegular && current.series?.[0] && (
            <div className={`text-5xl font-black mt-2 tabular-nums ${
              current.series[0].win ? 'text-green-400' : 'text-red-400'
            }`}>
              {current.series[0].score}
            </div>
          )}

          {/* 정규시즌: W/L 점 그리드 */}
          {isRegular && current.series && current.series.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center max-w-[200px] mt-2">
              {current.series.map((s, j) => (
                <div key={j} className={`w-2 h-2 rounded-full ${s.win ? 'bg-green-400' : 'bg-red-400/60'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 진행 표시 */}
      <div className="flex justify-center gap-1.5 mt-4 pb-2">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i < revealStep ? 'w-3 h-1.5 bg-white/50' : 'w-1.5 h-1.5 bg-white/15'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ── GAME_SPEC §7 — 4단계 결과 타임라인 추출 ─────────────────────────────────

type TLEntry = {
  stage: string
  status: 'win' | 'lose' | 'out'
  detail: string
}

function buildTimeline(steps: SimStep[]): TLEntry[] {
  const byStage = new Map(steps.map(s => [s.stage, s]))
  const entries: TLEntry[] = []

  // 스프링 (Split 1)
  {
    const fin = byStage.get('Split 1_final')
    const sf = byStage.get('Split 1_sf')
    const missed = byStage.get('Split 1_missed')
    if (fin) {
      const win = fin.series?.[0]?.win ?? false
      const opp = fin.series?.[0]?.opp ?? '?'
      entries.push({
        stage: '스프링',
        status: win ? 'win' : 'lose',
        detail: win ? `우승 — vs ${opp} 격파` : `준우승 — vs ${opp} 패`,
      })
    } else if (sf && !(sf.series?.[0]?.win)) {
      entries.push({
        stage: '스프링',
        status: 'lose',
        detail: `4강 탈락 — vs ${sf.series?.[0]?.opp ?? '?'}`,
      })
    } else if (missed) {
      entries.push({ stage: '스프링', status: 'out', detail: missed.label })
    }
  }

  // MSI
  {
    const win = byStage.get('msi_win')
    const out = byStage.get('msi_out')
    if (win) {
      entries.push({ stage: 'MSI', status: 'win', detail: '우승' })
    } else if (out) {
      const lastRound = byStage.get('msi_r3') ?? byStage.get('msi_r2') ?? byStage.get('msi_r1')
      const opp = lastRound?.series?.[0]?.opp ?? '?'
      const roundLabel = byStage.has('msi_r3') ? '결승' : byStage.has('msi_r2') ? '4강' : '8강'
      entries.push({ stage: 'MSI', status: 'lose', detail: `${roundLabel} 패 — vs ${opp}` })
    } else {
      entries.push({ stage: 'MSI', status: 'out', detail: '미진출' })
    }
  }

  // 서머 (Split 2)
  {
    const fin = byStage.get('Split 2_final')
    const sf = byStage.get('Split 2_sf')
    const missed = byStage.get('Split 2_missed')
    if (fin) {
      const win = fin.series?.[0]?.win ?? false
      const opp = fin.series?.[0]?.opp ?? '?'
      entries.push({
        stage: '서머',
        status: win ? 'win' : 'lose',
        detail: win ? `우승 — vs ${opp} 격파` : `준우승 — vs ${opp} 패`,
      })
    } else if (sf && !(sf.series?.[0]?.win)) {
      entries.push({
        stage: '서머',
        status: 'lose',
        detail: `4강 탈락 — vs ${sf.series?.[0]?.opp ?? '?'}`,
      })
    } else if (missed) {
      entries.push({ stage: '서머', status: 'out', detail: missed.label })
    }
  }

  // Worlds
  {
    const win = byStage.get('worlds_win')
    const fin = byStage.get('worlds_final')
    const sf = byStage.get('worlds_sf')
    const qf = byStage.get('worlds_qf')
    const swissOut = byStage.get('worlds_swiss_out')
    if (win) {
      const finOpp = fin?.series?.[0]?.opp ?? '?'
      entries.push({ stage: 'Worlds', status: 'win', detail: `우승 — vs ${finOpp} 격파` })
    } else if (fin && !(fin.series?.[0]?.win)) {
      entries.push({ stage: 'Worlds', status: 'lose', detail: `결승 패 — vs ${fin.series?.[0]?.opp ?? '?'}` })
    } else if (sf && !(sf.series?.[0]?.win)) {
      entries.push({ stage: 'Worlds', status: 'lose', detail: `4강 패 — vs ${sf.series?.[0]?.opp ?? '?'}` })
    } else if (qf && !(qf.series?.[0]?.win)) {
      entries.push({ stage: 'Worlds', status: 'lose', detail: `8강 패 — vs ${qf.series?.[0]?.opp ?? '?'}` })
    } else if (swissOut) {
      // 마지막 패배 스위스 라운드에서 상대 추출 (worlds_swiss_out 자체엔 series 없음)
      const lastSwissLoss = [5, 4, 3, 2, 1]
        .map(n => byStage.get(`worlds_swiss_r${n}`))
        .find(s => s && s.series?.[0]?.win === false)
      const swissOpp = lastSwissLoss?.series?.[0]?.opp
      const swissDetail = swissOpp ? `스위스 탈락 — vs ${swissOpp}` : swissOut.label
      entries.push({ stage: 'Worlds', status: 'lose', detail: swissDetail })
    } else {
      entries.push({ stage: 'Worlds', status: 'out', detail: '미진출' })
    }
  }

  return entries
}

// 등급별 강조 색상 (display-only)
const GRADE_COLOR: Record<string, string> = {
  'GRAND SLAM':  'text-[#ffd700]',
  'LEGENDARY':   'text-[#c080ff]',
  'ELITE':       'text-[#60c0ff]',
  'CONTENDER':   'text-[#40d4a0]',
  'PLAYOFF TEAM':'text-[#e8e8f0]',
  'REBUILD':     'text-[#6868a0]',
}

const TL_ICON: Record<TLEntry['status'], string> = {
  win: '●',
  lose: '●',
  out: '○',
}
const TL_COLOR: Record<TLEntry['status'], string> = {
  win: 'text-green-400',
  lose: 'text-red-400',
  out: 'text-white/25',
}

// 경기 상세: stage prefix → 섹션 레이블
const DETAIL_SECTIONS = [
  { prefix: 'Split 1', label: '스프링 시즌' },
  { prefix: 'msi',     label: 'MSI' },
  { prefix: 'Split 2', label: '서머 시즌' },
  { prefix: 'worlds',  label: 'Worlds' },
]

// ── RESULT 화면 — GAME_SPEC §7: 5인 카드 + 4단계 타임라인 + 등급 ──────────────
function ResultScreen({
  simResult,
  picks,
  seed,
  onReset,
}: {
  simResult: NonNullable<ReturnType<typeof useDraftMachine>['state']['simResult']>
  picks: ReturnType<typeof useDraftMachine>['state']['picks']
  seed: number
  onReset: () => void
}) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

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

  const handleShare = async () => {
    if (!navigator.share || !shareUrl) return
    await navigator.share({ url: shareUrl, title: `GRANDSLAM — ${simResult.grade}` })
  }

  const timeline = buildTimeline(simResult.steps)
  const gradeColor = GRADE_COLOR[simResult.grade] ?? 'text-white'

  // 경기 상세: 섹션별 그룹
  const detailSections = DETAIL_SECTIONS
    .map(s => ({ label: s.label, steps: simResult.steps.filter(st => st.stage.startsWith(s.prefix)) }))
    .filter(s => s.steps.length > 0)

  return (
    <div className="flex flex-col gap-8 items-center">
      {/* 트로피 뱃지 */}
      {simResult.trophies.length > 0 && (
        <div className="flex gap-2 flex-wrap justify-center">
          {simResult.trophies.map(tr => (
            <span key={tr} className="text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full border border-white/20 text-white/50">
              {tr === 'SPLIT1' ? '스프링' : tr === 'MSI' ? 'MSI' : tr === 'SPLIT2' ? '서머' : 'Worlds'}
            </span>
          ))}
        </div>
      )}

      {/* 등급 — 색상 강조 + 크게 */}
      <div className="text-center">
        <p className="text-[10px] tracking-[0.5em] text-white/20 uppercase mb-2">Season Result</p>
        <h2 className={`text-5xl font-black leading-none ${gradeColor}`}>
          {t.grade[simResult.grade as keyof typeof t.grade] ?? simResult.grade}
        </h2>
        <p className="text-white/30 text-sm mt-3">
          Team OVR {simResult.teamOvr}
        </p>
      </div>

      {/* GAME_SPEC §7: 4단계 결과 타임라인 */}
      {timeline.length > 0 && (
        <div className="w-full max-w-xs flex flex-col gap-2.5">
          {timeline.map((entry, i) => (
            <div key={i} className="flex items-baseline gap-3">
              <span className={`text-[10px] ${TL_COLOR[entry.status]} flex-shrink-0`}>{TL_ICON[entry.status]}</span>
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="text-xs font-bold text-white/70 flex-shrink-0 w-14">{entry.stage}</span>
                <span className={`text-xs truncate ${
                  entry.status === 'win'  ? 'text-green-300/80' :
                  entry.status === 'lose' ? 'text-red-300/80' :
                  'text-white/25'
                }`}>
                  {entry.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 5인 카드 — PC(md+): 1줄 flex-nowrap, 모바일: wrap */}
      <div className="flex flex-wrap md:flex-nowrap gap-2 justify-center w-full overflow-x-auto pb-1">
        {ROLES.map((_, i) => picks[i] && (
          <PlayerCard key={i} player={picks[i]!.player} size="result" />
        ))}
      </div>

      {/* 경기 상세 토글 — 섹션별 그룹화 */}
      {detailSections.length > 0 && (
        <div className="w-full max-w-sm">
          <button
            onClick={() => setShowDetail(v => !v)}
            className="w-full text-xs text-white/25 hover:text-white/50 transition-colors py-2 text-center tracking-wider"
          >
            {showDetail ? '▲ 경기 상세 접기' : '▼ 경기 상세 보기'}
          </button>
          {showDetail && (
            <div className="bg-[var(--card-bg,#1a1a2e)] rounded-xl border border-[var(--card-border,#2a2a4a)] p-4 flex flex-col gap-5 mt-1">
              {detailSections.map((section, si) => (
                <div key={si}>
                  <p className="text-[9px] tracking-[0.4em] uppercase text-white/20 mb-2">{section.label}</p>
                  {section.steps.map((step, i) => {
                    const ser = step.series
                    const isReg = step.stage.includes('_regular')
                    const noSeries = !ser || ser.length === 0

                    if (isReg && ser && ser.length > 0) {
                      const wins = ser.filter(s => s.win).length
                      return (
                        <div key={i} className="mb-3">
                          <div className="text-xs text-white/40 mb-1.5">
                            정규시즌 <span className="text-green-400/70">{wins}승</span> <span className="text-red-400/50">{ser.length - wins}패</span>
                          </div>
                          <div className="flex flex-wrap gap-0.5">
                            {ser.map((s, j) => (
                              <div key={j} className={`w-2.5 h-2.5 rounded-sm ${s.win ? 'bg-green-500/60' : 'bg-red-500/30'}`} title={`vs ${s.opp} ${s.score}`} />
                            ))}
                          </div>
                        </div>
                      )
                    }

                    if (noSeries) {
                      return (
                        <div key={i} className={`text-xs mb-1 ${step.stage.endsWith('win') ? 'text-yellow-400/60' : 'text-white/20'}`}>
                          {step.label}
                        </div>
                      )
                    }

                    // 시리즈 매치 (sf/final/knockout/MSI/Swiss)
                    return ser!.map((s, j) => {
                      // 라운드 약어: label 마지막 의미 단어
                      const words = step.label.replace(/ vs .+$/, '').split(' ')
                      const round = words[words.length - 1] ?? ''
                      return (
                        <div key={`${i}-${j}`} className={`flex items-center gap-2 text-xs mb-1.5 ${s.win ? 'text-green-400/90' : 'text-red-400/90'}`}>
                          <span className="font-mono font-bold tabular-nums min-w-[28px]">{s.score}</span>
                          <span className="text-white/25">vs</span>
                          <span className="flex-1 text-white/70 truncate">{s.opp}</span>
                          <span className="text-white/20 text-[10px] flex-shrink-0">{round}</span>
                        </div>
                      )
                    })
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-3 flex-wrap justify-center">
        <button
          onClick={handleCopy}
          className="px-5 py-2.5 rounded-lg bg-[var(--card-bg,#1a1a2e)] border border-[var(--card-border,#2a2a4a)] text-[var(--card-name,#e8e8f0)] hover:border-white/40 transition-colors text-sm"
        >
          {copied ? '복사됨!' : t.copyLink}
        </button>
        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            onClick={handleShare}
            className="px-5 py-2.5 rounded-lg bg-[var(--card-bg,#1a1a2e)] border border-[var(--card-border,#2a2a4a)] text-[var(--card-name,#e8e8f0)] hover:border-white/40 transition-colors text-sm"
          >
            {t.share}
          </button>
        )}
        <button
          onClick={onReset}
          className="px-5 py-2.5 rounded-lg bg-[var(--accent,#4a6aff)] text-white font-bold hover:opacity-90 transition-opacity text-sm"
        >
          {t.playAgain}
        </button>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export default function DraftPage() {
  const { data, loading } = useDraftData()
  const machine = useDraftMachine(data)
  const { state } = machine
  const { t } = useLang()

  // GAME_SPEC §1: 데이터 로드 완료 즉시 자동 스핀 — IDLE 화면 skip
  // 의존: data(로드 완료)와 phase(IDLE) 양쪽이 충족될 때 1회 실행
  useEffect(() => {
    if (data && state.phase === 'IDLE') {
      machine.start()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state.phase])

  // SPIN 단계: 자동으로 spinNext 호출
  // 의존: phase가 SPIN으로 전이될 때 1회 실행
  useEffect(() => {
    if (state.phase !== 'SPIN' || !data) return
    const emptyRoles = ROLES.filter((_, i) => state.picks[i] === null)
    const pickedIds = new Set(
      state.picks.filter(Boolean).map(p => p!.player.playerId)
    )
    machine.spinNext(state.round, pickedIds, emptyRoles)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.round]) // phase/round 변경 시에만 트리거

  // SIM 단계: 동기 시뮬 실행 (사실상 즉시)
  // 의존: phase가 SIM으로 전이될 때 1회 실행
  useEffect(() => {
    if (state.phase !== 'SIM') return
    machine.runSim()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase])

  // REVEAL 단계: 600ms 인터벌로 step 순차 표시
  // 의존: phase가 REVEAL일 때 interval 생성, 해제는 클린업 함수
  const revealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (state.phase !== 'REVEAL') {
      if (revealIntervalRef.current) {
        clearInterval(revealIntervalRef.current)
        revealIntervalRef.current = null
      }
      return
    }
    revealIntervalRef.current = setInterval(() => {
      machine.revealNext()
    }, 600)
    return () => {
      if (revealIntervalRef.current) clearInterval(revealIntervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]) // phase 변경 시 interval 재설정

  return (
    <div className="min-h-screen bg-[var(--page-bg,#0d0d1a)] text-white">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--card-border,#2a2a4a)]">
        <Link href="/" className="font-black text-lg tracking-tight">GRANDSLAM</Link>
        <div className="flex items-center gap-3">
          {state.phase !== 'IDLE' && (
            <RosterSlots picks={state.picks} />
          )}
          <LangToggle />
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      {/* RESULT 때 max-w-3xl로 확장 — 5인 카드(5×144px+gap=752px)를 한 줄에 담기 위해 */}
      <main className={`mx-auto px-4 py-8 ${state.phase === 'RESULT' ? 'max-w-3xl' : 'max-w-2xl'}`}>

        {/* IDLE: 로딩 중이거나 자동 스핀 대기 — 일반적으로 거의 안 보임 */}
        {state.phase === 'IDLE' && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <p className="text-[var(--card-role,#a0a0c0)] animate-pulse">
              {loading ? '로딩 중...' : '스핀 준비 중...'}
            </p>
          </div>
        )}

        {(state.phase === 'SPIN' || state.phase === 'PICK') && (
          <div className="flex flex-col gap-6">
            <p className="text-center text-sm text-[var(--card-role,#a0a0c0)]">
              {t.round(state.round + 1)} / 5
            </p>
            {state.phase === 'SPIN' && (
              <p className="text-center text-white animate-pulse">{t.spinLabel}</p>
            )}
            {state.phase === 'PICK' && state.spunTeam && (
              <PickScreen
                roster={machine.currentRoster}
                pickedPlayerIds={machine.pickedPlayerIds}
                emptyRoles={machine.emptyRoles}
                onPick={(p) => machine.pick(p, state.spunTeam!)}
                onFullReroll={machine.fullReroll}
                rerollLeft={state.rerollLeft}
                spunTeam={state.spunTeam}
              />
            )}
          </div>
        )}

        {state.phase === 'SIM' && (
          <p className="text-center text-white animate-pulse py-12">{t.simulating}</p>
        )}

        {state.phase === 'REVEAL' && state.simResult && (
          <RevealScreen
            steps={state.simResult.steps}
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

      {/* 푸터는 layout.tsx 전역 §10 */}
    </div>
  )
}
