// §7.4 Grade table — §9 컷 (S=20 / intl cap=86, 2026-06 v3)
// 트로피·월즈 성과 → 상위 등급 / 트로피 REBUILD만 정규시즌 순위로 구제

export type Grade =
  | 'GRAND SLAM'
  | 'LEGENDARY'
  | 'ELITE'
  | 'CONTENDER'
  | 'PLAYOFF TEAM'
  | 'REBUILD'
  | 'GOLDEN ROAD'       // HARD: 6관왕 (EWC 제외)
  | 'TRUE GOLDEN ROAD'  // HARD: 7관왕 (완전 정복)
  | 'WORLD KING'        // HARD: Worlds 우승 + 추가 국제전 우승
  | 'CHALLENGER'        // HARD: 비Worlds 국제전 결승 이상 (FS/EWC)

export type Trophy =
  | 'SPLIT1' | 'MSI' | 'SPLIT2' | 'WORLDS'          // NORMAL
  | 'LCK_CUP' | 'FIRST_STAND' | 'REGULAR_1' | 'EWC' | 'REGULAR_2'  // HARD

const GRADE_ORD: Record<Grade, number> = {
  REBUILD: 0,
  'PLAYOFF TEAM': 1,
  CONTENDER: 2,
  ELITE: 3,
  CHALLENGER: 4,
  LEGENDARY: 5,
  'WORLD KING': 6,
  'GRAND SLAM': 7,
  'GOLDEN ROAD': 8,
  'TRUE GOLDEN ROAD': 9,
}

// 몬테카를로 그리디 목표: GS 3~8% | LEG+EL 15~20% | CONT 20~25% | REB ≤25%
// GRAND SLAM = PRD/GAME_SPEC: 스프링+MSI+서머+Worlds 4관왕 (완화 컷 없음)
export const GRADE_CUT = {
  grandSlamAllFour: true,
  legendaryWorldsTop: 4,
  eliteMsiRun: true,
  eliteMsiRunTopRank: 6,
  eliteWorldsTop: 8,
  contenderWorldsTop: 16,
  rescueContenderRank: 6,
  rescuePlayoffRank: 8,
} as const

export function determineGrade(trophies: Trophy[]): Grade {
  return gradeWithWorldsAndPlayoff({
    trophies,
    worldsBest: null,
    reachedPlayoff: false,
    reachedWorlds: false,
  })
}

function trophyGrade(params: {
  trophies: Trophy[]
  worldsBest: number | null
  reachedPlayoff: boolean
  reachedWorlds: boolean
  msiParticipated: boolean
  bestRegularRank: number
}): Grade {
  const { trophies, worldsBest, reachedPlayoff, reachedWorlds, msiParticipated, bestRegularRank } = params
  const has = (t: Trophy) => trophies.includes(t)
  const nationalWins = [has('SPLIT1'), has('SPLIT2')].filter(Boolean).length
  const C = GRADE_CUT

  if (C.grandSlamAllFour && has('SPLIT1') && has('SPLIT2') && has('MSI') && has('WORLDS')) {
    return 'GRAND SLAM'
  }

  if (has('WORLDS')) return 'LEGENDARY'
  if (worldsBest !== null && worldsBest <= C.legendaryWorldsTop) return 'LEGENDARY'

  if (has('MSI')) return 'ELITE'
  if (nationalWins >= 2) return 'ELITE'
  if (C.eliteMsiRun && msiParticipated) return 'ELITE'
  if (nationalWins >= 1 && worldsBest !== null && worldsBest <= C.eliteWorldsTop) return 'ELITE'

  if (nationalWins >= 1) return 'CONTENDER'
  if (worldsBest !== null && worldsBest <= C.contenderWorldsTop) return 'CONTENDER'
  if (msiParticipated && bestRegularRank <= C.eliteMsiRunTopRank) return 'CONTENDER'
  if (reachedPlayoff && bestRegularRank <= 4) return 'CONTENDER'

  if (reachedPlayoff || reachedWorlds) return 'PLAYOFF TEAM'

  return 'REBUILD'
}

function rebuildRescue(grade: Grade, bestRegularRank: number): Grade {
  if (grade !== 'REBUILD') return grade
  const C = GRADE_CUT
  if (bestRegularRank <= C.rescueContenderRank) return 'CONTENDER'
  if (bestRegularRank <= C.rescuePlayoffRank) return 'PLAYOFF TEAM'
  return 'REBUILD'
}

