// scripts/tune-difficulty3.ts
// 3차 튜닝: ×0.7 난이도 상향 (NORMAL OVR90 GS 17.3% → ~12%)
// 레버: S 상향(≥40) 또는 delta 줄이기(-10 → -3~-7)
// 주의: S 감소는 강팀 win% 상승 → 오히려 쉬워짐 — 사용 안 함
// 실행: npx tsx scripts/tune-difficulty3.ts

import fs from 'fs'
import path from 'path'
import { simulate, setEloScale } from '../src/lib/sim'
import type { SimPlayer, Opponent, SimMode } from '../src/lib/sim'
import type { Grade } from '../src/lib/grade'

const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as const
const N_SWEEP  = 5_000
const N_FINAL  = 10_000

function loadBase(): any {
  return JSON.parse(fs.readFileSync(
    path.join(process.cwd(), 'public', 'data', 'opponents-2026.json'), 'utf-8'
  ))
}

// 현재 파일에 이미 delta -10 적용됨 — delta는 원본 대비 누적값
// 원본: regular 77-85 / msi 80-87 / worlds 84-88
// 현재: -10 상태. 추가 delta_adj로 조정(양수 = 상대 강화 = 어려움)
function adjust(
  base: any,
  deltaAdj: number, // 현재 파일 대비 추가 조정 (양수: 상대 강화)
  S: number
): { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] } {
  const adj = (arr: Opponent[]) =>
    arr.map(o => ({ ...o, rating: Math.round(o.rating + deltaAdj) }))
  setEloScale(S)
  return { regular: adj(base.regular), msi: adj(base.msi), worlds: adj(base.worlds) }
}

function makeTeam(ovr: number): SimPlayer[] {
  return ROLES.map(r => ({ playerId: `fixed_${r}`, role: r, ovr }))
}

function gsRate(ovr: number, opp: any, n: number): number {
  const team = makeTeam(ovr)
  let cnt = 0
  for (let i = 0; i < n; i++) {
    const seed = (i * 2_654_435_761 + 0x1234567) >>> 0
    const res = simulate(team, opp, seed, 'normal')
    if (res.grade === 'GRAND SLAM') cnt++
  }
  return (cnt / n) * 100
}

function grPlusRate(ovr: number, opp: any, n: number): number {
  const team = makeTeam(ovr)
  let cnt = 0
  for (let i = 0; i < n; i++) {
    const seed = (i * 2_654_435_761 + 0x1234567) >>> 0
    const res = simulate(team, opp, seed, 'hard')
    if (res.grade === 'GOLDEN ROAD' || res.grade === 'TRUE GOLDEN ROAD') cnt++
  }
  return (cnt / n) * 100
}

function fullDist(ovr: number, opp: any, mode: SimMode, n: number): Map<Grade, number> {
  const team = makeTeam(ovr)
  const counts = new Map<Grade, number>()
  for (let i = 0; i < n; i++) {
    const seed = (i * 2_654_435_761 + 0x1234567) >>> 0
    const res = simulate(team, opp, seed, mode)
    counts.set(res.grade, (counts.get(res.grade) ?? 0) + 1)
  }
  return counts
}

function pct(counts: Map<Grade, number>, g: Grade, n: number): string {
  return (((counts.get(g) ?? 0) / n) * 100).toFixed(1).padStart(5)
}

