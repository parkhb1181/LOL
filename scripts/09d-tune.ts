// 09d-tune.ts — S × 상대풀 조합 최적화 테스트
// npx tsx scripts/09d-tune.ts
// S(15/18/20) × regular_avg(80/81) 6조합 × 그리디+고정팀

import fs from 'fs'
import path from 'path'
import { mulberry32 } from '../src/lib/prng'
import { simulate, setEloScale } from '../src/lib/sim'
import type { SimPlayer, Opponent, Trophy } from '../src/lib/sim'
import type { Grade } from '../src/lib/grade'
import type { TeamYear } from '../src/lib/data'

const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'] as const
type Role = typeof ROLES[number]
type PlayerEntry = { id: string; playerId: string; role: Role; ovr: number; teamKey: string; year: number }
type SpinIndex = Record<Role, string[]>

const N = 10_000
const GRADE_ORDER: Grade[] = ['GRAND SLAM', 'LEGENDARY', 'ELITE', 'CONTENDER', 'PLAYOFF TEAM', 'REBUILD']

// ── 상대 풀 정의 ─────────────────────────────────────────────────────
// MSI/Worlds는 공통 (avg MSI≈83.2, Worlds≈86.5)
const MSI_POOL: Opponent[] = [
  { name: 'FNC-21', label: 'FNC-21', league: 'EU', rating: 80 },
  { name: 'C9-18',  label: 'C9-18',  league: 'NA', rating: 81 },
  { name: 'H2K-16', label: 'H2K-16', league: 'EU', rating: 81 },
  { name: 'MSF-17', label: 'MSF-17', league: 'EU', rating: 82 },
  { name: 'G2-21',  label: 'G2-21',  league: 'EU', rating: 82 },
  { name: 'T1-21',  label: 'T1-21',  league: 'KR', rating: 83 },
  { name: 'IG-19',  label: 'IG-19',  league: 'CN', rating: 83 },
  { name: 'SSG-17', label: 'SSG-17', league: 'KR', rating: 84 },
  { name: 'TES-20', label: 'TES-20', league: 'CN', rating: 84 },
  { name: 'KZ-18',  label: 'KZ-18',  league: 'KR', rating: 85 },
  { name: 'SKT-17', label: 'SKT-17', league: 'KR', rating: 86 },
  { name: 'SKT-16', label: 'SKT-16', league: 'KR', rating: 87 },
]

const WORLDS_POOL: Opponent[] = [
  { name: 'SSG-16',  label: 'SSG-16',  league: 'KR', rating: 84 },
  { name: 'GEN-21',  label: 'GEN-21',  league: 'KR', rating: 85 },
  { name: 'LNG-23',  label: 'LNG-23',  league: 'CN', rating: 85 },
  { name: 'KT-18',   label: 'KT-18',   league: 'KR', rating: 86 },
  { name: 'DRX-22',  label: 'DRX-22',  league: 'KR', rating: 86 },
  { name: 'RNG-22',  label: 'RNG-22',  league: 'CN', rating: 87 },
  { name: 'EDG-15',  label: 'EDG-15',  league: 'CN', rating: 87 },
  { name: 'MAD-23',  label: 'MAD-23',  league: 'EU', rating: 87 },
  { name: 'T1-25',   label: 'T1-25',   league: 'KR', rating: 87 },
  { name: 'FPX-19',  label: 'FPX-19',  league: 'CN', rating: 88 },
  { name: 'T1-23',   label: 'T1-23',   league: 'KR', rating: 88 },
  { name: 'JDG-23',  label: 'JDG-23',  league: 'CN', rating: 88 },
]