export function gradeWithWorldsAndPlayoff(params: {
  trophies: Trophy[]
  worldsBest: number | null
  reachedPlayoff: boolean
  reachedWorlds: boolean
  bestRegularRank?: number
  msiParticipated?: boolean
}): Grade {
  const {
    trophies,
    worldsBest,
    reachedPlayoff,
    reachedWorlds,
    bestRegularRank = 10,
    msiParticipated = false,
  } = params

  const base = trophyGrade({
    trophies,
    worldsBest,
    reachedPlayoff,
    reachedWorlds,
    msiParticipated,
    bestRegularRank,
  })

  return rebuildRescue(base, bestRegularRank)
}

// HARD 모드 전용 등급 판정 (v2 — 9단계)
// TRUE GOLDEN ROAD(7관왕) > GOLDEN ROAD(6관왕) > WORLD KING > LEGENDARY > CHALLENGER > ELITE > CONTENDER > PLAYOFF TEAM > REBUILD
export function gradeHard(params: {
  trophies: Trophy[]
  worldsBest: number | null
  reachedPlayoff: boolean
  reachedWorlds: boolean
  bestRegularRank: number
  msiQualified: boolean
  msiReachedSF?: boolean          // MSI SF 이상 진출 (4강+) — ELITE 판정용
  intlNonWorldsFinalist?: boolean // First Stand 또는 EWC 결승 이상 진출 — CHALLENGER 판정용
}): Grade {
  const {
    trophies, worldsBest, reachedPlayoff, reachedWorlds,
    bestRegularRank, msiQualified,
    msiReachedSF = false,
    intlNonWorldsFinalist = false,
  } = params
  const has = (t: Trophy) => trophies.includes(t)

  // ── 7관왕 / 6관왕 ─────────────────────────────────────────────
  const SIX_PACK: Trophy[] = ['LCK_CUP', 'FIRST_STAND', 'REGULAR_1', 'MSI', 'REGULAR_2', 'WORLDS']
  if (SIX_PACK.every(t => has(t)) && has('EWC')) return 'TRUE GOLDEN ROAD'
  if (SIX_PACK.every(t => has(t))) return 'GOLDEN ROAD'

  // ── WORLD KING: Worlds 우승 + 추가 국제전 우승 ─────────────────
  if (has('WORLDS') && (has('FIRST_STAND') || has('MSI') || has('EWC'))) return 'WORLD KING'

  // ── LEGENDARY: Worlds 우승만 또는 Worlds 4강 ──────────────────
  if (has('WORLDS')) return 'LEGENDARY'
  if (worldsBest !== null && worldsBest <= 4) return 'LEGENDARY'

  // ── CHALLENGER: 비Worlds 국제전 우승(FS/MSI/EWC) 또는 FS/EWC 결승 진출 ─
  // ELITE보다 상위 등급이므로 먼저 체크 (MSI 우승이 ELITE로 떨어지는 버그 방지)
  const intlNonWorldsWin = has('FIRST_STAND') || has('MSI') || has('EWC')
  if (intlNonWorldsWin) return 'CHALLENGER'
  if (intlNonWorldsFinalist) return 'CHALLENGER'  // FS/EWC 결승 진출 (우승 없이)

  // ── ELITE: MSI SF(4강)+ 또는 국내 우승 ────────────────────────
  // msiQualified만으로는 ELITE 부여 안 함 (양극화 원인 제거)
  // msiReachedSF: MSI SF/Finals 탈락 케이스만 (우승은 위 CHALLENGER 처리)
  const natWins = (['LCK_CUP', 'REGULAR_1', 'REGULAR_2'] as Trophy[]).filter(t => has(t)).length
  if (msiReachedSF) return 'ELITE'
  if (natWins >= 1) return 'ELITE'

  // ── CONTENDER: Worlds 8강 또는 MSI 진출 상위권 ────────────────
  if (worldsBest !== null && worldsBest <= 8) return 'CONTENDER'
  if (msiQualified && bestRegularRank <= GRADE_CUT.eliteMsiRunTopRank) return 'CONTENDER'
  if (reachedPlayoff && bestRegularRank <= 4) return 'CONTENDER'

  if (reachedPlayoff || reachedWorlds) return 'PLAYOFF TEAM'

  return rebuildRescue('REBUILD', bestRegularRank)
}
