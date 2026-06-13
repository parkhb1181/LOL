// v1.1 OVR 최종 개인 지표 통합 스코어
// 소스: OE(04d-parse-oe.ts 출력) + Leaguepedia stats_agg + rosters.json
//
// 규칙:
//   다지표 시즌 (OE gdat15 커버리지 ≥50%): KDA+GoldDiff@15+DPM+CSdiff 합산 → cap ±8
//   KDA 단일/부족 (OE 없거나 커버리지 < 50%): LP KDA+GoldShare+KP → cap ±3
//
// 출력: pipeline-cache/ovr-stats-v11-final.json
//   key: "${playerId}|${year}|${leagueCode}"
//   value: { statsBonus, mode, metrics... }

import fs from 'fs'
import path from 'path'
import type { RostersFile } from './02-rosters'
import type { RatedEntry } from './04-ratings'
import type { OePlayerEntry, OeStatsFile } from './04d-parse-oe'

const OE_DIR   = path.join(process.cwd(), 'pipeline-cache', 'oe')
const CARGO_DIR = path.join(process.cwd(), 'pipeline-cache', 'cargo')
const TARGET_YEARS = [2016, 2017, 2018]

// ─── 가중치 ────────────────────────────────────────────────────────────────────
// 2019-2021(04b), 2022-2023(04d)와 동일 스펙: KDA35/골드차25/라인전20/데미지20
const OE_WEIGHTS   = { kda: 0.35, gd15: 0.25, dpm: 0.20, cd15: 0.20 }
const LP_WEIGHTS   = { kda: 0.40, gs: 0.35, kp: 0.25 }
const SCALE_OE = 4.0  // z=2 → 8점  (cap ±8)
const SCALE_LP = 1.5  // z=2 → 3점  (cap ±3)
const CAP_OE = 8
const CAP_LP = 3
const GD15_MIN_COVERAGE = 0.50

// ─── 통계 헬퍼 ────────────────────────────────────────────────────────────────
const mean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
const stdev = (arr: number[], mu?: number) => {
  if (arr.length < 2) return 1
  const m = mu ?? mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length) || 1
}
const zscore = (val: number, mu: number, sd: number) => sd > 0 ? (val - mu) / sd : 0

type NormBucket = { mu: number; sd: number }

// ─── OE 파일 로드 ─────────────────────────────────────────────────────────────
function loadOeYear(year: number): OeStatsFile {
  const f = path.join(OE_DIR, `oe-stats-${year}.json`)
  if (!fs.existsSync(f)) return {}
  return JSON.parse(fs.readFileSync(f, 'utf-8'))
}

// ─── Leaguepedia stats_agg 로드 (기존 04c 방식) ───────────────────────────────
function loadLpStats(year: number): Map<string, { kda: number; gs: number; kp: number; n: number }> {
  const leagues = ['LCK', 'LPL', 'LEC', 'LCS']
  const map = new Map<string, { kda: number; gs: number; kp: number; n: number }>()
  for (const lc of leagues) {
    const f = path.join(CARGO_DIR, `stats_agg_${lc}_${year}.json`)
    if (!fs.existsSync(f)) continue
    const rows = JSON.parse(fs.readFileSync(f, 'utf-8')) as Record<string, string>[]
    for (const r of rows) {
      const pid = r.Link?.trim(); const tm = r.Team?.trim()
      if (!pid || !tm || pid === 'ADD') continue
      const n = parseInt(r.N || '0')
      if (n < 3) continue
      const k = parseFloat(r.AvgK || '0'), d = parseFloat(r.AvgD || '0')
      const a = parseFloat(r.AvgA || '0'), tk = parseFloat(r.AvgTK || '0')
      const g = parseFloat(r.AvgG || '0'), tg = parseFloat(r.AvgTG || '0')
      if (k + a + g === 0) continue
      map.set(`${pid.toLowerCase()}|${tm.toLowerCase()}|${year}`, {
        kda: (k + a) / Math.max(d, 0.5),
        gs:  tg > 0 ? g / tg : 0,
        kp:  (k + a) / Math.max(tk, 1),
        n,
      })
    }
  }
  return map
}

