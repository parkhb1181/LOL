// v1.1 개인 지표 점수 산출 — 2013~2015 (초기 시즌 특수 처리)
//
// 데이터 소스: pipeline-cache/cargo/stats_agg_{LEAGUE}_{YEAR}.json
//   Oracle's Elixir 2013~2015 미존재 (lol.timsevenhuysen.com은 2016부터만 제공)
//   Leaguepedia Cargo 대체:
//     - KDA: 전 연도 전수 ✅
//     - GoldShare (AvgG/AvgTG): 2015 전수 ✅ / 2014 부분 ⚠️ / 2013 LCK 없음 ❌
//     - KillParticipation (AvgTK): 2015 전수 ✅ / 2014 부분 / 2013 LCK 없음 ❌
//     - DamageToChampions: 전 연도 공란 ❌ (Leaguepedia 미기록)
//     - golddiffat15/xpdiffat15/csdiffat15: OE 전용 — 없음 ❌
//
// 가중치: 가용 지표 기반 동적 재분배
//   정상: KDA 40% + GS 35% + KP 25%
//   GS 없을 때: KDA 62% + KP 38%
//   KP 없을 때: KDA 59% + GS 41%
//   KDA만: KDA 100%
//
// OVR 기여폭: ±7점 (04c와 동일)
//
// 출력:
//   pipeline-cache/ovr-stats-early.json   — "${pid}|${year}|${lc}" → 점수
//   pipeline-cache/ovr-comparison-early.csv — 호빈 검토용 비교표

import fs from 'fs'
import path from 'path'
import type { RostersFile } from './02-rosters'
import type { RatedEntry } from './04-ratings'

const TARGET_YEARS = [2013, 2014, 2015]

// OVR 기여 스케일
const SCALE = 3.5         // z=2 → 7점
const MAX_BONUS = 7
const MIN_BONUS = -7
const MIN_N = 3           // 3경기 미만 제외

