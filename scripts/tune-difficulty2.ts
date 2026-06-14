// scripts/tune-difficulty2.ts
// 2차 스윕: 비균등 델타 (regular / msi / worlds 독립 조정)
// 목표: NORMAL OVR80=2% / 85=8% / 90=15%
// 실행: npx tsx scripts/tune-difficulty2.ts

import fs from 'fs'
import path from 'path'
import { simulate, setEloScale } from '../src/lib/sim'
import type { SimPlayer, Opponent, SimMode } from '../src/lib/sim'
import type { Grade } from '../src/lib/grade'

const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as const
const OVR_LIST = [80, 85, 90] as const
const N = 3_000

function loadOpponents(): { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] } {
  return JSON.parse(fs.readFileSync(
    path.join(process.cwd(), 'public', 'data', 'opponents-2026.json'), 'utf-8'
  ))
}

function adjustPools(
  base: { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] },
  dReg: number, dMsi: number, dWorlds: number
): { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] } {
  return {
    regular: base.regular.map(o => ({ ...o, rating: Math.round(o.rating + dReg) })),
    msi:     base.msi.map(o =>     ({ ...o, rating: Math.round(o.rating + dMsi) })),
    worlds:  base.worlds.map(o =>  ({ ...o, rating: Math.round(o.rating + dWorlds) })),
  }
}

function makeTeam(ovr: number): SimPlayer[] {
  return ROLES.map(r => ({ playerId: `fixed_${r}`, role: r, ovr }))
}

function run(ovr: number, opp: ReturnType<typeof adjustPools>, mode: SimMode): number {
  const team = makeTeam(ovr)
  let topCount = 0
  for (let i = 0; i < N; i++) {
    const seed = (i * 2_654_435_761 + 0x1234567) >>> 0
    const res = simulate(team, opp, seed, mode)
    if (mode === 'normal') {
      if (res.grade === 'GRAND SLAM') topCount++
    } else {
      if (res.grade === 'GOLDEN ROAD' || res.grade === 'TRUE GOLDEN ROAD') topCount++
    }
  }
  return (topCount / N) * 100
}

const T_N = { 80: 2, 85: 8, 90: 15 }
const T_H = { 80: 0.5, 85: 3, 90: 8 }

function score(r80: number, r85: number, r90: number, t: typeof T_N): number {
  return (r80 - t[80]) ** 2 + (r85 - t[85]) ** 2 + (r90 - t[90]) ** 2
}

function p(v: number) { return v.toFixed(1).padStart(5) }
function ok(v: number, t: number) { return Math.abs(v - t) <= 2 ? '✓' : ' ' }

type Row = {
  S: number; dReg: number; dMsi: number; dW: number
  n80: number; n85: number; n90: number; sc: number
}

