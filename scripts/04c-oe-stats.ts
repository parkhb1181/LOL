// v1.1 OVR 지표 확장 — Leaguepedia ScoreboardPlayers 기반 (OE 자동 다운로드 불가 대체)
// 담당 연도: 2022~2023
//
// [이슈] 2026-06-13
// - Oracle's Elixir(oracleselixir.com) 전체 403 차단 → 자동 다운로드 불가
// - S3 직접 URL(oracleselixir-downloadable-match-data.s3-us-west-2.amazonaws.com) 404
// - Leaguepedia ScoreboardPlayers에 golddiffat15/xpdiffat15/csdiffat15 없음
// - 대안: KDA + GoldShare + CS + Damage 4지표 (Leaguepedia 가용)
// - 라인전 지표: golddiffat15 대신 CS per game 포지션 정규화 사용 (호빈 검토 요망)
//
// 출력:
//   pipeline-cache/oe-stats-2022-2023.json  — 원시 집계 + z-score
//   pipeline-cache/oe-comparison-2022-2023.json — players.json 대비 OVR 변화 비교표

import fs from 'fs'
import path from 'path'
import { cargoPaginate, initCargo } from './lib/cargo'
import type { CargoRow } from './lib/cargo'
import type { TournamentEntry } from './01-tournaments'

const TARGET_YEARS = [2022, 2023]

// Leaguepedia IngameRole → 표준 역할코드
const ROLE_NORM: Record<string, string> = {
  top: 'TOP', Top: 'TOP',
  jungle: 'JGL', Jungle: 'JGL', jgl: 'JGL',
  mid: 'MID', Mid: 'MID',
  bot: 'ADC', Bot: 'ADC', adc: 'ADC', Adc: 'ADC',
  support: 'SUP', Support: 'SUP', sup: 'SUP', Sup: 'SUP',
}
function normRole(raw: string): string {
  return ROLE_NORM[raw] ?? raw.toUpperCase()
}

type RawStat = {
  playerId: string
  team: string
  role: string
  year: number
  gameCount: number
  avgKda: number
  avgGoldShare: number
  avgCs: number
  avgDmg: number
}

type ScoredStat = RawStat & {
  kdaZ: number
  goldZ: number
  csZ: number
  dmgZ: number
  statScore: number   // 합성 z-score (KDA 35% + Gold 25% + CS 20% + Dmg 20%)
  ovrAdjust: number   // 기여폭 — z=±1.5 → ±4.5, 클램프 ±7 (§9 파라미터)
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
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
    t => t.year === year && t.leagueCode !== 'WORLDS' && t.leagueCode !== 'MSI'
  )

  // 리그별 분할 쿼리 (§4.1)
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
      process.stderr.write(`  [이슈] ${leagueCode} ${year} 쿼리 실패: ${e} — skip\n`)
      continue
    }

    for (const r of raw) {
      const pid = r.Link?.trim()
      const team = r.Team?.trim()
      const rawRole = r.IngameRole?.trim()
      if (!pid || !team || !rawRole || pid === 'ADD') continue

      const n = parseInt(r.N || '0', 10)
      if (n < 3) continue  // 3경기 미만 제외

      const k = parseFloat(r.AvgK || '0')
      const d = parseFloat(r.AvgD || '0')
      const a = parseFloat(r.AvgA || '0')
      const g = parseFloat(r.AvgG || '0')
      const tg = parseFloat(r.AvgTG || '0')
      const cs = parseFloat(r.AvgCS || '0')
      const dmg = parseFloat(r.AvgDmg || '0')

      const role = normRole(rawRole)
      const kda = (k + a) / Math.max(d, 0.5)
      const goldShare = tg > 0 ? g / tg : 0

      rows.push({ playerId: pid, team, role, year, gameCount: n, avgKda: kda, avgGoldShare: goldShare, avgCs: cs, avgDmg: dmg })
    }
  }

  return rows
}