// ─── 타입 ──────────────────────────────────────────────────────────────────────
export type FinalStatEntry = {
  statsBonus: number   // 최종 OVR 기여 (정수)
  mode: 'oe' | 'lp'   // 사용된 모드
  cap: number          // 적용 cap (8 or 3)
  n: number
  // OE 모드 지표
  kda?: number; gd15?: number; dpm?: number; cd15?: number
  kda_z?: number; gd15_z?: number; dpm_z?: number; cd15_z?: number
  // LP 모드 지표
  gs?: number; kp?: number
  gs_z?: number; kp_z?: number
}

export type FinalStatsFile = Record<string, FinalStatEntry>  // key: "${pid}|${year}|${lc}"

async function main() {
  const outPath = path.join(process.cwd(), 'pipeline-cache', 'ovr-stats-v11-final.json')
  const cmpPath = path.join(process.cwd(), 'pipeline-cache', 'ovr-comparison-v11-final.csv')

  // rosters.json
  const { entries }: RostersFile = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'pipeline-cache', 'rosters.json'), 'utf-8')
  )

  // 현재 OVR (비교용)
  const currentOvr = new Map<string, number>()
  const ratingsPath = path.join(process.cwd(), 'pipeline-cache', 'ratings.json')
  if (fs.existsSync(ratingsPath)) {
    const rated: RatedEntry[] = JSON.parse(fs.readFileSync(ratingsPath, 'utf-8'))
    for (const r of rated) currentOvr.set(`${r.playerId}|${r.year}|${r.leagueCode}`, r.ovr)
  }

  // ─── 데이터 로드 ───────────────────────────────────────────────────────────
  const oeByYear = new Map<number, OeStatsFile>()
  const lpByYear = new Map<number, Map<string, { kda: number; gs: number; kp: number; n: number }>>()

  for (const yr of TARGET_YEARS) {
    oeByYear.set(yr, loadOeYear(yr))
    lpByYear.set(yr, loadLpStats(yr))
    console.log(`로드: OE ${yr}=${Object.keys(oeByYear.get(yr)!).length}건, LP ${yr}=${lpByYear.get(yr)!.size}건`)
  }

  // ─── 정규화 버킷 구축 ──────────────────────────────────────────────────────
  // OE 버킷: (role|year) → [kda, gd15, dpm, cd15]
  // LP 버킷: (role|year) → [kda, gs, kp]

  type OeBuckets  = { kda: number[]; gd15: number[]; dpm: number[]; cd15: number[] }
  type LpBuckets  = { kda: number[]; gs: number[]; kp: number[] }

  const oeNormRaw = new Map<string, OeBuckets>()
  const lpNormRaw = new Map<string, LpBuckets>()

  for (const e of entries) {
    if (!TARGET_YEARS.includes(e.year)) continue

    const bk = `${e.role}|${e.year}`
    const oeStat = findOeMatch(oeByYear.get(e.year)!, e.playerId, e.team)

    if (oeStat && oeStat.gdat15Coverage >= GD15_MIN_COVERAGE) {
      if (!oeNormRaw.has(bk)) oeNormRaw.set(bk, { kda: [], gd15: [], dpm: [], cd15: [] })
      const b = oeNormRaw.get(bk)!
      const kda = (oeStat.avgKills + oeStat.avgAssists) / Math.max(oeStat.avgDeaths, 0.5)
      b.kda.push(kda)
      b.gd15.push(oeStat.avgGdat15)
      b.dpm.push(oeStat.avgDpm)
      b.cd15.push(oeStat.avgCsdat15)
    }

    const lpKey = `${e.playerId.toLowerCase()}|${e.team.toLowerCase()}|${e.year}`
    const lpStat = lpByYear.get(e.year)!.get(lpKey)
    if (lpStat) {
      if (!lpNormRaw.has(bk)) lpNormRaw.set(bk, { kda: [], gs: [], kp: [] })
      const b = lpNormRaw.get(bk)!
      b.kda.push(lpStat.kda); b.gs.push(lpStat.gs); b.kp.push(lpStat.kp)
    }
  }

  const oeNorm = new Map<string, { kda: NormBucket; gd15: NormBucket; dpm: NormBucket; cd15: NormBucket }>()
  const lpNorm = new Map<string, { kda: NormBucket; gs: NormBucket; kp: NormBucket }>()

  for (const [bk, b] of oeNormRaw) {
    oeNorm.set(bk, {
      kda:  { mu: mean(b.kda),  sd: stdev(b.kda)  },
      gd15: { mu: mean(b.gd15), sd: stdev(b.gd15) },
      dpm:  { mu: mean(b.dpm),  sd: stdev(b.dpm)  },
      cd15: { mu: mean(b.cd15), sd: stdev(b.cd15) },
    })
  }
  for (const [bk, b] of lpNormRaw) {
    lpNorm.set(bk, {
      kda: { mu: mean(b.kda), sd: stdev(b.kda) },
      gs:  { mu: mean(b.gs),  sd: stdev(b.gs)  },
      kp:  { mu: mean(b.kp),  sd: stdev(b.kp)  },
    })
  }

  // 정규화 버킷 통계 출력
  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP']
  console.log('\n정규화 버킷 (OE 모드 — n이 있는 경우만):')
  for (const yr of TARGET_YEARS) {
    for (const role of roles) {
      const bk = `${role}|${yr}`
      const on = oeNormRaw.get(bk)?.kda.length ?? 0
      const ln = lpNormRaw.get(bk)?.kda.length ?? 0
      if (on > 0) {
        const ob = oeNorm.get(bk)!
        console.log(`  ${role}|${yr}: OE n=${on} gd15(mu=${ob.gd15.mu.toFixed(0)},sd=${ob.gd15.sd.toFixed(0)}) dpm(mu=${ob.dpm.mu.toFixed(0)},sd=${ob.dpm.sd.toFixed(0)})  LP n=${ln}`)
      } else if (ln > 0) {
        console.log(`  ${role}|${yr}: OE n=0 (LP 폴백)  LP n=${ln}`)
      }
    }
  }

  // ─── 점수 산출 ────────────────────────────────────────────────────────────
  const result: FinalStatsFile = {}

  for (const e of entries) {
    if (!TARGET_YEARS.includes(e.year)) continue
    const bk = `${e.role}|${e.year}`
    const ovrKey = `${e.playerId}|${e.year}|${e.leagueCode}`

    const oeStat = findOeMatch(oeByYear.get(e.year)!, e.playerId, e.team)
    const lpKey = `${e.playerId.toLowerCase()}|${e.team.toLowerCase()}|${e.year}`
    const lpStat = lpByYear.get(e.year)!.get(lpKey)

    const useOe = oeStat !== null && oeStat.gdat15Coverage >= GD15_MIN_COVERAGE && oeNorm.has(bk)

    if (useOe) {
      const on = oeNorm.get(bk)!
      const kda = (oeStat!.avgKills + oeStat!.avgAssists) / Math.max(oeStat!.avgDeaths, 0.5)
      const kda_z = zscore(kda, on.kda.mu, on.kda.sd)
      const gd15_z = zscore(oeStat!.avgGdat15, on.gd15.mu, on.gd15.sd)
      const dpm_z  = zscore(oeStat!.avgDpm,    on.dpm.mu,  on.dpm.sd)
      const cd15_z = zscore(oeStat!.avgCsdat15, on.cd15.mu, on.cd15.sd)

      const composite = kda_z * OE_WEIGHTS.kda + gd15_z * OE_WEIGHTS.gd15
                      + dpm_z * OE_WEIGHTS.dpm  + cd15_z * OE_WEIGHTS.cd15

      const statsBonus = Math.max(-CAP_OE, Math.min(CAP_OE, Math.round(composite * SCALE_OE)))

      result[ovrKey] = {
        statsBonus, mode: 'oe', cap: CAP_OE, n: oeStat!.n,
        kda: parseFloat(kda.toFixed(3)), gd15: oeStat!.avgGdat15, dpm: oeStat!.avgDpm, cd15: oeStat!.avgCsdat15,
        kda_z: parseFloat(kda_z.toFixed(3)), gd15_z: parseFloat(gd15_z.toFixed(3)),
        dpm_z: parseFloat(dpm_z.toFixed(3)), cd15_z: parseFloat(cd15_z.toFixed(3)),
      }
    } else if (lpStat) {
      const ln = lpNorm.get(bk)
      if (!ln) continue
      const kda_z = zscore(lpStat.kda, ln.kda.mu, ln.kda.sd)
      const gs_z  = zscore(lpStat.gs,  ln.gs.mu,  ln.gs.sd)
      const kp_z  = zscore(lpStat.kp,  ln.kp.mu,  ln.kp.sd)

      const composite = kda_z * LP_WEIGHTS.kda + gs_z * LP_WEIGHTS.gs + kp_z * LP_WEIGHTS.kp

      const statsBonus = Math.max(-CAP_LP, Math.min(CAP_LP, Math.round(composite * SCALE_LP)))

      result[ovrKey] = {
        statsBonus, mode: 'lp', cap: CAP_LP, n: lpStat.n,
        kda: parseFloat(lpStat.kda.toFixed(3)), gs: parseFloat(lpStat.gs.toFixed(4)), kp: parseFloat(lpStat.kp.toFixed(3)),
        kda_z: parseFloat(kda_z.toFixed(3)), gs_z: parseFloat(gs_z.toFixed(3)), kp_z: parseFloat(kp_z.toFixed(3)),
      }
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8')
  const oeCount = Object.values(result).filter(r => r.mode === 'oe').length
  const lpCount = Object.values(result).filter(r => r.mode === 'lp').length
  console.log(`\novr-stats-v11-final.json 저장: ${Object.keys(result).length}건 (OE모드:${oeCount}, LP모드:${lpCount})`)

  // ─── 비교표 생성 ──────────────────────────────────────────────────────────
  const rows: Array<{
    pid: string; year: number; lc: string; role: string
    cur: number | undefined; entry: FinalStatEntry
  }> = []

  for (const e of entries) {
    if (!TARGET_YEARS.includes(e.year)) continue
    const ovrKey = `${e.playerId}|${e.year}|${e.leagueCode}`
    const stat = result[ovrKey]
    if (!stat) continue
    rows.push({ pid: e.playerId, year: e.year, lc: e.leagueCode, role: e.role, cur: currentOvr.get(ovrKey), entry: stat })
  }

  rows.sort((a, b) => Math.abs(b.entry.statsBonus) - Math.abs(a.entry.statsBonus))

  const lines = ['playerId,year,league,role,mode,currentOvr,statsBonus,newOvr(예상),변화,cap']
  for (const r of rows) {
    const newOvr = r.cur !== undefined ? Math.max(75, Math.min(99, r.cur + r.entry.statsBonus)) : -1
    const change = r.cur !== undefined && newOvr >= 0
      ? (newOvr > r.cur ? `+${newOvr - r.cur}` : newOvr < r.cur ? `${newOvr - r.cur}` : '0') : 'N/A'
    lines.push([r.pid, r.year, r.lc, r.role, r.entry.mode, r.cur ?? 'N/A', r.entry.statsBonus, newOvr >= 0 ? newOvr : 'N/A', change, r.entry.cap].join(','))
  }
  fs.writeFileSync(cmpPath, lines.join('\n'), 'utf-8')
  console.log(`비교표 저장: ${rows.length}건`)

  // ─── 요약 출력 ────────────────────────────────────────────────────────────
  console.log('\n[상위 25 변화 예상 — OE 모드]')
  console.log('playerId | year | league | role | OVR | bonus | newOVR | mode')
  const top25 = rows.filter(r => r.cur !== undefined).slice(0, 25)
  for (const r of top25) {
    const newOvr = r.cur !== undefined ? Math.max(75, Math.min(99, r.cur + r.entry.statsBonus)) : '?'
    const sign = r.entry.statsBonus >= 0 ? '+' : ''
    console.log(`  ${r.pid.padEnd(25)} | ${r.year} | ${r.lc.padEnd(3)} | ${r.role.padEnd(3)} | ${r.cur ?? '?'} | ${sign}${r.entry.statsBonus} | ${newOvr} | [${r.entry.mode}]`)
  }

  // 모드별 포지션 분포
  console.log('\n[모드별 분포]')
  for (const yr of TARGET_YEARS) {
    const yrRows = rows.filter(r => r.year === yr)
    const oe = yrRows.filter(r => r.entry.mode === 'oe').length
    const lp = yrRows.filter(r => r.entry.mode === 'lp').length
    console.log(`  ${yr}: OE=${oe} LP=${lp} 합계=${yrRows.length}`)
  }

  // 연도별 처리 기록 업데이트
  updateProgressLog(rows, result)
}

// ─── OE 매칭 헬퍼 ─────────────────────────────────────────────────────────────
function findOeMatch(oeStats: OeStatsFile, playerId: string, team: string): OePlayerEntry | null {
  // 시도 1: playerId.lower + team.lower (exact)
  const keys = Object.keys(oeStats)
  const pidLow = playerId.toLowerCase()
  const tmLow  = team.toLowerCase()

  for (const key of keys) {
    const [p, t] = key.split('|')
    if (p === pidLow && t === tmLow) return oeStats[key]
  }
  // 시도 2: playerId.lower만 (팀명 불일치 허용 — 이적 등)
  const byPid = keys.filter(k => k.split('|')[0] === pidLow)
  if (byPid.length === 1) return oeStats[byPid[0]]

  return null
}

// ─── progress_log.md 업데이트 ─────────────────────────────────────────────────
function updateProgressLog(
  rows: Array<{ pid: string; year: number; lc: string; role: string; cur: number | undefined; entry: FinalStatEntry }>,
  result: FinalStatsFile
): void {
  const logPath = path.join(process.cwd(), 'progress_log.md')
  if (!fs.existsSync(logPath)) return

  const lines: string[] = []
  lines.push('\n### [2016~2018] 포지션별 정규화 현황 — 04e-ovr-final 결과')

  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP']
  for (const yr of [2016, 2017, 2018]) {
    for (const role of roles) {
      const grp = rows.filter(r => r.year === yr && r.role === role)
      const oe = grp.filter(r => r.entry.mode === 'oe').length
      const lp = grp.filter(r => r.entry.mode === 'lp').length
      const bonuses = grp.map(r => r.entry.statsBonus)
      const avg = bonuses.length ? (bonuses.reduce((a, b) => a + b, 0) / bonuses.length).toFixed(2) : '-'
      lines.push(`${role} ${yr}: OE=${oe} LP=${lp} 평균bonus=${avg}`)
    }
  }

  const logContent = fs.readFileSync(logPath, 'utf-8')
  const marker = '## [2016~2018] 포지션별 정규화 현황'
  if (logContent.includes(marker)) {
    const updated = logContent.replace(
      /## \[2016~2018\] 포지션별 정규화 현황[\s\S]*?(?=\n---|\n##|$)/,
      `## [2016~2018] 포지션별 정규화 현황\n\n${lines.join('\n')}\n`
    )
    fs.writeFileSync(logPath, updated, 'utf-8')
  }
}

main().catch(e => { process.stderr.write(`Fatal: ${e}\n`); process.exit(1) })
