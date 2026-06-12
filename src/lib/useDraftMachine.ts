'use client'
// §6.1 드래프트 상태머신 훅
// IDLE → SPIN(roundN) → PICK(roundN) → [round<5? SPIN(round+1) : SIM] → REVEAL → RESULT
// GAME_SPEC §2: 리롤은 팀 전체 1회 (fullReroll) — 팀/연도 개별 리롤 대신 단일 버튼

import { useReducer, useCallback } from 'react'
import { mulberry32 } from './prng'
import { simulate } from './sim'
import type { PlayerSeason, TeamYear } from './data'
import type { SimResult } from './sim'
import type { Opponent } from './sim'

export const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as const
export type Role = typeof ROLES[number]

// ── 상태 타입 ────────────────────────────────────────────────────────────────

export type DraftPhase =
  | 'IDLE'
  | 'SPIN'      // 현재 라운드 팀 추첨 중
  | 'PICK'      // 추첨된 팀 로스터에서 선수 선택
  | 'SIM'       // 5픽 완료 → 시뮬 실행 중 (사실상 동기라 거의 즉시)
  | 'REVEAL'    // SimResult.steps 순차 표시 중
  | 'RESULT'    // 최종 결과 화면

export type PickedPlayer = {
  player: PlayerSeason
  teamYear: TeamYear
}

export type DraftState = {
  phase: DraftPhase
  seed: number
  round: number           // 0-based (0~4)
  picks: (PickedPlayer | null)[]   // 길이 5, 순서: TOP/JGL/MID/ADC/SUP

  // SPIN 단계에서 추첨된 TeamYear
  spunTeam: TeamYear | null

  // 리롤 잔여 — GAME_SPEC §2: 팀 전체 1회 (fullReroll)
  rerollLeft: number

  // REVEAL 진행
  revealStep: number       // 현재까지 표시된 step 인덱스
  simResult: SimResult | null

  // 에러 메시지
  error: string | null
}

// ── 액션 타입 ────────────────────────────────────────────────────────────────

type Action =
  | { type: 'START'; seed: number; spunTeam: TeamYear }          // IDLE → PICK
  | { type: 'SPIN_DONE'; spunTeam: TeamYear }                    // 스핀 결과 확정 → PICK
  | { type: 'FULL_REROLL'; spunTeam: TeamYear }                  // 팀 전체 재추첨 (GAME_SPEC §2)
  | { type: 'PICK'; player: PlayerSeason; teamYear: TeamYear }   // 선수 선택 → 다음 SPIN or SIM
  | { type: 'SIM_DONE'; result: SimResult }                      // SIM → REVEAL
  | { type: 'REVEAL_NEXT' }                                      // step 1개 표시
  | { type: 'REVEAL_SKIP' }                                      // 즉시 RESULT
  | { type: 'RESET' }                                            // RESULT → IDLE

// ── 초기 상태 ────────────────────────────────────────────────────────────────

const INITIAL_STATE: DraftState = {
  phase: 'IDLE',
  seed: 0,
  round: 0,
  picks: [null, null, null, null, null],
  spunTeam: null,
  rerollLeft: 1,
  revealStep: 0,
  simResult: null,
  error: null,
}

// ── 리듀서 ──────────────────────────────────────────────────────────────────

function reducer(state: DraftState, action: Action): DraftState {
  switch (action.type) {

    // START: seed 저장, 첫 스핀 결과 수신 → PICK
    case 'START':
      return {
        ...INITIAL_STATE,
        phase: 'PICK',
        seed: action.seed,
        round: 0,
        spunTeam: action.spunTeam,
        rerollLeft: 1,
      }

    // SPIN_DONE: 라운드 시작 스핀 결과 → PICK 화면
    case 'SPIN_DONE':
      return { ...state, phase: 'PICK', spunTeam: action.spunTeam, error: null }

    // FULL_REROLL: 팀 전체 재추첨 (GAME_SPEC §2) — 팀·연도 모두 새로 뽑음
    case 'FULL_REROLL':
      return {
        ...state,
        spunTeam: action.spunTeam,
        rerollLeft: state.rerollLeft - 1,
        error: null,
      }

    // PICK: 선수 선택 → picks 배열 갱신 후 다음 라운드 or SIM
    case 'PICK': {
      const roleIdx = ROLES.indexOf(action.player.role as Role)
      const newPicks = [...state.picks]
      newPicks[roleIdx] = { player: action.player, teamYear: action.teamYear }

      const nextRound = state.round + 1
      const allFilled = newPicks.every(p => p !== null)

      return {
        ...state,
        phase: allFilled ? 'SIM' : 'SPIN',
        round: nextRound,
        picks: newPicks,
        spunTeam: null,
        error: null,
      }
    }

    // SIM_DONE: 시뮬 완료 → REVEAL 시작
    case 'SIM_DONE':
      return { ...state, phase: 'REVEAL', simResult: action.result, revealStep: 0 }

    // REVEAL_NEXT: step 1개씩 표시 (600ms 인터벌)
    case 'REVEAL_NEXT': {
      if (!state.simResult) return state
      const next = state.revealStep + 1
      if (next >= state.simResult.steps.length) {
        return { ...state, phase: 'RESULT', revealStep: next }
      }
      return { ...state, revealStep: next }
    }

    // REVEAL_SKIP: Skip 버튼 → 즉시 RESULT
    case 'REVEAL_SKIP':
      return {
        ...state,
        phase: 'RESULT',
        revealStep: state.simResult?.steps.length ?? 0,
      }

    // RESET: 다시 하기
    case 'RESET':
      return { ...INITIAL_STATE }

    default:
      return state
  }
}

