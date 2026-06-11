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
import type { PlayerSeason, Opponent, OpponentsFile } from '@/lib/data'
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
          className="text-sm px-4 py-2 rounded-lg border border-[var(--card-border,#2a2a4a)] text-[var(--card-role,#a0a0c0)] hover:text-white hover:border-white/40 disabled:opacity-30 transition-colors"
          title="팀 전체 재스핀"
        >
          🎲 재스핀 ({rerollLeft})
        </button>
      </div>

      {/* 로스터 그리드 — 모바일 390px에서 가로 스크롤 없음 (flex-wrap) */}
      <div className="flex flex-wrap gap-2 justify-center">
        {roster.map(p => {
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
        })}
      </div>
    </div>
  )
}

// ── REVEAL 화면 ───────────────────────────────────────────────────────────────
function RevealScreen({
  steps,
  revealStep,
  onSkip,
  opponents,
}: {
  steps: SimStep[]
  revealStep: number
  onSkip: () => void
  opponents: OpponentsFile | null
}) {
  const { t } = useLang()
  const visibleSteps = steps.slice(0, revealStep)

  const oppMap = new Map<string, Pick<Opponent, 'label' | 'rating'>>()
  if (opponents) {
    for (const o of [...opponents.regular, ...opponents.intl]) {
      oppMap.set(o.name, { label: o.label, rating: o.rating })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          onClick={onSkip}
          className="text-sm px-4 py-1.5 rounded border border-[var(--card-border,#2a2a4a)] text-[var(--card-role,#a0a0c0)] hover:text-white transition-colors"
        >
          {t.skipReveal}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {visibleSteps.map((step, i) => (
          <div key={i} className="bg-[var(--card-bg,#1a1a2e)] rounded-lg p-3 border border-[var(--card-border,#2a2a4a)]">
            <p className="text-sm text-[var(--card-name,#e8e8f0)] font-medium">{step.label}</p>
            {step.series && (
              <div className="flex flex-wrap gap-2 mt-1">
                {step.series.map((s, j) => {
                  const meta = oppMap.get(s.opp)
                  const display = s.win
                    ? `vs ${s.opp} ${s.score}`
                    : `vs ${meta?.label ?? s.opp} (${meta?.rating ?? '?'}) — 패`
                  return (
                    <span key={j} className={`text-xs px-2 py-0.5 rounded-full ${s.win ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                      {display}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
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

const TL_ICON: Record<TLEntry['status'], string> = {
  win: '🟢',
  lose: '🔴',
  out: '⚪',
}

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
  // 경기 상세 접이식 토글 — 기본 접힘
  const [showDetail, setShowDetail] = useState(false)

  // 공유 URL 조립 — §8.1 형식: /r?p=id1.id2...&s=seed
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

  return (
    <div className="flex flex-col gap-6 items-center">
      {/* 등급 */}
      <div className="text-center">
        <p className="text-sm text-[var(--card-role,#a0a0c0)] uppercase tracking-widest">Result</p>
        <h2 className="text-4xl font-black text-white mt-1">
          {t.grade[simResult.grade as keyof typeof t.grade] ?? simResult.grade}
        </h2>
        <p className="text-[var(--card-role,#a0a0c0)] text-sm mt-1">
          {t.teamOvr}: {simResult.teamOvr}
        </p>
      </div>

      {/* GAME_SPEC §7: 4단계 결과 타임라인 */}
      {timeline.length > 0 && (
        <div className="w-full max-w-sm bg-[var(--card-bg,#1a1a2e)] rounded-xl border border-[var(--card-border,#2a2a4a)] p-4 flex flex-col gap-3">
          {timeline.map((entry, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-base leading-5 mt-0.5">{TL_ICON[entry.status]}</span>
              <div>
                <span className="text-sm font-bold text-white">{entry.stage}</span>
                <span className={`text-sm ml-2 ${
                  entry.status === 'win' ? 'text-green-300' :
                  entry.status === 'lose' ? 'text-red-300' :
                  'text-[var(--card-role,#a0a0c0)]'
                }`}>
                  {entry.detail}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 경기 상세 토글 — 영수증 철학: 왜 이 결과인지 근거 제공 */}
      {simResult.steps.some(s => s.series?.length) && (
        <div className="w-full max-w-sm">
          <button
            onClick={() => setShowDetail(v => !v)}
            className="w-full text-xs text-[var(--card-role,#a0a0c0)] hover:text-white/80 transition-colors py-2 text-center"
          >
            {showDetail ? '▲ 경기 상세 접기' : '▼ 경기 상세 보기'}
          </button>
          {showDetail && (
            <div className="bg-[var(--card-bg,#1a1a2e)] rounded-xl border border-[var(--card-border,#2a2a4a)] p-3 flex flex-col gap-2 mt-1">
              {simResult.steps
                .filter(s => s.series?.length)
                .map((step, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-[var(--card-role,#a0a0c0)] mb-0.5">{step.label}</p>
                    {step.series?.map((g, j) => (
                      <p key={j} className={`text-xs ml-3 font-mono ${g.win ? 'text-green-400' : 'text-red-400'}`}>
                        {g.win ? '승' : '패'}  {g.score}  vs {g.opp}
                      </p>
                    ))}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* 5인 카드 */}
      <div className="flex flex-wrap gap-2 justify-center">
        {ROLES.map((_, i) => picks[i] && (
          <PlayerCard key={i} player={picks[i]!.player} size="result" />
        ))}
      </div>

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
      <main className="max-w-2xl mx-auto px-4 py-8">

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
            opponents={data?.opponents ?? null}
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