function computeZScores(stats: RawStat[]): ScoredStat[] {
  // 포지션 × 연도별 버킷 구성
  const buckets = new Map<string, { kda: number[]; gold: number[]; cs: number[]; dmg: number[] }>()

  for (const s of stats) {
    const k = `${s.role}|${s.year}`
    if (!buckets.has(k)) buckets.set(k, { kda: [], gold: [], cs: [], dmg: [] })
    const b = buckets.get(k)!
    b.kda.push(s.avgKda)
    b.gold.push(s.avgGoldShare)
    b.cs.push(s.avgCs)
    b.dmg.push(s.avgDmg)
  }

  // 정규화 파라미터
  const norms = new Map<string, { kda: { mu: number; sd: number }; gold: { mu: number; sd: number }; cs: { mu: number; sd: number }; dmg: { mu: number; sd: number } }>()
  for (const [k, b] of buckets) {
    norms.set(k, {
      kda: { mu: mean(b.kda), sd: stdev(b.kda) },
      gold: { mu: mean(b.gold), sd: stdev(b.gold) },
      cs: { mu: mean(b.cs), sd: stdev(b.cs) },
      dmg: { mu: mean(b.dmg), sd: stdev(b.dmg) },
    })
  }

  return stats.map(s => {
    const n = norms.get(`${s.role}|${s.year}`)
    if (!n) return { ...s, kdaZ: 0, goldZ: 0, csZ: 0, dmgZ: 0, statScore: 0, ovrAdjust: 0 }

    const kdaZ = n.kda.sd > 0 ? (s.avgKda - n.kda.mu) / n.kda.sd : 0
    const goldZ = n.gold.sd > 0 ? (s.avgGoldShare - n.gold.mu) / n.gold.sd : 0
    const csZ = n.cs.sd > 0 ? (s.avgCs - n.cs.mu) / n.cs.sd : 0
    const dmgZ = n.dmg.sd > 0 ? (s.avgDmg - n.dmg.mu) / n.dmg.sd : 0

    // 합성 z-score: KDA 35% + GoldShare 25% + CS 20% + Damage 20%
    const statScore = 0.35 * kdaZ + 0.25 * goldZ + 0.20 * csZ + 0.20 * dmgZ

    // scale 3.0 → z=±1.5 ≈ ±4.5점, 다지표 시즌 클램프 ±8 (전 연도 통일 규칙)
    const ovrAdjust = Math.max(-8, Math.min(8, Math.round(statScore * 3.0)))

    return { ...s, kdaZ: +kdaZ.toFixed(3), goldZ: +goldZ.toFixed(3), csZ: +csZ.toFixed(3), dmgZ: +dmgZ.toFixed(3), statScore: +statScore.toFixed(3), ovrAdjust }
  })
}