// ── spin-index + 데이터 로드 타입 ────────────────────────────────────────────

export type SpinIndex = Record<Role, string[]>

export type DraftData = {
  players: PlayerSeason[]
  teams: TeamYear[]
  spinIndex: SpinIndex
  opponents: { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] }
}

// ── 가중 추첨 헬퍼 ─────────────────────────────────────────────────────────

// 같은 판에서 이미 선수를 뽑은 팀 → 이 배수로 가중치 감소 (0은 아님 — 드림팀 가능성 유지)
const REPEAT_PENALTY = 0.05

function weightedDraw(
  pool: string[],
  teamMap: Map<string, TeamYear>,
  rng: () => number,
  penalizedKeys?: Set<string>  // 이미 픽된 팀 → weight * REPEAT_PENALTY
): string {
  let total = 0
  for (const k of pool) {
    const w = teamMap.get(k)?.weight ?? 1
    total += penalizedKeys?.has(k) ? w * REPEAT_PENALTY : w
  }
  let r = rng() * total
  for (const k of pool) {
    const w = teamMap.get(k)?.weight ?? 1
    r -= penalizedKeys?.has(k) ? w * REPEAT_PENALTY : w
    if (r <= 0) return k
  }
  return pool[pool.length - 1]
}

// ── §6.1 2단 필터 스핀 풀 계산 ────────────────────────────────────────────

function buildSpinPool(
  emptyRoles: Role[],
  pickedPlayerIds: Set<string>,
  spinIndex: SpinIndex,
  teamMap: Map<string, TeamYear>,
  playersByTeam: Map<string, PlayerSeason[]>
): string[] {
  // 1단: 빈 역할 보유 TeamYear 합집합
  const base = new Set<string>()
  for (const role of emptyRoles) {
    for (const k of (spinIndex[role] ?? [])) base.add(k)
  }

  // 2단: 빈 슬롯 포지션에 미픽 선수가 있는 팀만 (소프트락 방지)
  const valid = [...base].filter(key => {
    const roster = playersByTeam.get(key) ?? []
    return roster.some(
      p => emptyRoles.includes(p.role as Role) && !pickedPlayerIds.has(p.playerId)
    )
  })

  return valid.length > 0 ? valid : [...base]
}

// ── 훅 공개 인터페이스 ────────────────────────────────────────────────────────

/**
 * useDraftMachine
 * §6.1 상태머신을 useReducer로 관리.
 * data: DraftPage가 마운트 후 fetch한 JSON 4종 (players/teams/spin-index/opponents)
 */