function main() {
  const base = loadOpponents()

  console.log('════════════════════════════════════════════════════════════════')
  console.log('2차 스윕: 비균등 델타 × NORMAL GS% (3,000회/셀)')
  console.log('목표: OVR80=2% / OVR85=8% / OVR90=15%  (허용 ±2%p)')
  console.log('════════════════════════════════════════════════════════════════')

  const rows: Row[] = []

  // S=40 기반, regular 독립 조정 (더 강하게) vs intl (-10 유지)
  // 아이디어: domestic을 더 약하게 → OVR85 domestic 승률↑ → GS↑
  //           intl은 -10 유지 → OVR90 intl 승률 제어
  setEloScale(40)

  const configs = [
    // [dReg, dMsi, dW]  — baseline: -10/-10/-10
    [-10, -10, -10],
    [-12, -10, -10],
    [-14, -10, -10],
    [-12, -12, -10],
    [-14, -12, -10],
    [-14, -14, -10],
    [-12, -10, -8],
    [-14, -10, -8],
    [-14, -12, -8],
    [-12, -12, -8],
    [-14, -10, -6],
    [-14, -12, -6],
    [-16, -12, -8],
    [-16, -14, -10],
    [-16, -10, -8],
    // S=35 기반
    // (별도 그룹)
  ]

  console.log('S=40 — 비균등 델타 스윕')
  console.log('dReg/dMsi/dW | OVR80       OVR85       OVR90  | score')
  console.log('-------------+----------------------------+------')

  for (const [dReg, dMsi, dW] of configs) {
    const opp = adjustPools(base, dReg, dMsi, dW)
    const n80 = run(80, opp, 'normal')
    const n85 = run(85, opp, 'normal')
    const n90 = run(90, opp, 'normal')
    const sc = score(n80, n85, n90, T_N)
    const star = sc < 5 ? ' ★' : sc < 15 ? ' ·' : ''
    rows.push({ S: 40, dReg, dMsi, dW, n80, n85, n90, sc })
    console.log(
      `${String(dReg).padStart(3)}/${String(dMsi).padStart(3)}/${String(dW).padStart(3)}  | ` +
      `${p(n80)}%${ok(n80,2)}  ${p(n85)}%${ok(n85,8)}  ${p(n90)}%${ok(n90,15)} | ${sc.toFixed(1)}${star}`
    )
  }

  // S=35 추가 스윕
  console.log('\nS=35 — 비균등 델타 스윕 (OVR85↑ 목적)')
  setEloScale(35)
  const configs35 = [
    [-10, -10, -10],
    [-10, -10, -7],
    [-10, -10, -5],
    [-10, -7, -5],
    [-10, -10, -3],
    [-12, -10, -7],
    [-12, -10, -5],
    [-12, -12, -5],
    [-12, -12, -7],
    [-14, -10, -5],
    [-14, -12, -5],
  ]
  console.log('dReg/dMsi/dW | OVR80       OVR85       OVR90  | score')
  console.log('-------------+----------------------------+------')
  for (const [dReg, dMsi, dW] of configs35) {
    const opp = adjustPools(base, dReg, dMsi, dW)
    const n80 = run(80, opp, 'normal')
    const n85 = run(85, opp, 'normal')
    const n90 = run(90, opp, 'normal')
    const sc = score(n80, n85, n90, T_N)
    const star = sc < 5 ? ' ★' : sc < 15 ? ' ·' : ''
    rows.push({ S: 35, dReg, dMsi, dW, n80, n85, n90, sc })
    console.log(
      `${String(dReg).padStart(3)}/${String(dMsi).padStart(3)}/${String(dW).padStart(3)}  | ` +
      `${p(n80)}%${ok(n80,2)}  ${p(n85)}%${ok(n85,8)}  ${p(n90)}%${ok(n90,15)} | ${sc.toFixed(1)}${star}`
    )
  }

  rows.sort((a, b) => a.sc - b.sc)
  const best = rows[0]
  console.log(`\n★ 최적: S=${best.S}, reg=${best.dReg}/msi=${best.dMsi}/worlds=${best.dW}`)
  console.log(`   OVR80=${best.n80.toFixed(1)}% | 85=${best.n85.toFixed(1)}% | 90=${best.n90.toFixed(1)}%  score=${best.sc.toFixed(1)}`)

  // 최적 NORMAL 파라미터로 HARD 측정
  console.log('\n════════════════════════════════════════════════════════════════')
  console.log(`HARD 측정 (S=${best.S}, reg=${best.dReg}/msi=${best.dMsi}/worlds=${best.dW})`)
  console.log('════════════════════════════════════════════════════════════════')
  setEloScale(best.S)
  const oppBest = adjustPools(base, best.dReg, best.dMsi, best.dW)
  const h80 = run(80, oppBest, 'hard')
  const h85 = run(85, oppBest, 'hard')
  const h90 = run(90, oppBest, 'hard')
  console.log(`OVR80=${h80.toFixed(1)}%  (목표 0.5%)  ${ok(h80,0.5)}`)
  console.log(`OVR85=${h85.toFixed(1)}%  (목표 3.0%)  ${ok(h85,3)}`)
  console.log(`OVR90=${h90.toFixed(1)}%  (목표 8.0%)  ${ok(h90,8)}`)

  // 상위 5개 후보 요약
  console.log('\n[NORMAL score 상위 5개 후보]')
  for (const r of rows.slice(0, 5)) {
    console.log(
      `S=${r.S} reg=${r.dReg}/msi=${r.dMsi}/w=${r.dW}: ` +
      `80=${r.n80.toFixed(1)}% 85=${r.n85.toFixed(1)}% 90=${r.n90.toFixed(1)}% → score=${r.sc.toFixed(1)}`
    )
  }
}

main()