// regular avg 80 (9팀: 76~84, avg=80.0)
const REG80: Opponent[] = [
  { name: 'KT-15',  label: 'KT-15',  league: 'KR', rating: 76 },
  { name: 'C9-16',  label: 'C9-16',  league: 'NA', rating: 77 },
  { name: 'MSF-17', label: 'MSF-17', league: 'EU', rating: 78 },
  { name: 'H2K-16', label: 'H2K-16', league: 'EU', rating: 79 },
  { name: 'GEN-20', label: 'GEN-20', league: 'KR', rating: 80 },
  { name: 'T1-21',  label: 'T1-21',  league: 'KR', rating: 81 },
  { name: 'EG-22',  label: 'EG-22',  league: 'NA', rating: 82 },
  { name: 'T1-25',  label: 'T1-25',  league: 'KR', rating: 83 },
  { name: 'GEN-23', label: 'GEN-23', league: 'KR', rating: 84 },
]

// regular avg 81 (9팀: 77~85, avg=81.0)
const REG81: Opponent[] = [
  { name: 'KT-15',  label: 'KT-15',  league: 'KR', rating: 77 },
  { name: 'C9-16',  label: 'C9-16',  league: 'NA', rating: 78 },
  { name: 'MSF-17', label: 'MSF-17', league: 'EU', rating: 79 },
  { name: 'H2K-16', label: 'H2K-16', league: 'EU', rating: 80 },
  { name: 'GEN-20', label: 'GEN-20', league: 'KR', rating: 81 },
  { name: 'T1-21',  label: 'T1-21',  league: 'KR', rating: 82 },
  { name: 'EG-22',  label: 'EG-22',  league: 'NA', rating: 83 },
  { name: 'T1-25',  label: 'T1-25',  league: 'KR', rating: 84 },
  { name: 'GEN-23', label: 'GEN-23', league: 'KR', rating: 85 },
]

const CONFIGS = [
  { label: 'S15+R80', s: 15, regular: REG80 },
  { label: 'S15+R81', s: 15, regular: REG81 },
  { label: 'S18+R80', s: 18, regular: REG80 },
  { label: 'S18+R81', s: 18, regular: REG81 },
  { label: 'S20+R80', s: 20, regular: REG80 },
  { label: 'S20+R81', s: 20, regular: REG81 },
]

// ── 그리디 시뮬 (09b 동일 로직) ──────────────────────────────────────
function loadData() {
  const root = path.join(process.cwd(), 'public', 'data')
  const players: { id: string; playerId: string; role: Role; ovr: number; team: string; teamSlug: string; year: number }[] =
    JSON.parse(fs.readFileSync(path.join(root, 'players.json'), 'utf-8'))
  const teams: TeamYear[] = JSON.parse(fs.readFileSync(path.join(root, 'teams.json'), 'utf-8'))
  const spinIndex: SpinIndex = JSON.parse(fs.readFileSync(path.join(root, 'spin-index.json'), 'utf-8'))
  return { players, teams, spinIndex }
}

function weightedDraw(pool: string[], teamMap: Map<string, TeamYear>, rng: () => number): string {
  let total = 0
  for (const k of pool) total += teamMap.get(k)?.weight ?? 1
  let r = rng() * total
  for (const k of pool) {
    r -= teamMap.get(k)?.weight ?? 1
    if (r <= 0) return k
  }
  return pool[pool.length - 1]
}

function spin(
  emptyRoles: Role[], pickedPlayerIds: Set<string>, spinIndex: SpinIndex,
  teamMap: Map<string, TeamYear>, playerMap: Map<string, PlayerEntry[]>, rng: () => number
): string {
  const base = new Set<string>()
  for (const role of emptyRoles) for (const k of (spinIndex[role] ?? [])) base.add(k)
  const valid = [...base].filter(key =>
    (playerMap.get(key) ?? []).some(p => emptyRoles.includes(p.role) && !pickedPlayerIds.has(p.playerId))
  )
  return weightedDraw(valid.length > 0 ? valid : [...base], teamMap, rng)
}

function greedyPick(teamKey: string, emptyRoles: Role[], picked: Set<string>, playerMap: Map<string, PlayerEntry[]>) {
  const c = (playerMap.get(teamKey) ?? []).filter(p => emptyRoles.includes(p.role) && !picked.has(p.playerId))
  c.sort((a, b) => b.ovr - a.ovr)
  return c[0] ?? null
}