export function useDraftMachine(data: DraftData | null) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const teamMap = data
    ? new Map<string, TeamYear>(data.teams.map(t => [t.key, t]))
    : new Map<string, TeamYear>()

  const playersByTeam = data
    ? (() => {
        const m = new Map<string, PlayerSeason[]>()
        for (const p of data.players) {
          const k = `${p.teamSlug}_${p.year}`
          if (!m.has(k)) m.set(k, [])
          m.get(k)!.push(p)
        }
        return m
      })()
    : new Map<string, PlayerSeason[]>()

  // 라운드별 rng 인스턴스 — round × salt로 고유 시드 생성 (결정론 유지)
  const getRng = (round: number) =>
    mulberry32(((state.seed ^ (round * 0x9E3779B9)) >>> 0))

  // ── 핸들러 ─────────────────────────────────────────────────────────────

  // 시작: seed 생성 → 첫 스핀 → PICK
  const start = useCallback(() => {
    if (!data) return
    // §6.1, §13.5: 클릭 핸들러에서만 crypto 접근
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]
    const rng = mulberry32(seed)
    const emptyRoles = [...ROLES]
    const pool = buildSpinPool(emptyRoles, new Set(), data.spinIndex as SpinIndex, teamMap, playersByTeam)
    // 첫 스핀: 픽 없음 → penalty 없음
    const teamKey = weightedDraw(pool, teamMap, rng, new Set())
    const spunTeam = teamMap.get(teamKey)!
    dispatch({ type: 'START', seed, spunTeam })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // 다음 라운드 스핀 (PICK → SPIN 전이 후 즉시 호출 — useEffect에서 구동)
  const spinNext = useCallback((round: number, pickedPlayerIds: Set<string>, emptyRoles: Role[]) => {
    if (!data) return
    // 이미 픽된 팀 키 → REPEAT_PENALTY 적용
    const pickedTeamKeys = new Set(state.picks.filter(Boolean).map(p => p!.teamYear.key))
    const rng = getRng(round)
    const pool = buildSpinPool(emptyRoles, pickedPlayerIds, data.spinIndex as SpinIndex, teamMap, playersByTeam)
    const teamKey = weightedDraw(pool, teamMap, rng, pickedTeamKeys)
    const spunTeam = teamMap.get(teamKey)!
    dispatch({ type: 'SPIN_DONE', spunTeam })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state.seed, state.picks])

  // 팀 전체 재추첨 (GAME_SPEC §2) — 현재 라운드 풀에서 완전 재추첨
  const fullReroll = useCallback(() => {
    if (!data || state.rerollLeft <= 0) return
    const emptyRoles = ROLES.filter((_, i) => state.picks[i] === null)
    const pickedIds = new Set(state.picks.filter(Boolean).map(p => p!.player.playerId))
    // 이미 픽된 팀 키 → REPEAT_PENALTY 적용 (리롤도 동일)
    const pickedTeamKeys = new Set(state.picks.filter(Boolean).map(p => p!.teamYear.key))
    const rng = getRng(state.round)
    rng() // 첫 spin draw 소비 자리 스킵
    const pool = buildSpinPool(emptyRoles, pickedIds, data.spinIndex as SpinIndex, teamMap, playersByTeam)
    const teamKey = weightedDraw(pool, teamMap, rng, pickedTeamKeys)
    const spunTeam = teamMap.get(teamKey)!
    dispatch({ type: 'FULL_REROLL', spunTeam })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state.rerollLeft, state.round, state.picks, state.seed])

  // 선수 픽
  const pick = useCallback((player: PlayerSeason, teamYear: TeamYear) => {
    dispatch({ type: 'PICK', player, teamYear })
  }, [])

  // 시뮬 실행 (SIM 단계 진입 시 useEffect에서 호출)
  const runSim = useCallback(() => {
    if (!data || state.simResult) return
    const filledPicks = state.picks.filter(Boolean) as PickedPlayer[]
    if (filledPicks.length < 5) return
    const simPlayers = ROLES.map(role => {
      const p = state.picks[ROLES.indexOf(role)]!
      return { playerId: p.player.playerId, role: p.player.role as Role, ovr: p.player.ovr }
    })
    const result = simulate(simPlayers, data.opponents, state.seed)
    dispatch({ type: 'SIM_DONE', result })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, state.picks, state.seed, state.simResult])

  // REVEAL step 진행
  const revealNext = useCallback(() => dispatch({ type: 'REVEAL_NEXT' }), [])
  const revealSkip = useCallback(() => dispatch({ type: 'REVEAL_SKIP' }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  // 현재 빈 역할 목록
  const emptyRoles = ROLES.filter((_, i) => state.picks[i] === null)

  // 현재 픽된 playerId 집합
  const pickedPlayerIds = new Set(
    state.picks.filter(Boolean).map(p => p!.player.playerId)
  )

  // 현재 spunTeam 로스터 (픽 화면 표시용)
  const currentRoster: PlayerSeason[] = state.spunTeam
    ? (playersByTeam.get(state.spunTeam.key) ?? [])
    : []

  return {
    state,
    emptyRoles,
    pickedPlayerIds,
    currentRoster,
    start,
    spinNext,
    fullReroll,
    pick,
    runSim,
    revealNext,
    revealSkip,
    reset,
  }
}
