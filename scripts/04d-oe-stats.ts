// v1.1 OVR 지표 반영 — 2024~2025 담당
// 데이터 소스: Leaguepedia ScoreboardPlayers (04c와 동일 방식, IngameRole 기준)
// 지표: KDA 35% + GoldShare 25% + CS 20% + DamageToChampions 20% (04c와 동일)
// OVR 기여폭: ±8 (다지표, 전 연도 통일 규칙)
// 출력: pipeline-cache/oe-stats-2024-2025.json

import fs from 'fs'
import path from 'path'
import { cargoPaginate, initCargo } from './lib/cargo'
import type { CargoRow } from './lib/cargo'
import type { TournamentEntry } from './01-tournaments'

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

const TARGET_YEARS = [2024, 2025]
const TARGET_LEAGUES = ['LCK', 'LPL', 'LEC', 'LCS']

// OVR 기여폭 — 다지표 ±7 (전 연도 통일)
const OVR_CAP = 7
const Z_SCALE = 3.0  // z=±1.5 → ±4.5점, clamp ±7

// IngameRole 정규화
const ROLE_NORM: Record<string, string> = {
  top: 'TOP', Top: 'TOP',
  jungle: 'JGL', Jungle: 'JGL', jgl: 'JGL',
  mid: 'MID', Mid: 'MID',
  bot: 'ADC', Bot: 'ADC', adc: 'ADC', Adc: 'ADC',
  support: 'SUP', Support: 'SUP', sup: 'SUP', Sup: 'SUP',
}

type RawStat = {
  playerId: string  // Link 필드 (Leaguepedia ID)
  team: string
  role: string      // TOP/JGL/MID/ADC/SUP
  year: number
  leagueCode: string
  gameCount: number
  avgKda: number
  avgGoldShare: number
  avgCs: number
  avgDmg: number    // DamageToChampions
}

export type OeStatEntry = {
  key: string       // `${playerId.lower()}|${year}|${team.lower()}`
  playerId: string  // Link 필드 원본
  team: string
  year: number
  leagueCode: string
  role: string
  gameCount: number
  mode: 'B'         // at-15 미수집 — Mode B 고정
  compositeZ: number
  ovrBonus: number
  kdaZ: number
  goldZ: number
  csZ: number
  dmgZ: number
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}
function stdev(arr: number[], mu?: number): number {
  if (arr.length < 2) return 1
  const m = mu ?? mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length) || 1
}

