// scripts/tune-difficulty.ts
// NORMAL·HARD 난이도 튜닝 스윕 — 측정 전용 (sim/grade 수정 없음)
// 실행: npx tsx scripts/tune-difficulty.ts
//
// [원본값 백업]
//   S = 20  (sim.ts _eloScale 기본값)
//   opponents-2026.json regular 77-85 / msi 80-87 / worlds 84-88
//
// [목표]  OVR80=2% / OVR85=8% / OVR90=15%  (NORMAL GS)
//         OVR80=0.5% / OVR85=3% / OVR90=8%  (HARD GR+)

import fs from 'fs'
import path from 'path'
import { simulate, setEloScale } from '../src/lib/sim'
import type { SimPlayer, Opponent, SimMode } from '../src/lib/sim'
import type { Grade } from '../src/lib/grade'

const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as const
const OVR_LIST = [80, 85, 90] as const
const N_SWEEP = 2_000   // 빠른 스윕
const N_FINAL = 10_000  // 최종 검증

function loadOpponents(): { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] } {
  const p = path.join(process.cwd(), 'public', 'data', 'opponents-2026.json')
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function applyDelta(
  opponents: { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] },
  delta: number
): { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] } {
  const adj = (arr: Opponent[]) => arr.map(o => ({ ...o, rating: Math.round(o.rating + delta) }))
  return { regular: adj(opponents.regular), msi: adj(opponents.msi), worlds: adj(opponents.worlds) }
}

// HARD 전용 worlds 풀 레이팅 추가 오프셋 (HARD 단독 조절용)
function applyHardWorldsBonus(
  opponents: { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] },
  bonus: number
): { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] } {
  const adj = (arr: Opponent[]) => arr.map(o => ({ ...o, rating: Math.round(o.rating + bonus) }))
  return { ...opponents, worlds: adj(opponents.worlds), msi: adj(opponents.msi) }
}

function makeTeam(ovr: number): SimPlayer[] {
  return ROLES.map(r => ({ playerId: `fixed_${r}`, role: r, ovr }))
}

function runFixed(
  ovr: number,
  opponents: { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] },
  mode: SimMode,
  n: number
): Map<Grade, number> {
  const team = makeTeam(ovr)
  const counts = new Map<Grade, number>()
  for (let i = 0; i < n; i++) {
    const seed = (i * 2_654_435_761 + 0x1234567) >>> 0
    const res = simulate(team, opponents, seed, mode)
    counts.set(res.grade, (counts.get(res.grade) ?? 0) + 1)
  }
  return counts
}

function gsRate(counts: Map<Grade, number>, n: number): number {
  return ((counts.get('GRAND SLAM') ?? 0) / n) * 100
}

function grPlusRate(counts: Map<Grade, number>, n: number): number {
  const tgr = (counts.get('TRUE GOLDEN ROAD') ?? 0)
  const gr  = (counts.get('GOLDEN ROAD')       ?? 0)
  return ((tgr + gr) / n) * 100
}

// 목표와의 거리 (낮을수록 좋음)
const T_N = { 80: 2, 85: 8, 90: 15 }
const T_H = { 80: 0.5, 85: 3, 90: 8 }

function scoreNormal(r80: number, r85: number, r90: number): number {
  return (r80 - T_N[80]) ** 2 + (r85 - T_N[85]) ** 2 + (r90 - T_N[90]) ** 2
}

function scoreHard(r80: number, r85: number, r90: number): number {
  return (r80 - T_H[80]) ** 2 + (r85 - T_H[85]) ** 2 + (r90 - T_H[90]) ** 2
}

function p(v: number): string { return v.toFixed(1).padStart(5) }
function ok(v: number, target: number): string {
  return Math.abs(v - target) <= 2.0 ? 'OK' : '  '
}