function runGreedy(
  opponents: { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] },
  spinIndex: SpinIndex, teamMap: Map<string, TeamYear>, playerMap: Map<string, PlayerEntry[]>
): Map<Grade, number> {
  const counts = new Map<Grade, number>()
  for (let i = 0; i < N; i++) {
    const seed = (i * 1_000_003 + 0xDEADBEEF) >>> 0
    const rng = mulberry32(seed)
    const picks: SimPlayer[] = []
    const picked = new Set<string>()
    const filled = new Set<Role>()
    for (let round = 0; round < 5; round++) {
      const empty = ROLES.filter(r => !filled.has(r))
      const tk = spin(empty, picked, spinIndex, teamMap, playerMap, rng)
      const p = greedyPick(tk, empty, picked, playerMap)
      if (!p) { picks.push({ playerId: `f_${round}`, role: empty[0], ovr: 60 }); filled.add(empty[0]); continue }
      picks.push({ playerId: p.playerId, role: p.role, ovr: p.ovr })
      picked.add(p.playerId); filled.add(p.role)
    }
    const g = simulate(picks, opponents, seed).grade
    counts.set(g, (counts.get(g) ?? 0) + 1)
  }
  return counts
}

// ── 고정팀 시뮬 ──────────────────────────────────────────────────────
const FIXED_OVRS = [80, 85, 88, 92, 95]

function runFixed(ovr: number, opponents: { regular: Opponent[]; msi: Opponent[]; worlds: Opponent[] }): Map<Grade, number> {
  const team: SimPlayer[] = ROLES.map(r => ({ playerId: `t_${r}`, role: r, ovr }))
  const grades = new Map<Grade, number>()
  for (let i = 0; i < N; i++) {
    const g = simulate(team, opponents, (i * 2_654_435_761 + 0xABCDEF) >>> 0).grade
    grades.set(g, (grades.get(g) ?? 0) + 1)
  }
  return grades
}

function pct(n: number): string { return ((n / N) * 100).toFixed(1) }

// ── 실행 ──────────────────────────────────────────────────────────────
const { players, teams, spinIndex } = loadData()
const teamMap = new Map(teams.map(t => [t.key, t]))
const playerMap = new Map<string, PlayerEntry[]>()
for (const p of players) {
  const key = `${p.teamSlug}_${p.year}`
  if (!playerMap.has(key)) playerMap.set(key, [])
  playerMap.get(key)!.push({ id: p.id, playerId: p.playerId, role: p.role, ovr: p.ovr, teamKey: key, year: p.year })
}

console.log('MSI avg:', (MSI_POOL.reduce((s, o) => s + o.rating, 0) / MSI_POOL.length).toFixed(1))
console.log('Worlds avg:', (WORLDS_POOL.reduce((s, o) => s + o.rating, 0) / WORLDS_POOL.length).toFixed(1))
console.log('REG80 avg:', (REG80.reduce((s, o) => s + o.rating, 0) / REG80.length).toFixed(1))
console.log('REG81 avg:', (REG81.reduce((s, o) => s + o.rating, 0) / REG81.length).toFixed(1))
console.log()

type ConfigResult = {
  label: string; s: number; regAvg: number
  greedy: Map<Grade, number>
  fixed: Map<number, Map<Grade, number>>
}

const results: ConfigResult[] = []

for (const cfg of CONFIGS) {
  process.stderr.write(`[${cfg.label}] 그리디 실행 중...\n`)
  setEloScale(cfg.s)
  const opponents = { regular: cfg.regular, msi: MSI_POOL, worlds: WORLDS_POOL }
  const regAvg = cfg.regular.reduce((s, o) => s + o.rating, 0) / cfg.regular.length

  const greedy = runGreedy(opponents, spinIndex, teamMap, playerMap)

  const fixed = new Map<number, Map<Grade, number>>()
  for (const ovr of FIXED_OVRS) {
    process.stderr.write(`  고정 OVR ${ovr}...\n`)
    fixed.set(ovr, runFixed(ovr, opponents))
  }

  results.push({ label: cfg.label, s: cfg.s, regAvg, greedy, fixed })
}

