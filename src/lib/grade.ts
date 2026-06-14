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

export type Trophy =
  | 'SPLIT1' | 'MSI' | 'SPLIT2' | 'WORLDS'          // NORMAL
  | 'LCK_CUP' | 'FIRST_STAND' | 'REGULAR_1' | 'EWC' | 'REGULAR_2'  // HARD

const GRADE_ORD: Record<Grade, number> = {
  REBUILD: 0,
  'PLAYOFF TEAM': 1,
  CONTENDER: 2,
  ELITE: 3,
  LEGENDARY: 4,
  'GRAND SLAM': 5,
  'GOLDEN ROAD': 6,
  'TRUE GOLDEN ROAD': 7,
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

// HARD 모드 전용 등급 판정
// TRUE GOLDEN ROAD(7관왕) > GOLDEN ROAD(6관왕) > 이하 NORMAL 골격 재활용
export function gradeHard(params: {
  trophies: Trophy[]
  worldsBest: number | null
  reachedPlayoff: boolean
  reachedWorlds: boolean
  bestRegularRank: number
  msiQualified: boolean
}): Grade {
  const { trophies, worldsBest, reachedPlayoff, reachedWorlds, bestRegularRank, msiQualified } = params
  const has = (t: Trophy) => trophies.includes(t)
  const C = GRADE_CUT

  const SIX_PACK: Trophy[] = ['LCK_CUP', 'FIRST_STAND', 'REGULAR_1', 'MSI', 'REGULAR_2', 'WORLDS']
  if (SIX_PACK.every(t => has(t)) && has('EWC')) return 'TRUE GOLDEN ROAD'
  if (SIX_PACK.every(t => has(t))) return 'GOLDEN ROAD'

  if (has('WORLDS')) return 'LEGENDARY'
  if (worldsBest !== null && worldsBest <= C.legendaryWorldsTop) return 'LEGENDARY'

  if (has('MSI')) return 'ELITE'
  const natWins = (['LCK_CUP', 'REGULAR_1', 'REGULAR_2'] as Trophy[]).filter(t => has(t)).length
  if (natWins >= 2) return 'ELITE'
  if (msiQualified) return 'ELITE'
  if (natWins >= 1 && worldsBest !== null && worldsBest <= C.eliteWorldsTop) return 'ELITE'

  if (natWins >= 1) return 'CONTENDER'
  if (worldsBest !== null && worldsBest <= C.contenderWorldsTop) return 'CONTENDER'
  if (msiQualified && bestRegularRank <= C.eliteMsiRunTopRank) return 'CONTENDER'
  if (reachedPlayoff && bestRegularRank <= 4) return 'CONTENDER'

  if (reachedPlayoff || reachedWorlds) return 'PLAYOFF TEAM'

  return rebuildRescue('REBUILD', bestRegularRank)
}