// ─────────────────────────────────────────────────────────────────────────────
function main() {
  const base = loadOpponents()

  // ── 1단계: NORMAL 스윕 (S × delta) ─────────────────────────────────────
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('1단계: NORMAL GS% 스윕 (목표: OVR80=2% / 85=8% / 90=15%)')
  console.log('각 셀 당 2,000회 — 실행 중...')
  console.log('═══════════════════════════════════════════════════════════════')

  const S_VALUES = [20, 25, 30, 35, 40]
  const DELTAS   = [0, -3, -5, -7, -10]

  type NRow = { s: number; delta: number; n80: number; n85: number; n90: number; score: number }
  const nRows: NRow[] = []

  console.log('S   | delta | OVR80  | OVR85  | OVR90  | score')
  console.log('----+-------+--------+--------+--------+------')

  for (const s of S_VALUES) {
    setEloScale(s)
    for (const delta of DELTAS) {
      const opp = applyDelta(base, delta)
      const n80 = gsRate(runFixed(80, opp, 'normal', N_SWEEP), N_SWEEP)
      const n85 = gsRate(runFixed(85, opp, 'normal', N_SWEEP), N_SWEEP)
      const n90 = gsRate(runFixed(90, opp, 'normal', N_SWEEP), N_SWEEP)
      const score = scoreNormal(n80, n85, n90)
      nRows.push({ s, delta, n80, n85, n90, score })
      const star = score < 5 ? ' ★' : score < 15 ? ' ·' : ''
      console.log(
        `S=${String(s).padEnd(2)} | d=${String(delta).padStart(3)}  | ${p(n80)}%${ok(n80,2)} | ${p(n85)}%${ok(n85,8)} | ${p(n90)}%${ok(n90,15)} | ${score.toFixed(1)}${star}`
      )
    }
  }

  nRows.sort((a, b) => a.score - b.score)
  const bestNormal = nRows[0]
  console.log(`\n★ NORMAL 최적: S=${bestNormal.s}, delta=${bestNormal.delta}  (score=${bestNormal.score.toFixed(1)})`)
  console.log(`   OVR80=${bestNormal.n80.toFixed(1)}% (목표 2%) | 85=${bestNormal.n85.toFixed(1)}% (목표 8%) | 90=${bestNormal.n90.toFixed(1)}% (목표 15%)`)

  // ── 2단계: 최적 NORMAL 파라미터로 HARD 측정 ─────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`2단계: HARD GR+% 측정 (S=${bestNormal.s}, delta=${bestNormal.delta})`)
  console.log('═══════════════════════════════════════════════════════════════')

  setEloScale(bestNormal.s)
  const oppBest = applyDelta(base, bestNormal.delta)
  const h80 = grPlusRate(runFixed(80, oppBest, 'hard', N_SWEEP), N_SWEEP)
  const h85 = grPlusRate(runFixed(85, oppBest, 'hard', N_SWEEP), N_SWEEP)
  const h90 = grPlusRate(runFixed(90, oppBest, 'hard', N_SWEEP), N_SWEEP)
  const hardScore = scoreHard(h80, h85, h90)
  console.log(`OVR80=${h80.toFixed(1)}% (목표 0.5%) ${ok(h80,0.5)}`)
  console.log(`OVR85=${h85.toFixed(1)}% (목표 3.0%) ${ok(h85,3)}`)
  console.log(`OVR90=${h90.toFixed(1)}% (목표 8.0%) ${ok(h90,8)}`)
  console.log(`HARD score=${hardScore.toFixed(1)}`)

  // ── 3단계: HARD 전용 worlds/msi 보정 스윕 (NORMAL 파라미터 유지) ────────
  // HARD가 너무 쉬우면 worlds/msi 레이팅 상향 (bonus > 0), 너무 어려우면 하향 (bonus < 0)
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('3단계: HARD 전용 intl(worlds+msi) 보정 스윕')
  console.log('(NORMAL 파라미터 고정, HARD worlds/msi 레이팅만 조정)')
  console.log('═══════════════════════════════════════════════════════════════')

  const HARD_BONUSES = [-6, -4, -2, 0, 2, 4, 6]  // HARD worlds/msi에 추가 오프셋
  type HRow = { bonus: number; h80: number; h85: number; h90: number; score: number }
  const hRows: HRow[] = []

  console.log('bonus | OVR80  | OVR85  | OVR90  | score')
  console.log('------+--------+--------+--------+------')

  for (const bonus of HARD_BONUSES) {
    const oppH = applyHardWorldsBonus(oppBest, bonus)
    const _h80 = grPlusRate(runFixed(80, oppH, 'hard', N_SWEEP), N_SWEEP)
    const _h85 = grPlusRate(runFixed(85, oppH, 'hard', N_SWEEP), N_SWEEP)
    const _h90 = grPlusRate(runFixed(90, oppH, 'hard', N_SWEEP), N_SWEEP)
    const sc = scoreHard(_h80, _h85, _h90)
    hRows.push({ bonus, h80: _h80, h85: _h85, h90: _h90, score: sc })
    const star = sc < 5 ? ' ★' : sc < 20 ? ' ·' : ''
    console.log(
      `  ${String(bonus).padStart(3)} | ${p(_h80)}%${ok(_h80,0.5)} | ${p(_h85)}%${ok(_h85,3)} | ${p(_h90)}%${ok(_h90,8)} | ${sc.toFixed(1)}${star}`
    )
  }

  hRows.sort((a, b) => a.score - b.score)
  const bestHard = hRows[0]
  console.log(`\n★ HARD 최적 bonus: ${bestHard.bonus}  (score=${bestHard.score.toFixed(1)})`)
  console.log(`   OVR80=${bestHard.h80.toFixed(1)}% | 85=${bestHard.h85.toFixed(1)}% | 90=${bestHard.h90.toFixed(1)}%`)

  // ── 4단계: 최적 파라미터 최종 검증 (10,000회) ─────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(`4단계: 최종 검증 (10,000회)  S=${bestNormal.s} / delta=${bestNormal.delta} / hardBonus=${bestHard.bonus}`)
  console.log('═══════════════════════════════════════════════════════════════')

  setEloScale(bestNormal.s)
  const oppFinal  = applyDelta(base, bestNormal.delta)
  const oppFinalH = applyHardWorldsBonus(oppFinal, bestHard.bonus)

  const NORMAL_GRADES = ['GRAND SLAM', 'LEGENDARY', 'ELITE', 'CONTENDER', 'PLAYOFF TEAM', 'REBUILD'] as const
  const HARD_GRADES   = ['TRUE GOLDEN ROAD', 'GOLDEN ROAD', 'LEGENDARY', 'ELITE', 'CONTENDER', 'PLAYOFF TEAM', 'REBUILD'] as const

  function fullTable(
    title: string,
    grades: readonly string[],
    rows: { ovr: number; counts: Map<Grade, number> }[],
    n: number
  ) {
    console.log(`\n${title}`)
    for (const { ovr, counts } of rows) {
      const cols = grades.map(g => {
        const v = (((counts.get(g as Grade) ?? 0) / n) * 100).toFixed(1).padStart(5)
        return `${g.slice(0,10).padEnd(10)}:${v}%`
      })
      console.log(`  OVR ${ovr}: ${cols.join('  ')}`)
    }
  }

  const finalNormalRows: { ovr: number; counts: Map<Grade, number> }[] = []
  const finalHardRows:   { ovr: number; counts: Map<Grade, number> }[] = []

  for (const ovr of OVR_LIST) {
    process.stdout.write(`  OVR ${ovr} NORMAL ...`)
    finalNormalRows.push({ ovr, counts: runFixed(ovr, oppFinal, 'normal', N_FINAL) })
    process.stdout.write(' HARD ...')
    finalHardRows.push({ ovr, counts: runFixed(ovr, oppFinalH, 'hard', N_FINAL) })
    process.stdout.write(' 완료\n')
  }

  fullTable('[NORMAL 최종 분포]', NORMAL_GRADES, finalNormalRows, N_FINAL)
  fullTable('[HARD 최종 분포]',   HARD_GRADES,   finalHardRows,   N_FINAL)

  // 최고등급 수렴 요약
  console.log('\n[최종 목표 달성 여부]')
  console.log('NORMAL GS:')
  for (const { ovr, counts } of finalNormalRows) {
    const v = gsRate(counts, N_FINAL)
    const t = T_N[ovr as keyof typeof T_N]
    console.log(`  OVR ${ovr}: ${v.toFixed(1)}%  (목표 ${t}%)  ${Math.abs(v-t)<=2?'✓':Math.abs(v-t)<=4?'△':'✗'}`)
  }
  console.log('HARD GR+:')
  for (const { ovr, counts } of finalHardRows) {
    const v = grPlusRate(counts, N_FINAL)
    const t = T_H[ovr as keyof typeof T_H]
    console.log(`  OVR ${ovr}: ${v.toFixed(1)}%  (목표 ${t}%)  ${Math.abs(v-t)<=2?'✓':Math.abs(v-t)<=4?'△':'✗'}`)
  }

  // 적용 방법 출력
  console.log('\n[채택 시 적용 방법]')
  console.log(`  sim.ts  : _eloScale 기본값 ${20} → ${bestNormal.s}`)
  const finalDelta = bestNormal.delta
  console.log(`  opponents-2026.json (regular/msi/worlds 전체 레이팅 ${finalDelta}):`)
  console.log(`    regular: 77-85 → ${77+finalDelta}-${85+finalDelta}`)
  console.log(`    msi:     80-87 → ${80+finalDelta}-${87+finalDelta}`)
  console.log(`    worlds:  84-88 → ${84+finalDelta}-${88+finalDelta}`)
  if (bestHard.bonus !== 0) {
    console.log(`  opponents-2026.json (HARD 전용 worlds+msi 추가 ${bestHard.bonus}):`)
    console.log(`    → HARD 전용 풀 분리 필요 (hardMsi / hardWorlds 필드 추가)`)
  } else {
    console.log(`  HARD 전용 보정 불필요 (bonus=0)`)
  }
}

main()
