// v1.1 개인 지표 점수 산출 — 2016~2018 (rosters.json + 기존 stats_agg 활용)
//
// 데이터 소스: pipeline-cache/cargo/stats_agg_{LEAGUE}_{YEAR}.json
//   (Oracle's Elixir 403/404 차단 — Leaguepedia 대체. golddiffat15/csdiffat15 없음)
// 3지표: KDA 40% + GoldShare 35% + KillParticipation 25%
// 포지션 내 z-score 정규화 (role|year 버킷)
// OVR 기여폭: ±7점
//
// 출력: pipeline-cache/ovr-stats-v11.json
//   key: "${playerId}|${year}|${leagueCode}"
//   value: { statsBonus, kda, gs, kp, kda_z, gs_z, kp_z, n }
//
// 비교표: pipeline-cache/ovr-comparison-v11.csv (호빈 검토용)

import fs from 'fs'
import path from 'path'
import type { RostersFile } from './02-rosters'
import type { RatedEntry } from './04-ratings'

// 연도 범위 — 이 스크립트가 처리하는 범위 (확장 가능)
const TARGET_YEARS = [2016, 2017, 2018]

// v1.1 지표 가중치
const W_KDA = 0.40
const W_GS  = 0.35
const W_KP  = 0.25

// OVR 기여 스케일 — z=1 → 몇 점
const SCALE = 3.5  // z=2 → 7점, z=-2 → -7점 (±7 실용 한계)

// 지표수 기반 effectiveCap (04e와 동일 규칙)
// 3지표±7 / 2지표±5 / 1지표±3 / n<10이면 추가-2