// ── 결과 출력 ──────────────────────────────────────────────────────────
console.log('========== 그리디 정책 결과 (PRD 목표: GS 3~8% | LEG+EL 15~20% | CONT 20~25% | REB ≤25%) ==========')
console.log('  설정        GS%    LGND%  ELITE%  CONT%   PLAY%   REB%    | GS(목표)  LEG+EL(목표) CONT(목표) REB(목표)')
for (const r of results) {
  const gs   = ((r.greedy.get('GRAND SLAM') ?? 0) / N * 100)
  const lgnd = ((r.greedy.get('LEGENDARY') ?? 0) / N * 100)
  const el   = ((r.greedy.get('ELITE') ?? 0) / N * 100)
  const co   = ((r.greedy.get('CONTENDER') ?? 0) / N * 100)
  const pl   = ((r.greedy.get('PLAYOFF TEAM') ?? 0) / N * 100)
  const re   = ((r.greedy.get('REBUILD') ?? 0) / N * 100)
  const gsOk   = gs >= 3 && gs <= 8 ? '✓' : (gs < 3 ? '↑' : '↓')
  const leOk   = (lgnd+el) >= 15 && (lgnd+el) <= 20 ? '✓' : ((lgnd+el) < 15 ? '↑' : '↓')
  const coOk   = co >= 20 && co <= 25 ? '✓' : (co < 20 ? '↑' : '↓')
  const reOk   = re <= 25 ? '✓' : '↓'
  console.log(`  ${r.label.padEnd(10)} ${gs.toFixed(1).padStart(5)}% ${lgnd.toFixed(1).padStart(6)}% ${el.toFixed(1).padStart(6)}% ${co.toFixed(1).padStart(6)}% ${pl.toFixed(1).padStart(6)}% ${re.toFixed(1).padStart(6)}%  | ${gsOk} ${leOk} ${coOk} ${reOk}`)
}

console.log('\n========== 고정팀 OVR 분포 매트릭스 ==========')
console.log('(PRD: OVR95 GS 15~25% | OVR88 LEG/ELITE 중심 | OVR80 CONT~PLAY 중심)')
console.log('  설정        OVR  GRAND%   LGND%  ELITE%   CONT%   PLAY%   REB%')
for (const r of results) {
  for (const ovr of FIXED_OVRS) {
    const m = r.fixed.get(ovr)!
    const gs = ((m.get('GRAND SLAM') ?? 0) / N * 100)
    const lg = ((m.get('LEGENDARY') ?? 0) / N * 100)
    const el = ((m.get('ELITE') ?? 0) / N * 100)
    const co = ((m.get('CONTENDER') ?? 0) / N * 100)
    const pl = ((m.get('PLAYOFF TEAM') ?? 0) / N * 100)
    const re = ((m.get('REBUILD') ?? 0) / N * 100)
    const lbl = ovr === FIXED_OVRS[0] ? r.label.padEnd(10) : ' '.repeat(10)
    // PRD 체크: OVR95 GS 15~25%, OVR88 LEG+EL > 50%, OVR80 REB 적당(>0)
    let flag = ''
    if (ovr === 95) flag = gs >= 15 && gs <= 25 ? ' ← 목표✓' : (gs < 15 ? ` ← GS↑(${gs.toFixed(0)}%)` : ` ← GS↓(${gs.toFixed(0)}%)`)
    if (ovr === 88) flag = (lg + el) >= 50 ? ' ← LEG+EL✓' : ` ← LEG+EL${(lg+el).toFixed(0)}%`
    if (ovr === 80) flag = re > 5 && co > 30 ? ' ← CONT✓' : (re === 0 ? ' ← 너무쉬움' : '')
    console.log(`  ${lbl}  ${String(ovr).padStart(3)}  ${gs.toFixed(1).padStart(6)}% ${lg.toFixed(1).padStart(6)}% ${el.toFixed(1).padStart(6)}% ${co.toFixed(1).padStart(6)}% ${pl.toFixed(1).padStart(6)}% ${re.toFixed(1).padStart(6)}%${flag}`)
  }
  console.log()
}