function main() {
  const base = loadBase()

  // ── PHASE 1: 현재값 확인 (S=40, deltaAdj=0) ──
  console.log('현재값 확인: S=40, delta=-10 (현재 파일 그대로)')
  const oppCurrent = adjust(base, 0, 40)
  const cur90 = gsRate(90, oppCurrent, N_SWEEP)
  console.log(`  OVR90 NORMAL GS = ${cur90.toFixed(1)}%  (목표 ~12%)`)

  // ── PHASE 2: 레버 A — S 상향 (delta 고정 -10) ──
  console.log('\n[레버 A] S 상향 (현재 -10 delta 유지)')
  console.log('S    | OVR80 GS% | OVR85 GS% | OVR90 GS%')
  console.log('-----+-----------+-----------+-----------')
  for (const S of [40, 45, 50, 55, 60]) {
    const opp = adjust(base, 0, S)
    const r80 = gsRate(80, opp, N_SWEEP)
    const r85 = gsRate(85, opp, N_SWEEP)
    const r90 = gsRate(90, opp, N_SWEEP)
    const mark = Math.abs(r90 - 12) <= 2 ? ' ★' : Math.abs(r90 - 12) <= 4 ? ' ·' : ''
    console.log(
      `S=${String(S).padEnd(3)} | ${r80.toFixed(1).padStart(8)}% | ${r85.toFixed(1).padStart(8)}% | ${r90.toFixed(1).padStart(8)}%${mark}`
    )
  }

  // ── PHASE 3: 레버 B — 상대 강화 (S=40 고정) ──
  // deltaAdj > 0 = 상대 레이팅 ↑ (어려움)
  console.log('\n[레버 B] 상대 레이팅 강화 (S=40 고정)')
  console.log('현재 delta=-10, +N은 그 위에 추가 강화')
  console.log('deltaAdj | 실효delta | OVR80 GS% | OVR85 GS% | OVR90 GS%')
  console.log('---------+-----------+-----------+-----------+-----------')
  for (const dAdj of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const opp = adjust(base, dAdj, 40)
    const r80 = gsRate(80, opp, N_SWEEP)
    const r85 = gsRate(85, opp, N_SWEEP)
    const r90 = gsRate(90, opp, N_SWEEP)
    const eff = -10 + dAdj
    const mark = Math.abs(r90 - 12) <= 2 ? ' ★' : Math.abs(r90 - 12) <= 4 ? ' ·' : ''
    console.log(
      `    +${dAdj}   |    ${String(eff).padStart(3)}    | ${r80.toFixed(1).padStart(8)}% | ${r85.toFixed(1).padStart(8)}% | ${r90.toFixed(1).padStart(8)}%${mark}`
    )
  }

  // ── PHASE 4: 조합 (S=45 × deltaAdj) ──
  console.log('\n[레버 C] 조합 S=45 × deltaAdj')
  console.log('deltaAdj | OVR90 GS%')
  console.log('---------+----------')
  for (const dAdj of [0, 1, 2, 3]) {
    const opp = adjust(base, dAdj, 45)
    const r90 = gsRate(90, opp, N_SWEEP)
    const mark = Math.abs(r90 - 12) <= 2 ? ' ★' : ''
    console.log(`    +${dAdj}   | ${r90.toFixed(1).padStart(8)}%${mark}`)
  }

  // 최적값 탐색 — OVR90 GS 12% ±2pp에서 가장 가까운 조합
  // (스윕 결과 확인 후 아래 bestS/bestDAdj에 수동 설정)
  // 여기서는 가장 근접한 후보를 자동 선택
  console.log('\n════════════ 최종 검증 (10,000회) ════════════')

  // 후보 목록에서 OVR90 목표(12%) 가장 가까운 것 자동 선택
  type Candidate = { S: number; dAdj: number; r90: number }
  const candidates: Candidate[] = []
  for (const S of [40, 45, 50, 55]) {
    for (const dAdj of [0, 1, 2, 3, 4, 5]) {
      const opp = adjust(base, dAdj, S)
      const r90 = gsRate(90, opp, 2_000)
      candidates.push({ S, dAdj, r90 })
    }
  }
  candidates.sort((a, b) => Math.abs(a.r90 - 12) - Math.abs(b.r90 - 12))
  const best = candidates[0]

  console.log(`★ 선택된 파라미터: S=${best.S}, deltaAdj=+${best.dAdj} (실효 delta=${-10 + best.dAdj})`)
  console.log(`  OVR90 GS 추정: ${best.r90.toFixed(1)}%`)
  console.log('10,000회 최종 측정 중...')

  const oppFinal = adjust(base, best.dAdj, best.S)
  setEloScale(best.S)

  const NORMAL_GRADES: Grade[] = ['GRAND SLAM', 'LEGENDARY', 'ELITE', 'CONTENDER', 'PLAYOFF TEAM', 'REBUILD']
  const HARD_GRADES: Grade[] = ['TRUE GOLDEN ROAD', 'GOLDEN ROAD', 'WORLD CHAMPION', 'LEGENDARY', 'CHALLENGER', 'ELITE', 'CONTENDER', 'PLAYOFF TEAM', 'REBUILD']

  const SHORT: Partial<Record<Grade, string>> = {
    'TRUE GOLDEN ROAD': 'TRUE GR   ',
    'GOLDEN ROAD':      'GOLDEN RD ',
    'WORLD CHAMPION':   'WORLD CHMP',
    'GRAND SLAM':       'GRAND SLAM',
    'LEGENDARY':        'LEGENDARY ',
    'CHALLENGER':       'CHALLENGER',
    'ELITE':            'ELITE     ',
    'CONTENDER':        'CONTENDER ',
    'PLAYOFF TEAM':     'PLAYOFF   ',
    'REBUILD':          'REBUILD   ',
  }

  function printTable(title: string, grades: Grade[], rows: {ovr:number; counts: Map<Grade,number>}[], n: number) {
    console.log(`\n${title}`)
    const hdr = ['OVR '.padEnd(4), ...grades.map(g => (SHORT[g] ?? g).padEnd(10))].join(' | ')
    console.log(hdr)
    console.log('-'.repeat(hdr.length))
    for (const { ovr, counts } of rows) {
      const row = [String(ovr).padEnd(4), ...grades.map(g => pct(counts, g, n) + '%')].join(' | ')
      console.log(row)
    }
  }

  const nRows: {ovr:number; counts: Map<Grade,number>}[] = []
  const hRows: {ovr:number; counts: Map<Grade,number>}[] = []

  for (const ovr of [80, 85, 90]) {
    process.stdout.write(`  OVR ${ovr} NORMAL ...`)
    nRows.push({ ovr, counts: fullDist(ovr, oppFinal, 'normal', N_FINAL) })
    process.stdout.write(' HARD ...')
    hRows.push({ ovr, counts: fullDist(ovr, oppFinal, 'hard', N_FINAL) })
    process.stdout.write(' 완료\n')
  }

  printTable('[NORMAL 최종]', NORMAL_GRADES, nRows, N_FINAL)
  printTable('[HARD 최종]', HARD_GRADES, hRows, N_FINAL)

  console.log('\n[최고등급 요약]')
  console.log('NORMAL GS:')
  for (const { ovr, counts } of nRows) {
    const v = ((counts.get('GRAND SLAM') ?? 0) / N_FINAL * 100)
    const t = { 80: 0.5, 85: 3.4, 90: 12.1 }[ovr]!
    console.log(`  OVR ${ovr}: ${v.toFixed(1)}%  (목표 ~${t}%)  ${Math.abs(v-t)<=2?'✓':Math.abs(v-t)<=4?'△':'✗'}`)
  }
  console.log('HARD GR+:')
  for (const { ovr, counts } of hRows) {
    const tgr = counts.get('TRUE GOLDEN ROAD') ?? 0
    const gr  = counts.get('GOLDEN ROAD') ?? 0
    const v = (tgr + gr) / N_FINAL * 100
    const t = { 80: 0.1, 85: 1.0, 90: 6.2 }[ovr]!
    console.log(`  OVR ${ovr}: ${v.toFixed(1)}%  (목표 ~${t}%)  ${Math.abs(v-t)<=2?'✓':Math.abs(v-t)<=4?'△':'✗'}`)
  }

  const effDelta = -10 + best.dAdj
  console.log('\n[채택 시 적용 방법]')
  console.log(`  sim.ts _eloScale: 40 → ${best.S}`)
  console.log(`  opponents-2026.json 레이팅 조정: 현재 대비 +${best.dAdj} (실효 원본 대비 ${effDelta})`)
  console.log(`    regular:  현재 67-75 → ${67+best.dAdj}-${75+best.dAdj}`)
  console.log(`    msi:      현재 70-77 → ${70+best.dAdj}-${77+best.dAdj}`)
  console.log(`    worlds:   현재 74-78 → ${74+best.dAdj}-${78+best.dAdj}`)
}

main()