async function collectYear(
  year: number,
  allTours: TournamentEntry[]
): Promise<RawStat[]> {
  const domestic = allTours.filter(
    t => t.year === year && TARGET_LEAGUES.includes(t.leagueCode)
      && t.leagueCode !== 'WORLDS' && t.leagueCode !== 'MSI'
  )

  const byLeague = new Map<string, string[]>()
  for (const t of domestic) {
    if (!byLeague.has(t.leagueCode)) byLeague.set(t.leagueCode, [])
    byLeague.get(t.leagueCode)!.push(t.overviewPage)
  }

  const rows: RawStat[] = []

  for (const [leagueCode, pages] of byLeague) {
    const cacheKey = `oe_stats_${leagueCode}_${year}`
    const quoted = pages.map(p => `"${p.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    const where = `OverviewPage IN (${quoted.join(',')})`

    process.stderr.write(`  ${leagueCode} ${year} (${pages.length}개 대회) 수집 중...\n`)

    let raw: CargoRow[] = []
    try {
      raw = await cargoPaginate(
        {
          tables: 'ScoreboardPlayers',
          fields: [
            'Link',
            'Team',
            'IngameRole',
            'AVG(Kills)=AvgK',
            'AVG(Deaths)=AvgD',
            'AVG(Assists)=AvgA',
            'AVG(Gold)=AvgG',
            'AVG(TeamGold)=AvgTG',
            'AVG(CS)=AvgCS',
            'AVG(DamageToChampions)=AvgDmg',
            'COUNT(GameId)=N',
          ].join(','),
          where,
          group_by: 'Link,Team,IngameRole',
        },
        cacheKey
      )
    } catch (e) {
      process.stderr.write(`  [오류] ${leagueCode} ${year} 쿼리 실패: ${e} — skip\n`)
      continue
    }

    for (const r of raw) {
      const pid = r.Link?.trim()
      const team = r.Team?.trim()
      const rawRole = r.IngameRole?.trim()
      if (!pid || !team || !rawRole || pid === 'ADD') continue

      const n = parseInt(r.N || '0', 10)
      if (n < 3) continue

      const k = parseFloat(r.AvgK || '0')
      const d = parseFloat(r.AvgD || '0')
      const a = parseFloat(r.AvgA || '0')
      const g = parseFloat(r.AvgG || '0')
      const tg = parseFloat(r.AvgTG || '0')
      const cs = parseFloat(r.AvgCS || '0')
      const dmg = parseFloat(r.AvgDmg || '0')

      const role = ROLE_NORM[rawRole]
      if (!role) continue

      const kda = (k + a) / Math.max(d, 0.5)
      const goldShare = tg > 0 ? g / tg : 0

      rows.push({ playerId: pid, team, role, year, leagueCode, gameCount: n, avgKda: kda, avgGoldShare: goldShare, avgCs: cs, avgDmg: dmg })
    }

    await sleep(1100)
  }

  return rows
}

async function main() {
  initCargo()

  const outPath = path.join(process.cwd(), 'pipeline-cache', 'oe-stats-2024-2025.json')
  if (fs.existsSync(outPath)) {
    console.log('oe-stats-2024-2025.json 캐시 존재 — 재실행 불요 (삭제 후 재실행)')
    return
  }

  const toursPath = path.join(process.cwd(), 'pipeline-cache', 'tournaments.json')
  if (!fs.existsSync(toursPath)) throw new Error('tournaments.json 없음')

  const tournaments = JSON.parse(fs.readFileSync(toursPath, 'utf-8')) as TournamentEntry[]

  const allStats: RawStat[] = []
  for (const yr of TARGET_YEARS) {
    process.stderr.write(`\n=== ${yr} 수집 시작 ===\n`)
    const yrStats = await collectYear(yr, tournaments)
    allStats.push(...yrStats)
    console.log(`${yr} 수집: ${yrStats.length}건`)
  }

  console.log(`\n전체 수집: ${allStats.length}건`)

  // ─── 포지션×연도 버킷 z-score ──────────────────────────────────────────────
  const buckets = new Map<string, { kda: number[]; gs: number[]; cs: number[]; dmg: number[] }>()
  for (const s of allStats) {
    const bk = `${s.role}|${s.year}`
    if (!buckets.has(bk)) buckets.set(bk, { kda: [], gs: [], cs: [], dmg: [] })
    const b = buckets.get(bk)!
    b.kda.push(s.avgKda)
    b.gs.push(s.avgGoldShare)
    b.cs.push(s.avgCs)
    b.dmg.push(s.avgDmg)
  }

  // 버킷 통계
  console.log('\n포지션×연도 버킷 통계:')
  for (const [bk, b] of [...buckets.entries()].sort()) {
    const mu = mean(b.kda); const sd = stdev(b.kda, mu)
    console.log(`  ${bk}: n=${b.kda.length}, kda=${mu.toFixed(2)}±${sd.toFixed(2)}`)
  }

  const norms = new Map<string, {
    kdaMu: number; kdaSd: number; gsMu: number; gsSd: number
    csMu: number; csSd: number; dmgMu: number; dmgSd: number
  }>()
  for (const [bk, b] of buckets) {
    const kdaMu = mean(b.kda); const kdaSd = stdev(b.kda, kdaMu)
    const gsMu = mean(b.gs); const gsSd = stdev(b.gs, gsMu)
    const csMu = mean(b.cs); const csSd = stdev(b.cs, csMu)
    const dmgMu = mean(b.dmg); const dmgSd = stdev(b.dmg, dmgMu)
    norms.set(bk, { kdaMu, kdaSd, gsMu, gsSd, csMu, csSd, dmgMu, dmgSd })
  }

  // ─── 복합 z-score + OVR 보너스 ─────────────────────────────────────────────
  const entries: OeStatEntry[] = []

  for (const s of allStats) {
    const bk = `${s.role}|${s.year}`
    const n = norms.get(bk)
    if (!n) continue

    const kdaZ = n.kdaSd > 0 ? (s.avgKda - n.kdaMu) / n.kdaSd : 0
    const gsZ = n.gsSd > 0 ? (s.avgGoldShare - n.gsMu) / n.gsSd : 0
    const csZ = n.csSd > 0 ? (s.avgCs - n.csMu) / n.csSd : 0
    const dmgZ = n.dmgSd > 0 ? (s.avgDmg - n.dmgMu) / n.dmgSd : 0

    const compositeZ = 0.35 * kdaZ + 0.25 * gsZ + 0.20 * csZ + 0.20 * dmgZ
    const ovrBonus = Math.max(-OVR_CAP, Math.min(OVR_CAP, Math.round(compositeZ * Z_SCALE)))

    entries.push({
      key: `${s.playerId.toLowerCase()}|${s.year}|${s.team.toLowerCase()}`,
      playerId: s.playerId,
      team: s.team,
      year: s.year,
      leagueCode: s.leagueCode,
      role: s.role,
      gameCount: s.gameCount,
      mode: 'B',
      compositeZ: parseFloat(compositeZ.toFixed(3)),
      ovrBonus,
      kdaZ: parseFloat(kdaZ.toFixed(3)),
      goldZ: parseFloat(gsZ.toFixed(3)),
      csZ: parseFloat(csZ.toFixed(3)),
      dmgZ: parseFloat(dmgZ.toFixed(3)),
    })
  }

  fs.writeFileSync(outPath, JSON.stringify(entries, null, 2))
  console.log(`\noe-stats-2024-2025.json 저장: ${entries.length}건`)

  // ─── 연도별 요약 ────────────────────────────────────────────────────────────
  for (const yr of TARGET_YEARS) {
    const sub = entries.filter(e => e.year === yr)
    const pos = sub.filter(e => e.ovrBonus > 0).length
    const neg = sub.filter(e => e.ovrBonus < 0).length
    const avg = mean(sub.map(e => e.ovrBonus))
    console.log(`  ${yr}: ${sub.length}건 상승=${pos} 하락=${neg} 평균보너스=${avg.toFixed(2)}`)
  }

  // ─── 앵커 검증 ──────────────────────────────────────────────────────────────
  const anchors = [
    { pid: 'Chovy', year: 2024 }, { pid: 'Faker', year: 2024 },
    { pid: 'Gumayusi', year: 2024 }, { pid: 'BeryL', year: 2024 },
    { pid: 'Zeus', year: 2024 }, { pid: 'Oner', year: 2024 },
    { pid: 'Chovy', year: 2025 }, { pid: 'Faker', year: 2025 },
  ]
  console.log('\n앵커 검증:')
  for (const a of anchors) {
    const found = entries.find(e => e.playerId.toLowerCase() === a.pid.toLowerCase() && e.year === a.year)
    if (found) {
      console.log(`  ${found.playerId} ${found.year} ${found.team}: bonus=${found.ovrBonus} (z=${found.compositeZ}, kda=${found.kdaZ}, gs=${found.goldZ}, cs=${found.csZ}, dmg=${found.dmgZ})`)
    } else {
      console.log(`  ${a.pid} ${a.year}: 없음`)
    }
  }

  // ─── 비교표 CSV ─────────────────────────────────────────────────────────────
  const cmpPath = path.join(process.cwd(), 'pipeline-cache', 'ovr-comparison-2024-2025.csv')
  const significant = entries.filter(e => Math.abs(e.ovrBonus) >= 3).sort((a, b) => b.ovrBonus - a.ovrBonus)
  const csvLines = [
    'playerId,year,league,role,team,n,ovrBonus,compositeZ,kdaZ,goldZ,csZ,dmgZ',
    ...significant.map(e =>
      `${e.playerId},${e.year},${e.leagueCode},${e.role},${e.team},${e.gameCount},${e.ovrBonus},${e.compositeZ},${e.kdaZ},${e.goldZ},${e.csZ},${e.dmgZ}`
    )
  ]
  fs.writeFileSync(cmpPath, csvLines.join('\n'))
  console.log(`\novr-comparison-2024-2025.csv 저장: ${significant.length}건 (|bonus|≥3)`)
}

main().catch(e => { process.stderr.write(`Fatal: ${e}\n`); process.exit(1) })
