// scripts/measure-difficulty.ts
// NORMAL vs HARD 난이도 비교 — 측정 전용 (sim.ts/grade.ts 수정 없음)
// 실행: npx tsx scripts/measure-difficulty.ts

import fs from 'fs'
import path from 'path'
import { simulate } from '../src/lib/sim'
import type { SimPlayer, Opponent, SimMode } from '../src/lib/sim'
import type { Grade } from '../src/lib/grade'

const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as const

const NORMAL_GRADE_ORDER: Grade[] = [
  'GRAND SLAM', 'LEGENDARY', 'ELITE', 'CONTENDER', 'PLAYOFF TEAM', 'REBUILD',
]
const HARD_GRADE_ORDER: Grade[] = [
  'TRUE GOLDEN ROAD', 'GOLDEN ROAD', 'WORLD CHAMPION', 'LEGENDARY', 'CHALLENGER', 'ELITE', 'CONTENDER', 'PLAYOFF TEAM', 'REBUILD',
]

function loadOpponents(): { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] } {
  const p = path.join(process.cwd(), 'public', 'data', 'opponents-2026.json')
  if (!fs.existsSync(p)) {
    console.error('opponents-2026.json 없음')
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

// 전원 동일 OVR 팀 — calcTeamOvr = ovr × (가중치합 5.0) / 5 = ovr (정확히 일치)
function makeFixedTeam(ovr: number): SimPlayer[] {
  return ROLES.map(r => ({ playerId: `fixed_${r}`, role: r, ovr }))
}

function runSimulations(
  team: SimPlayer[],
  opponents: { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] },
  mode: SimMode,
  n: number
): Map<Grade, number> {
  const counts = new Map<Grade, number>()
  for (let i = 0; i < n; i++) {
    const seed = (i * 2_654_435_761 + 0x1234567) >>> 0
    const result = simulate(team, opponents, seed, mode)
    counts.set(result.grade, (counts.get(result.grade) ?? 0) + 1)
  }
  return counts
}

function pct(counts: Map<Grade, number>, grade: Grade, n: number): string {
  return (((counts.get(grade) ?? 0) / n) * 100).toFixed(1).padStart(6)
}

// 헤더 약칭 매핑
const SHORT: Partial<Record<Grade, string>> = {
  'TRUE GOLDEN ROAD': 'TRUE GR   ',
  'GOLDEN ROAD':      'GOLDEN RD ',
  'WORLD CHAMPION':       'WORLD CHAMPION',
  'GRAND SLAM':       'GRAND SLAM',
  'LEGENDARY':        'LEGENDARY ',
  'CHALLENGER':       'CHALLENGER',
  'ELITE':            'ELITE     ',
  'CONTENDER':        'CONTENDER ',
  'PLAYOFF TEAM':     'PLAYOFF   ',
  'REBUILD':          'REBUILD   ',
}

function printTable(
  title: string,
  grades: Grade[],
  rows: { ovr: number; counts: Map<Grade, number> }[],
  n: number
) {
  console.log(`\n${title}`)
  const hdr = ['OVR'.padEnd(4), ...grades.map(g => (SHORT[g] ?? g).padEnd(10))].join(' | ')
  console.log(hdr)
  console.log('-'.repeat(hdr.length))
  for (const { ovr, counts } of rows) {
    const row = [
      String(ovr).padEnd(4),
      ...grades.map(g => pct(counts, g, n) + '%'),
    ].join(' | ')
    console.log(row)
  }
}

function main() {
  const opponents = loadOpponents()
  const N = 10_000
  const OVR_LIST = [80, 85, 90]

  console.log(`NORMAL vs HARD 난이도 비교 — 각 OVR × 모드 × ${N.toLocaleString()}회 시뮬`)
  console.log(`팀 구성: 전원 동일 OVR (teamOvr = 입력 OVR과 동일)`)
  console.log(`opponents: public/data/opponents-2026.json 현행 값 그대로 사용`)
  console.log('')

  const normalRows: { ovr: number; counts: Map<Grade, number> }[] = []
  const hardRows:   { ovr: number; counts: Map<Grade, number> }[] = []

  for (const ovr of OVR_LIST) {
    const team = makeFixedTeam(ovr)

    process.stdout.write(`  OVR ${ovr} NORMAL ...`)
    normalRows.push({ ovr, counts: runSimulations(team, opponents, 'normal', N) })
    process.stdout.write(' 완료\n')

    process.stdout.write(`  OVR ${ovr} HARD   ...`)
    hardRows.push({ ovr, counts: runSimulations(team, opponents, 'hard', N) })
    process.stdout.write(' 완료\n')
  }

  printTable('[NORMAL]', NORMAL_GRADE_ORDER, normalRows, N)
  printTable('[HARD]',   HARD_GRADE_ORDER,   hardRows,   N)

  // 핵심 지표
  console.log('\n[핵심 지표]')
  console.log('NORMAL 최고등급(GRAND SLAM) 도달률:')
  for (const { ovr, counts } of normalRows) {
    const gs = ((counts.get('GRAND SLAM') ?? 0) / N * 100).toFixed(1)
    console.log(`  OVR ${ovr}: ${gs}%`)
  }

  console.log('HARD 최고등급(GOLDEN ROAD+) 도달률:')
  for (const { ovr, counts } of hardRows) {
    const tgr = (counts.get('TRUE GOLDEN ROAD') ?? 0)
    const gr  = (counts.get('GOLDEN ROAD')      ?? 0)
    const sum = ((tgr + gr) / N * 100).toFixed(1)
    const tgrPct = (tgr / N * 100).toFixed(1)
    const grPct  = (gr  / N * 100).toFixed(1)
    console.log(`  OVR ${ovr}: ${sum}%  (GOLDEN ROAD ${grPct}% + TRUE GR ${tgrPct}%)`)
  }

  console.log('난이도 격차 (같은 OVR, 최고등급 %p 차이):')
  for (let i = 0; i < OVR_LIST.length; i++) {
    const ovr     = OVR_LIST[i]
    const nGs  = (normalRows[i].counts.get('GRAND SLAM')      ?? 0) / N * 100
    const hTgr = (hardRows[i].counts.get('TRUE GOLDEN ROAD')  ?? 0) / N * 100
    const hGr  = (hardRows[i].counts.get('GOLDEN ROAD')       ?? 0) / N * 100
    const hSum = hTgr + hGr
    const diff = nGs - hSum
    const dir  = diff > 0.5 ? 'HARD가 더 어려움' : diff < -0.5 ? 'NORMAL이 더 어려움' : '난이도 유사'
    console.log(
      `  OVR ${ovr}: NORMAL GS ${nGs.toFixed(1)}% vs HARD GR+ ${hSum.toFixed(1)}%` +
      ` → ${Math.abs(diff).toFixed(1)}pp 차이 (${dir})`
    )
  }
}

main()