// ─── 통계 헬퍼 ────────────────────────────────────────────────────────────────
function mean(arr: number[]): number {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function stdev(arr: number[], mu?: number): number {
  if (arr.length < 2) return 1
  const m = mu ?? mean(arr)
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length
  return Math.sqrt(variance) || 1
}

function zScore(val: number, mu: number, sd: number): number {
  return sd > 0 ? (val - mu) / sd : 0
}

// ─── 타입 ──────────────────────────────────────────────────────────────────────
type StatsRow = {
  link: string
  team: string
  year: number
  leagueCode: string
  kda: number
  gs: number    // goldShare (AvgTG=0이면 0)
  kp: number    // killParticipation
  hasGs: boolean  // AvgTG > 0
  hasKp: boolean  // AvgTK > 0
  n: number
  hasStats: boolean
}

type NormBucket = { vals: number[]; mu: number; sd: number; hasVariance: boolean }

export type OvrStatEntry = {
  statsBonus: number   // 최종 OVR 기여 (±cap 클램프 정수)
  kda: number
  gs: number
  kp: number
  kda_z: number
  gs_z: number
  kp_z: number
  wKda: number; wGs: number; wKp: number
  n: number
  note: string
}

export type OvrStatsFile = Record<string, OvrStatEntry>  // key: "${pid}|${year}|${lc}"

// ─── stats_agg 로드 ────────────────────────────────────────────────────────────
function loadStatsAgg(year: number): Map<string, StatsRow> {
  const cargoDir = path.join(process.cwd(), 'pipeline-cache', 'cargo')
  const leagues = ['LCK', 'LPL', 'LEC', 'LCS']
  const map = new Map<string, StatsRow>()

  for (const lc of leagues) {
    // 파일명 패턴: stats_agg_{LEAGUE}_{YEAR}.json
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
      if (n < 3) continue  // 3경기 미만은 통계적으로 불안정

      const avgK = parseFloat(r.AvgK || '0')
      const avgD = parseFloat(r.AvgD || '0')
      const avgA = parseFloat(r.AvgA || '0')
      const avgTK = parseFloat(r.AvgTK || '0')
      const avgG = parseFloat(r.AvgG || '0')
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
  const outPath = path.join(process.cwd(), 'pipeline-cache', 'ovr-stats-v11.json')
  const cmpPath = path.join(process.cwd(), 'pipeline-cache', 'ovr-comparison-v11.csv')

  // rosters.json — 역할 정보 + 기준 playerId 조회
  const rostersPath = path.join(process.cwd(), 'pipeline-cache', 'rosters.json')
  if (!fs.existsSync(rostersPath)) throw new Error('rosters.json 없음 — 02-rosters.ts 먼저 실행')
  const { players, entries }: RostersFile = JSON.parse(fs.readFileSync(rostersPath, 'utf-8'))

  // ratings.json — 현재 OVR 비교용
  const ratingsPath = path.join(process.cwd(), 'pipeline-cache', 'ratings.json')
  const currentOvr = new Map<string, number>()  // key: "${pid}|${year}|${lc}"
  if (fs.existsSync(ratingsPath)) {
    const rated: RatedEntry[] = JSON.parse(fs.readFileSync(ratingsPath, 'utf-8'))
    for (const r of rated) {
      currentOvr.set(`${r.playerId}|${r.year}|${r.leagueCode}`, r.ovr)
    }
    console.log(`현재 OVR 로드: ${currentOvr.size}건`)
  }

  // 연도별 stats 로드
  const allStats = new Map<string, StatsRow>()
  for (const yr of TARGET_YEARS) {
    const yrStats = loadStatsAgg(yr)
    for (const [k, v] of yrStats) allStats.set(k, v)
    console.log(`stats_agg ${yr}: ${yrStats.size}건 로드`)
  }

  // ─── 매칭: rosters entries ↔ stats_agg ─────────────────────────────────────
  // stats_agg 키: "${pid}|${team}|${year}|${lc}"
  // rosters entries: { playerId, team, year, leagueCode, role, ... }
  //
  // 매칭은 (playerId, team, year, leagueCode) 4개 키 조합 — playerId = Leaguepedia Link

  type MatchedRow = StatsRow & { role: string; playerId: string }
  const matched: MatchedRow[] = []

  for (const e of entries) {
    if (!TARGET_YEARS.includes(e.year)) continue

    const key = `${e.playerId}|${e.team}|${e.year}|${e.leagueCode}`
    const s = allStats.get(key)
    if (!s || !s.hasStats) continue

    matched.push({ ...s, role: e.role, playerId: e.playerId })
  }

  console.log(`\n매칭 결과: ${matched.length}건 (TARGET_YEARS: ${TARGET_YEARS.join(',')})`)

  // ─── 포지션×연도 정규화 버킷 구축 ────────────────────────────────────────────
  const kdaBuckets  = new Map<string, number[]>()
  const gsBuckets   = new Map<string, number[]>()
  const kpBuckets   = new Map<string, number[]>()

  for (const m of matched) {
    const bk = `${m.role}|${m.year}`
    if (!kdaBuckets.has(bk)) { kdaBuckets.set(bk, []); gsBuckets.set(bk, []); kpBuckets.set(bk, []) }
    kdaBuckets.get(bk)!.push(m.kda)
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
    const nonZero = vals.filter(v => v > 0).length
    normGs.set(bk, { vals, mu, sd, hasVariance: sd > 0 && nonZero > vals.length * 0.3 })
  }
  for (const [bk, vals] of kpBuckets) {
    const mu = mean(vals); const sd = stdev(vals, mu)
    const nonZero = vals.filter(v => v > 0).length
    normKp.set(bk, { vals, mu, sd, hasVariance: sd > 0 && nonZero > vals.length * 0.3 })
  }

  // 버킷 통계 출력
  console.log('\n포지션×연도 버킷 통계 (n/mu/sd):')
  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP']
  for (const yr of TARGET_YEARS) {
    for (const role of roles) {
      const bk = `${role}|${yr}`
      const k = normKda.get(bk)
      const g = normGs.get(bk)
      if (!k) continue
      console.log(`  ${role}|${yr}: n=${k.vals.length} KDA(mu=${k.mu.toFixed(2)},sd=${k.sd.toFixed(2)}) GS(mu=${g?.mu.toFixed(3)},sd=${g?.sd.toFixed(3)})`)
    }
  }

  // ─── 점수 산출 ────────────────────────────────────────────────────────────────
  const result: OvrStatsFile = {}

  for (const m of matched) {
    const bk = `${m.role}|${m.year}`
    const nk = normKda.get(bk)
    const ng = normGs.get(bk)
    const np = normKp.get(bk)
    if (!nk || !nk.hasVariance) continue

    const kda_z = zScore(m.kda, nk.mu, nk.sd)

    // 개인 데이터 + 버킷 분산 모두 확인 (04e와 동일 패턴)
    const playerHasGs = m.hasGs && (ng?.hasVariance ?? false)
    const playerHasKp = m.hasKp && (np?.hasVariance ?? false)

    const gs_z = playerHasGs ? zScore(m.gs, ng!.mu, ng!.sd) : 0
    const kp_z = playerHasKp ? zScore(m.kp, np!.mu, np!.sd) : 0

    // 동적 가중치 재분배
    let wKda = W_KDA, wGs = W_GS, wKp = W_KP
    if (!playerHasGs && !playerHasKp) {
      wKda = 1.00; wGs = 0; wKp = 0
    } else if (!playerHasGs) {
      const t = W_KDA + W_KP; wKda = W_KDA / t; wGs = 0; wKp = W_KP / t
    } else if (!playerHasKp) {
      const t = W_KDA + W_GS; wKda = W_KDA / t; wGs = W_GS / t; wKp = 0
    }

    const composite_z = kda_z * wKda + gs_z * wGs + kp_z * wKp

    // 지표수 기반 effectiveCap (04e와 동일)
    const nMetrics = 1 + (playerHasGs ? 1 : 0) + (playerHasKp ? 1 : 0)
    const baseCap = nMetrics === 3 ? 7 : nMetrics === 2 ? 5 : 3
    const effectiveCap = m.n < 10 ? Math.max(1, baseCap - 2) : baseCap
    const statsBonus = Math.max(-effectiveCap, Math.min(effectiveCap, Math.round(composite_z * SCALE)))

    const notes: string[] = []
    if (!playerHasGs) notes.push('GS없음')
    if (!playerHasKp) notes.push('KP없음')
    if (m.n < 10) notes.push(`소표본(n=${m.n})`)
    notes.push(`지표${nMetrics}개cap±${effectiveCap}`)

    const ovrKey = `${m.playerId}|${m.year}|${m.leagueCode}`
    // 중복: 같은 선수 두 팀 엔트리 → 경기 수 많은 쪽 우선
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
      wKda: parseFloat(wKda.toFixed(3)),
      wGs:  parseFloat(wGs.toFixed(3)),
      wKp:  parseFloat(wKp.toFixed(3)),
      n: m.n,
      note: notes.join('; '),
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')
  console.log(`\novr-stats-v11.json 저장: ${Object.keys(result).length}건`)

  // ─── 비교표 생성 ──────────────────────────────────────────────────────────────
  const lines: string[] = [
    'playerId,year,league,role,currentOvr,statsBonus,newOvr(예상),kda,gs%,kp,kda_z,gs_z,kp_z,n,변화,note'
  ]

  // currentOvr + statsBonus → newOvr 예상
  // (실제 반영은 04-ratings.ts 수정 후 07-build.ts 재실행 필요)
  const rows: Array<{
    pid: string; year: number; lc: string; role: string
    cur: number | undefined; bonus: number; newOvr: number
    entry: OvrStatEntry
  }> = []

  for (const e of entries) {
    if (!TARGET_YEARS.includes(e.year)) continue
    const ovrKey = `${e.playerId}|${e.year}|${e.leagueCode}`
    const stat = result[ovrKey]
    if (!stat) continue
    const cur = currentOvr.get(ovrKey)
    const newOvr = cur !== undefined ? Math.max(75, Math.min(99, cur + stat.statsBonus)) : -1
    rows.push({ pid: e.playerId, year: e.year, lc: e.leagueCode, role: e.role, cur, bonus: stat.statsBonus, newOvr, entry: stat })
  }

  // |statsBonus| 크기 내림차순 정렬 — 변화 큰 선수 먼저
  rows.sort((a, b) => Math.abs(b.bonus) - Math.abs(a.bonus))

  for (const r of rows) {
    const change = r.cur !== undefined && r.newOvr >= 0
      ? (r.newOvr > r.cur ? `+${r.newOvr - r.cur}` : r.newOvr < r.cur ? `${r.newOvr - r.cur}` : '0')
      : 'N/A'
    lines.push([
      r.pid, r.year, r.lc, r.role,
      r.cur ?? 'N/A', r.bonus, r.newOvr >= 0 ? r.newOvr : 'N/A',
      r.entry.kda.toFixed(2), (r.entry.gs * 100).toFixed(1) + '%',
      r.entry.kp.toFixed(2),
      r.entry.kda_z.toFixed(2), r.entry.gs_z.toFixed(2), r.entry.kp_z.toFixed(2),
      r.entry.n, change, `"${r.entry.note}"`,
    ].join(','))
  }

  fs.writeFileSync(cmpPath, lines.join('\n'), 'utf-8')
  console.log(`비교표 저장: ${rows.length}건 → ${cmpPath}`)

  // ─── 상위 변화 요약 ────────────────────────────────────────────────────────────
  const top = rows.filter(r => r.cur !== undefined).slice(0, 30)
  console.log('\n[상위 30 변화 예상]')
  console.log('playerId | year | league | role | OVR | bonus | newOVR | 변화')
  console.log('---------|------|--------|------|-----|-------|--------|-----')
  for (const r of top) {
    const sign = r.bonus >= 0 ? '+' : ''
    const arrow = r.newOvr > (r.cur ?? 0) ? '↑' : r.newOvr < (r.cur ?? 0) ? '↓' : '='
    console.log(
      `${r.pid.padEnd(25)} | ${r.year} | ${r.lc.padEnd(3)} | ${r.role.padEnd(3)} | ${r.cur ?? '?'} | ${sign}${r.bonus} | ${r.newOvr} | ${arrow}`
    )
  }

  // 포지션별 보너스 분포 요약
  console.log('\n포지션별 statsBonus 분포 (2016~2018 합산):')
  for (const role of roles) {
    const bonuses = rows.filter(r => r.role === role).map(r => r.bonus)
    if (!bonuses.length) continue
    const pos = bonuses.filter(b => b > 0).length
    const neg = bonuses.filter(b => b < 0).length
    const zero = bonuses.filter(b => b === 0).length
    const avg = mean(bonuses)
    console.log(`  ${role}: n=${bonuses.length} 상승=${pos} 하락=${neg} 유지=${zero} 평균보너스=${avg.toFixed(2)}`)
  }

  // 연도별 처리 결과 요약
  console.log('\n연도별 처리 결과:')
  for (const yr of TARGET_YEARS) {
    const yrRows = rows.filter(r => r.year === yr)
    const byLeague = ['LCK', 'LPL', 'LEC', 'LCS'].map(lc => {
      const n = yrRows.filter(r => r.lc === lc).length
      return `${lc}:${n}`
    }).join(' ')
    console.log(`  ${yr}: 총 ${yrRows.length}건 [${byLeague}]`)
  }
}

main().catch(e => { process.stderr.write(`Fatal: ${e}\n`); process.exit(1) })