// ─── 통계 헬퍼 ────────────────────────────────────────────────────────────────
function mean(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stdev(arr: number[], mu?: number): number {
  if (arr.length < 2) return 0
  const m = mu ?? mean(arr)
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length
  return Math.sqrt(variance)
}

function zScore(val: number, mu: number, sd: number): number {
  return sd > 0 ? (val - mu) / sd : 0
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────
type StatsRow = {
  link: string
  team: string
  year: number
  leagueCode: string
  kda: number
  gs: number       // goldShare — AvgTG=0이면 0
  kp: number       // killParticipation — AvgTK=0이면 0
  hasGs: boolean   // AvgTG > 0 여부
  hasKp: boolean   // AvgTK > 0 여부
  n: number
  hasStats: boolean
}

type NormBucket = { vals: number[]; mu: number; sd: number; hasVariance: boolean }

export type EarlyStatEntry = {
  statsBonus: number   // 최종 OVR 기여 (±7 클램프 정수)
  kda: number; gs: number; kp: number
  kda_z: number; gs_z: number; kp_z: number
  composite_z: number
  wKda: number; wGs: number; wKp: number  // 실제 적용된 가중치
  n: number
  earlyNote: string   // 데이터 제약 메모 (호빈 검토용)
}

export type EarlyStatsFile = Record<string, EarlyStatEntry>

// ─── stats_agg 로드 ────────────────────────────────────────────────────────────
function loadStatsAgg(year: number): Map<string, StatsRow> {
  const cargoDir = path.join(process.cwd(), 'pipeline-cache', 'cargo')
  const leagues = ['LCK', 'LPL', 'LEC', 'LCS']
  const map = new Map<string, StatsRow>()

  for (const lc of leagues) {
    const f = path.join(cargoDir, `stats_agg_${lc}_${year}.json`)
    if (!fs.existsSync(f)) {
      process.stderr.write(`  stats_agg 없음: ${lc} ${year} — skip\n`)
      continue
    }

    const rows = JSON.parse(fs.readFileSync(f, 'utf-8')) as Record<string, string>[]

    for (const r of rows) {
      const pid = r.Link?.trim()
      const tm = r.Team?.trim()
      if (!pid || !tm || pid === 'ADD') continue

      const n = parseInt(r.N || '0', 10)
      if (n < MIN_N) continue

      const avgK  = parseFloat(r.AvgK  || '0')
      const avgD  = parseFloat(r.AvgD  || '0')
      const avgA  = parseFloat(r.AvgA  || '0')
      const avgTK = parseFloat(r.AvgTK || '0')
      const avgG  = parseFloat(r.AvgG  || '0')
      const avgTG = parseFloat(r.AvgTG || '0')

      const hasStats = avgK + avgA + avgG > 0
      const hasGs = avgTG > 0 && r.AvgTG !== '' && r.AvgTG !== null
      const hasKp = avgTK > 0 && r.AvgTK !== '' && r.AvgTK !== null

      const kda = hasStats ? (avgK + avgA) / Math.max(avgD, 0.5) : 0
      const gs  = hasStats && hasGs ? avgG / avgTG : 0
      const kp  = hasStats && hasKp ? (avgK + avgA) / Math.max(avgTK, 1) : 0

      const key = `${pid}|${tm}|${year}|${lc}`
      map.set(key, { link: pid, team: tm, year, leagueCode: lc, kda, gs, kp, hasGs, hasKp, n, hasStats })
    }
  }
  return map
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  const outPath = path.join(process.cwd(), 'pipeline-cache', 'ovr-stats-early.json')
  const cmpPath = path.join(process.cwd(), 'pipeline-cache', 'ovr-comparison-early.csv')

  const rostersPath = path.join(process.cwd(), 'pipeline-cache', 'rosters.json')
  if (!fs.existsSync(rostersPath)) throw new Error('rosters.json 없음 — 02-rosters.ts 먼저 실행')
  const { entries }: RostersFile = JSON.parse(fs.readFileSync(rostersPath, 'utf-8'))

  // 현재 OVR 로드 (비교용)
  const ratingsPath = path.join(process.cwd(), 'pipeline-cache', 'ratings.json')
  const currentOvr = new Map<string, number>()
  if (fs.existsSync(ratingsPath)) {
    const rated: RatedEntry[] = JSON.parse(fs.readFileSync(ratingsPath, 'utf-8'))
    for (const r of rated) currentOvr.set(`${r.playerId}|${r.year}|${r.leagueCode}`, r.ovr)
    console.log(`현재 OVR 로드: ${currentOvr.size}건`)
  }

  // 연도별 stats 로드
  const allStats = new Map<string, StatsRow>()
  for (const yr of TARGET_YEARS) {
    const yrStats = loadStatsAgg(yr)
    for (const [k, v] of yrStats) allStats.set(k, v)
    console.log(`stats_agg ${yr}: ${yrStats.size}건 로드`)
  }

  // ─── rosters ↔ stats_agg 매칭 ───────────────────────────────────────────────
  type MatchedRow = StatsRow & { role: string; playerId: string }
  const matched: MatchedRow[] = []

  for (const e of entries) {
    if (!TARGET_YEARS.includes(e.year)) continue
    const key = `${e.playerId}|${e.team}|${e.year}|${e.leagueCode}`
    const s = allStats.get(key)
    if (!s || !s.hasStats) continue
    matched.push({ ...s, role: e.role, playerId: e.playerId })
  }

  console.log(`\n매칭 결과: ${matched.length}건`)

  // ─── 포지션×연도 버킷 구축 ─────────────────────────────────────────────────
  const kdaBuckets = new Map<string, number[]>()
  const gsBuckets  = new Map<string, number[]>()
  const kpBuckets  = new Map<string, number[]>()

  for (const m of matched) {
    const bk = `${m.role}|${m.year}`
    if (!kdaBuckets.has(bk)) {
      kdaBuckets.set(bk, [])
      gsBuckets.set(bk,  [])
      kpBuckets.set(bk,  [])
    }
    kdaBuckets.get(bk)!.push(m.kda)
    // GS/KP: 0인 값도 포함하되 hasGs/hasKp 추적
    gsBuckets.get(bk)!.push(m.gs)
    kpBuckets.get(bk)!.push(m.kp)
  }

  const normKda = new Map<string, NormBucket>()
  const normGs  = new Map<string, NormBucket>()
  const normKp  = new Map<string, NormBucket>()

  for (const [bk, vals] of kdaBuckets) {
    const mu = mean(vals); const sd = stdev(vals, mu)
    normKda.set(bk, { vals, mu, sd, hasVariance: sd > 0 })
  }
  for (const [bk, vals] of gsBuckets) {
    const mu = mean(vals); const sd = stdev(vals, mu)
    // GS 버킷이 전부 0이면 hasVariance=false (AvgTG 없는 연도)
    const nonZero = vals.filter(v => v > 0).length
    normGs.set(bk, { vals, mu, sd, hasVariance: sd > 0 && nonZero > vals.length * 0.3 })
  }
  for (const [bk, vals] of kpBuckets) {
    const mu = mean(vals); const sd = stdev(vals, mu)
    const nonZero = vals.filter(v => v > 0).length
    normKp.set(bk, { vals, mu, sd, hasVariance: sd > 0 && nonZero > vals.length * 0.3 })
  }

  // 버킷 통계 출력
  console.log('\n포지션×연도 버킷 (n / KDA mu,sd / GS variance / KP variance):')
  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP']
  for (const yr of TARGET_YEARS) {
    console.log(`\n  ─ ${yr} ─`)
    for (const role of roles) {
      const bk = `${role}|${yr}`
      const k = normKda.get(bk)
      const g = normGs.get(bk)
      const p = normKp.get(bk)
      if (!k) continue
      const gsFlag = g?.hasVariance ? '✅' : '❌'
      const kpFlag = p?.hasVariance ? '✅' : '❌'
      console.log(`    ${role}: n=${k.vals.length} KDA(${k.mu.toFixed(2)}±${k.sd.toFixed(2)}) GS${gsFlag} KP${kpFlag}`)
    }
  }

  // ─── 점수 산출 ────────────────────────────────────────────────────────────────
  const result: EarlyStatsFile = {}

  for (const m of matched) {
    const bk = `${m.role}|${m.year}`
    const nk = normKda.get(bk)
    const ng = normGs.get(bk)
    const np = normKp.get(bk)
    if (!nk || !nk.hasVariance) continue

    const kda_z = zScore(m.kda, nk.mu, nk.sd)

    // 개인 데이터 가용 여부 + 버킷 분산 모두 있어야 유효
    // hasGs/hasKp는 StatsRow 단위 (개별 선수가 실제 데이터를 가졌는지)
    const playerHasGs = m.hasGs && (ng?.hasVariance ?? false)
    const playerHasKp = m.hasKp && (np?.hasVariance ?? false)

    const gs_z = playerHasGs ? zScore(m.gs, ng!.mu, ng!.sd) : 0
    const kp_z = playerHasKp ? zScore(m.kp, np!.mu, np!.sd) : 0

    // 동적 가중치 재분배 (버킷 레벨이 아닌 개인 레벨)
    let wKda = 0.40, wGs = 0.35, wKp = 0.25

    if (!playerHasGs && !playerHasKp) {
      wKda = 1.00; wGs = 0; wKp = 0
    } else if (!playerHasGs) {
      const total = 0.40 + 0.25
      wKda = 0.40 / total
      wGs  = 0
      wKp  = 0.25 / total
    } else if (!playerHasKp) {
      const total = 0.40 + 0.35
      wKda = 0.40 / total
      wGs  = 0.35 / total
      wKp  = 0
    }

    const composite_z = kda_z * wKda + gs_z * wGs + kp_z * wKp

    // 표본 소규모 패널티: n < 10이면 최대 ±3으로 축소 (신뢰도 낮은 극단값 억제)
    const effectiveMax = m.n < 10 ? 3 : MAX_BONUS
    const effectiveMin = m.n < 10 ? -3 : MIN_BONUS
    const statsBonus = Math.max(effectiveMin, Math.min(effectiveMax, Math.round(composite_z * SCALE)))

    // earlyNote: 데이터 제약 메모
    const notes: string[] = []
    if (!playerHasGs) notes.push('GS-없음(AvgTG공란)')
    if (!playerHasKp) notes.push('KP-없음(AvgTK공란)')
    if (m.n < 10) notes.push(`표본소규모(n=${m.n})`)
    if (m.year === 2013) notes.push('2013초기시즌')

    const ovrKey = `${m.playerId}|${m.year}|${m.leagueCode}`
    // 같은 선수가 같은 연도·리그에서 두 팀 → 경기 수 더 많은 쪽 우선
    const existing = result[ovrKey]
    if (existing && existing.n >= m.n) continue
    result[ovrKey] = {
      statsBonus,
      kda: parseFloat(m.kda.toFixed(3)),
      gs:  parseFloat(m.gs.toFixed(4)),
      kp:  parseFloat(m.kp.toFixed(3)),
      kda_z: parseFloat(kda_z.toFixed(3)),
      gs_z:  parseFloat(gs_z.toFixed(3)),
      kp_z:  parseFloat(kp_z.toFixed(3)),
      composite_z: parseFloat(composite_z.toFixed(3)),
      wKda: parseFloat(wKda.toFixed(3)),
      wGs:  parseFloat(wGs.toFixed(3)),
      wKp:  parseFloat(wKp.toFixed(3)),
      n: m.n,
      earlyNote: notes.join('; ') || '',
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`\novr-stats-early.json 저장: ${Object.keys(result).length}건`)

  // ─── 비교표 생성 ──────────────────────────────────────────────────────────────
  const header = 'playerId,year,league,role,currentOvr,statsBonus,예상newOvr,kda,gs%,kp,kda_z,gs_z,kp_z,composite_z,wKda,wGs,wKp,n,변화,note'
  const lines: string[] = [header]

  type CmpRow = {
    pid: string; year: number; lc: string; role: string
    cur: number | undefined; bonus: number; newOvr: number
    entry: EarlyStatEntry
  }
  const rows: CmpRow[] = []

  for (const e of entries) {
    if (!TARGET_YEARS.includes(e.year)) continue
    const ovrKey = `${e.playerId}|${e.year}|${e.leagueCode}`
    const stat = result[ovrKey]
    if (!stat) continue
    const cur = currentOvr.get(ovrKey)
    const newOvr = cur !== undefined ? Math.max(75, Math.min(99, cur + stat.statsBonus)) : -1
    rows.push({ pid: e.playerId, year: e.year, lc: e.leagueCode, role: e.role, cur, bonus: stat.statsBonus, newOvr, entry: stat })
  }

  rows.sort((a, b) => Math.abs(b.bonus) - Math.abs(a.bonus))

  for (const r of rows) {
    const change = r.cur !== undefined && r.newOvr >= 0
      ? (r.newOvr > r.cur ? `+${r.newOvr - r.cur}` : r.newOvr < r.cur ? `${r.newOvr - r.cur}` : '0')
      : 'N/A'
    lines.push([
      r.pid, r.year, r.lc, r.role,
      r.cur ?? 'N/A', r.bonus, r.newOvr >= 0 ? r.newOvr : 'N/A',
      r.entry.kda.toFixed(2),
      (r.entry.gs * 100).toFixed(1) + '%',
      r.entry.kp.toFixed(2),
      r.entry.kda_z.toFixed(2), r.entry.gs_z.toFixed(2), r.entry.kp_z.toFixed(2),
      r.entry.composite_z.toFixed(2),
      r.entry.wKda.toFixed(2), r.entry.wGs.toFixed(2), r.entry.wKp.toFixed(2),
      r.entry.n, change,
      `"${r.entry.earlyNote}"`,
    ].join(','))
  }

  fs.writeFileSync(cmpPath, lines.join('\n'), 'utf-8')
  console.log(`비교표 저장: ${rows.length}건 → ${cmpPath}`)

  // ─── 상위 변화 요약 (콘솔) ────────────────────────────────────────────────────
  const top = rows.filter(r => r.cur !== undefined).slice(0, 40)
  console.log('\n[상위 40 변화 예상 — 변화 큰 순]')
  console.log('playerId'.padEnd(28) + ' | yr | lc  | role | OVR | Δ  | new | composite_z | note')
  console.log('─'.repeat(100))
  for (const r of top) {
    const sign = r.bonus >= 0 ? '+' : ''
    const arrow = r.newOvr > (r.cur ?? 0) ? '↑' : r.newOvr < (r.cur ?? 0) ? '↓' : '='
    const note = r.entry.earlyNote ? ` [${r.entry.earlyNote}]` : ''
    console.log(
      `${r.pid.padEnd(28)} | ${r.year} | ${r.lc.padEnd(3)} | ${r.role.padEnd(4)} | ${String(r.cur).padStart(3)} | ${sign}${r.bonus} | ${r.newOvr} | ${r.entry.composite_z.toFixed(2).padStart(7)} | ${arrow}${note}`
    )
  }

  // ─── 연도×리그별 커버리지 요약 ───────────────────────────────────────────────
  console.log('\n연도별 처리 결과:')
  for (const yr of TARGET_YEARS) {
    const yrRows = rows.filter(r => r.year === yr)
    const byLc = ['LCK', 'LPL', 'LEC', 'LCS'].map(lc => {
      const n = yrRows.filter(r => r.lc === lc).length
      return `${lc}:${n}`
    }).join(' ')
    console.log(`  ${yr}: 총 ${yrRows.length}건 [${byLc}]`)
  }

  // ─── 포지션별 보너스 분포 ────────────────────────────────────────────────────
  console.log('\n포지션별 statsBonus 분포 (2013~2015 합산):')
  for (const role of roles) {
    const bonuses = rows.filter(r => r.role === role).map(r => r.bonus)
    if (!bonuses.length) continue
    const pos  = bonuses.filter(b => b > 0).length
    const neg  = bonuses.filter(b => b < 0).length
    const zero = bonuses.filter(b => b === 0).length
    const avg  = mean(bonuses)
    console.log(`  ${role}: n=${bonuses.length} 상승=${pos} 하락=${neg} 유지=${zero} 평균보너스=${avg.toFixed(2)}`)
  }

  // ─── 주요 앵커 선수 체크 ─────────────────────────────────────────────────────
  const anchors = [
    'Faker|2015|LCK', 'MaRin|2015|LCK', 'Bang|2015|LCK',
    'Faker|2013|LCK', 'imp|2014|LCK', 'Mata|2014|LCK', 'DanDy|2014|LCK',
    'Wolf (Lee Jae-wan)|2015|LCK',
    'Uzi (Jian Zi-Hao)|2013|LPL', 'Uzi (Jian Zi-Hao)|2015|LPL', 'RooKie|2015|LPL',
    'Clearlove|2015|LPL',
    'Bjergsen|2015|LCS', 'Doublelift|2015|LCS',
    'YellOwStaR|2015|LEC', 'Froggen|2015|LEC',
  ]
  console.log('\n주요 앵커 선수:')
  for (const k of anchors) {
    const stat = result[k]
    if (stat) {
      const cur = currentOvr.get(k)
      const newOvr = cur !== undefined ? Math.max(75, Math.min(99, cur + stat.statsBonus)) : '?'
      const sign = stat.statsBonus >= 0 ? '+' : ''
      console.log(`  ${k.padEnd(20)}: OVR ${cur ?? '?'} → ${newOvr} (${sign}${stat.statsBonus}) | KDA:${stat.kda.toFixed(2)} kda_z:${stat.kda_z.toFixed(2)} composite:${stat.composite_z.toFixed(2)}${stat.earlyNote ? ' [' + stat.earlyNote + ']' : ''}`)
    } else {
      console.log(`  ${k.padEnd(20)}: 데이터 없음 (stats_agg 미수집 또는 매칭 실패)`)
    }
  }

  // ─── progress_log 연도별 버킷 n값 기록용 데이터 ────────────────────────────
  console.log('\n[progress_log.md 기록용]')
  for (const yr of TARGET_YEARS) {
    for (const role of roles) {
      const bk = `${role}|${yr}`
      const k = normKda.get(bk)
      const g = normGs.get(bk)
      const p = normKp.get(bk)
      if (!k) continue
      const gsOk = g?.hasVariance ? '✅' : '❌'
      const kpOk = p?.hasVariance ? '✅' : '❌'
      console.log(`| ${yr} | ${role} | ${k.vals.length} | ${k.mu.toFixed(2)} | ${k.sd.toFixed(2)} | GS:${gsOk} KP:${kpOk} |`)
    }
  }
}

main().catch(e => { process.stderr.write(`Fatal: ${e}\n`); process.exit(1) })
