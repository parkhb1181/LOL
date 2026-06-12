// §7.4 Grade table — §9 컷 완화 (2026-06 montecarlo iter3, S=14 / intl cap=89)
// 트로피·월즈 성과 → 상위 등급 / 트로피 REBUILD만 정규시즌 순위로 구제

export type Grade =
  | 'GRAND SLAM'
  | 'LEGENDARY'
  | 'ELITE'
  | 'CONTENDER'
  | 'PLAYOFF TEAM'
  | 'REBUILD'

export type Trophy = 'SPLIT1' | 'MSI' | 'SPLIT2' | 'WORLDS'

const GRADE_ORD: Record<Grade, number> = {
  REBUILD: 0,
  'PLAYOFF TEAM': 1,
  CONTENDER: 2,
  ELITE: 3,
  LEGENDARY: 4,
  'GRAND SLAM': 5,
}

// 몬테카를로 그리디 목표: GS 3~8% | LEG+EL 15~20% | CONT 20~25% | REB ≤25%
export const GRADE_CUT = {
  grandSlamBothSplitsIntl: true,
  grandSlamSplitMsiWorlds: true,
  grandSlamBothSplitsMsiRun: false,
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

  if (C.grandSlamBothSplitsIntl && has('SPLIT1') && has('SPLIT2') && (has('MSI') || has('WORLDS'))) {
    return 'GRAND SLAM'
  }
  if (C.grandSlamSplitMsiWorlds && nationalWins >= 1 && has('MSI') && (has('WORLDS') || (worldsBest !== null && worldsBest <= 4))) {
    return 'GRAND SLAM'
  }
  if (C.grandSlamBothSplitsMsiRun && has('SPLIT1') && has('SPLIT2') && msiParticipated) {
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