async function main() {
  initCargo()

  const outRaw = path.join(process.cwd(), 'pipeline-cache', 'oe-stats-2022-2023.json')
  const outCmp = path.join(process.cwd(), 'pipeline-cache', 'oe-comparison-2022-2023.json')

  if (fs.existsSync(outRaw) && fs.existsSync(outCmp)) {
    console.log('캐시 존재 — 재실행 불요 (outRaw/outCmp 삭제 후 재실행)')
    return
  }

  const toursPath = path.join(process.cwd(), 'pipeline-cache', 'tournaments.json')
  if (!fs.existsSync(toursPath)) throw new Error('tournaments.json 없음')
  const allTours = JSON.parse(fs.readFileSync(toursPath, 'utf-8')) as TournamentEntry[]

  const allRaw: RawStat[] = []
  for (const year of TARGET_YEARS) {
    process.stderr.write(`\n=== ${year} 수집 시작 ===\n`)
    const rows = await collectYear(year, allTours)
    allRaw.push(...rows)
    process.stderr.write(`  ${year} 완료: ${rows.length}건\n`)
  }

  const scored = computeZScores(allRaw)
  fs.writeFileSync(outRaw, JSON.stringify(scored, null, 2), 'utf-8')
  console.log(`\noe-stats-2022-2023.json 저장: ${scored.length}건`)

  // 포지션×연도 표본 수
  console.log('\n[포지션별 표본 수]')
  for (const year of TARGET_YEARS) {
    for (const role of ['TOP', 'JGL', 'MID', 'ADC', 'SUP']) {
      const cnt = scored.filter(s => s.year === year && s.role === role).length
      console.log(`  ${year} ${role}: ${cnt}명`)
    }
  }

  // ── 비교표 생성 ──────────────────────────────────────────────
  const playersPath = path.join(process.cwd(), 'public', 'data', 'players.json')
  if (!fs.existsSync(playersPath)) {
    process.stderr.write('[이슈] players.json 없음 — 비교표 생성 skip\n')
    return
  }

  const players = JSON.parse(fs.readFileSync(playersPath, 'utf-8')) as Array<{
    playerId: string; team: string; year: number; role: string; ovr: number; nameEn: string
  }>

  // 매칭 키: playerId(lower) | year | team(lower)
  // 동일 키에 복수 행(이적 등)이면 gameCount 최대 우선
  const byKey = new Map<string, ScoredStat>()
  for (const s of scored) {
    const k = `${s.playerId.toLowerCase()}|${s.year}|${s.team.toLowerCase()}`
    const ex = byKey.get(k)
    if (!ex || s.gameCount > ex.gameCount) byKey.set(k, s)
  }

  type CmpRow = {
    playerId: string; nameEn: string; team: string; year: number; role: string
    ovrNow: number; ovrAdjust: number; ovrNew: number
    kdaZ: number; goldZ: number; csZ: number; dmgZ: number; statScore: number
    gameCount: number; matched: boolean
  }

  const cmp: CmpRow[] = []
  for (const p of players.filter(p => TARGET_YEARS.includes(p.year))) {
    const k = `${p.playerId.toLowerCase()}|${p.year}|${p.team.toLowerCase()}`
    const s = byKey.get(k)

    if (s) {
      cmp.push({
        playerId: p.playerId, nameEn: p.nameEn, team: p.team, year: p.year, role: p.role,
        ovrNow: p.ovr,
        ovrAdjust: s.ovrAdjust,
        ovrNew: Math.max(75, Math.min(99, p.ovr + s.ovrAdjust)),
        kdaZ: s.kdaZ, goldZ: s.goldZ, csZ: s.csZ, dmgZ: s.dmgZ, statScore: s.statScore,
        gameCount: s.gameCount, matched: true,
      })
    } else {
      cmp.push({
        playerId: p.playerId, nameEn: p.nameEn, team: p.team, year: p.year, role: p.role,
        ovrNow: p.ovr, ovrAdjust: 0, ovrNew: p.ovr,
        kdaZ: 0, goldZ: 0, csZ: 0, dmgZ: 0, statScore: 0,
        gameCount: 0, matched: false,
      })
    }
  }

  // 변화폭 내림차순 정렬
  cmp.sort((a, b) => Math.abs(b.ovrAdjust) - Math.abs(a.ovrAdjust))
  fs.writeFileSync(outCmp, JSON.stringify(cmp, null, 2), 'utf-8')

  const matched = cmp.filter(c => c.matched).length
  const up = cmp.filter(c => c.ovrAdjust > 0).length
  const dn = cmp.filter(c => c.ovrAdjust < 0).length
  const unch = cmp.filter(c => c.ovrAdjust === 0 && c.matched).length

  console.log(`\n비교표: ${cmp.length}명 (매칭 ${matched} / 미매칭 ${cmp.length - matched})`)
  console.log(`  상승 ${up} / 하락 ${dn} / 유지 ${unch}`)

  console.log('\n[크게 오른 선수 TOP 10]')
  cmp.filter(c => c.ovrAdjust > 0).slice(0, 10).forEach(c => {
    console.log(`  ${c.nameEn} ${c.year} (${c.role}) ${c.ovrNow}→${c.ovrNew} (+${c.ovrAdjust}) stat=${c.statScore}`)
  })

  console.log('\n[크게 내린 선수 TOP 10]')
  cmp.filter(c => c.ovrAdjust < 0).slice(0, 10).forEach(c => {
    console.log(`  ${c.nameEn} ${c.year} (${c.role}) ${c.ovrNow}→${c.ovrNew} (${c.ovrAdjust}) stat=${c.statScore}`)
  })

  console.log('\n[미매칭 (데이터 없음)]')
  cmp.filter(c => !c.matched).forEach(c => {
    console.log(`  ${c.nameEn} ${c.year} (${c.role}): ovr=${c.ovrNow}`)
  })
}

main().catch(e => { process.stderr.write(`Fatal: ${e}\n`); process.exit(1) })
