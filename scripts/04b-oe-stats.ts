// 04b-oe-stats.ts — Oracle's Elixir 2019~2021 개인 지표 집계 + 포지션별 z-score 정규화
// 산출물: pipeline-cache/oe/stats_{year}.json
// 입력: pipeline-cache/oe/{year}.csv (Google Drive 다운로드 완료 필요)
//
// 지표 4종 (가중치 사전 승인됨):
//   KDA 35% + 골드차(golddiffat15) 25% + 라인전(csdiffat15) 20% + 데미지(dpm) 20%
//
// 정규화: 포지션 × 연도 내 z-score (필수 — 포지션 구조 차이 보정)
// 최종 composite z-score: 위 4개 포지션별 z-score의 가중 합산
// OVR 기여폭: ±6점 (z=±1.5 → ±6, scale=4.0)

import fs from 'fs'
import path from 'path'
import readline from 'readline'

// 타겟 리그 (OE 컬럼명 기준)
const TARGET_LEAGUES = new Set(['LCK', 'LPL', 'LEC', 'LCS'])

// 포지션 매핑: OE → 내부 코드
const POS_MAP: Record<string, string> = {
  top: 'TOP',
  jng: 'JGL',
  mid: 'MID',
  bot: 'ADC',
  sup: 'SUP',
}

// 최소 게임 수 (미만이면 집계 제외)
const MIN_GAMES = 5

type PlayerStats = {
  playername: string
  team: string
  year: number
  league: string
  role: string
  games: number
  // 원시 합계 (평균 계산용)
  sumKills: number
  sumDeaths: number
  sumAssists: number
  sumGolddiffat15: number
  sumCsdiffat15: number
  sumDpm: number
  // golddiffat15 유효 게임 수 (null인 게임 제외)
  gamesGolddiff: number
  gamesCsdiff: number
  gamesDpm: number
}

type AggregatedRow = {
  playername: string
  team: string
  year: number
  league: string
  role: string
  games: number
  avgKDA: number
  avgGolddiffat15: number | null  // 데이터 부재 시 null
  avgCsdiffat15: number | null
  avgDpm: number | null
}

type NormalizedRow = AggregatedRow & {
  zKDA: number
  zGolddiff: number
  zCsdiff: number
  zDpm: number
  // 가중 composite z-score
  compositeZ: number
  // OVR 기여 점수 (±6 클램프)
  ovrBonus: number
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function stdev(arr: number[], mu?: number): number {
  if (arr.length < 2) return 1
  const m = mu ?? mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length) || 1
}

async function parseOeCsv(year: number): Promise<PlayerStats[]> {
  const csvPath = path.join(process.cwd(), 'pipeline-cache', 'oe', `${year}.csv`)
  if (!fs.existsSync(csvPath)) {
    console.warn(`[${year}] CSV 없음: ${csvPath}`)
    return []
  }

  const statsMap = new Map<string, PlayerStats>()
  let headerParsed = false
  let cols: Record<string, number> = {}
  let rowCount = 0
  let playerRowCount = 0
  let skippedLeague = 0

  const rl = readline.createInterface({ input: fs.createReadStream(csvPath) })

  for await (const line of rl) {
    if (!headerParsed) {
      const headers = line.split(',')
      headers.forEach((h, i) => { cols[h.trim()] = i })
      headerParsed = true
      // 필수 컬럼 확인
      const required = ['league', 'position', 'playername', 'teamname', 'year',
        'kills', 'deaths', 'assists', 'dpm', 'datacompleteness']
      const missing = required.filter(c => cols[c] === undefined)
      if (missing.length > 0) {
        console.warn(`[${year}] 컬럼 누락: ${missing.join(', ')}`)
      }
      console.log(`[${year}] 헤더 파싱 완료. golddiffat15=${cols['golddiffat15'] ?? 'MISSING'}, csdiffat15=${cols['csdiffat15'] ?? 'MISSING'}`)
      continue
    }

    rowCount++
    const parts = line.split(',')
    const get = (col: string) => parts[cols[col] ?? -1] ?? ''

    // 팀 행 제외 (position = "team" or empty)
    const rawPos = get('position').toLowerCase()
    const role = POS_MAP[rawPos]
    if (!role) continue  // "team" 및 기타 비-선수 행

    // 리그 필터
    const league = get('league')
    if (!TARGET_LEAGUES.has(league)) { skippedLeague++; continue }

    // datacompleteness: 'partial' 행은 제외 (골드차 등 결측 가능)
    const completeness = get('datacompleteness')
    if (completeness === 'partial') continue

    playerRowCount++

    const playername = get('playername').trim()
    const team = get('teamname').trim()
    if (!playername || !team) continue

    const rowYear = parseInt(get('year') || String(year))
    const key = `${playername}|${team}|${rowYear}|${league}|${role}`

    const kills = parseFloat(get('kills')) || 0
    const deaths = parseFloat(get('deaths')) || 0
    const assists = parseFloat(get('assists')) || 0
    const dpmRaw = get('dpm')
    const golddiffRaw = get('golddiffat15')
    const csdiffRaw = get('csdiffat15')

    const dpm = dpmRaw !== '' && !isNaN(parseFloat(dpmRaw)) ? parseFloat(dpmRaw) : null
    const golddiff = golddiffRaw !== '' && !isNaN(parseFloat(golddiffRaw)) ? parseFloat(golddiffRaw) : null
    const csdiff = csdiffRaw !== '' && !isNaN(parseFloat(csdiffRaw)) ? parseFloat(csdiffRaw) : null

    if (!statsMap.has(key)) {
      statsMap.set(key, {
        playername, team, year: rowYear, league, role,
        games: 0,
        sumKills: 0, sumDeaths: 0, sumAssists: 0,
        sumGolddiffat15: 0, sumCsdiffat15: 0, sumDpm: 0,
        gamesGolddiff: 0, gamesCsdiff: 0, gamesDpm: 0,
      })
    }

    const s = statsMap.get(key)!
    s.games++
    s.sumKills += kills
    s.sumDeaths += deaths
    s.sumAssists += assists
    if (golddiff !== null) { s.sumGolddiffat15 += golddiff; s.gamesGolddiff++ }
    if (csdiff !== null) { s.sumCsdiffat15 += csdiff; s.gamesCsdiff++ }
    if (dpm !== null) { s.sumDpm += dpm; s.gamesDpm++ }
  }

  console.log(`[${year}] 총 행=${rowCount}, 선수행=${playerRowCount}, 리그 외 스킵=${skippedLeague}`)
  console.log(`[${year}] 선수-팀-연도 유니크: ${statsMap.size}`)
  return Array.from(statsMap.values())
}

function aggregate(stats: PlayerStats[]): AggregatedRow[] {
  return stats
    .filter(s => s.games >= MIN_GAMES)
    .map(s => {
      const avgKDA = (s.sumKills + s.sumAssists) / Math.max(1, s.sumDeaths) / s.games * s.games
      // KDA는 게임당 평균이 아니라 통산 집계 기준
      const totalKDA = (s.sumKills + s.sumAssists) / Math.max(1, s.sumDeaths)

      return {
        playername: s.playername,
        team: s.team,
        year: s.year,
        league: s.league,
        role: s.role,
        games: s.games,
        avgKDA: totalKDA,
        avgGolddiffat15: s.gamesGolddiff >= MIN_GAMES ? s.sumGolddiffat15 / s.gamesGolddiff : null,
        avgCsdiffat15: s.gamesCsdiff >= MIN_GAMES ? s.sumCsdiffat15 / s.gamesCsdiff : null,
        avgDpm: s.gamesDpm >= MIN_GAMES ? s.sumDpm / s.gamesDpm : null,
      }
    })
}

function normalize(rows: AggregatedRow[]): NormalizedRow[] {
  // 포지션×연도 버킷별 통계 계산 — OE 전체 선수 기준 (우리 DB 제한 없음)
  // 이 버킷이 z-score의 기준이 됨 (§2 요구사항)
  const buckets = new Map<string, { kdas: number[], golds: number[], css: number[], dpms: number[] }>()

  for (const r of rows) {
    const k = `${r.role}|${r.year}`
    if (!buckets.has(k)) buckets.set(k, { kdas: [], golds: [], css: [], dpms: [] })
    const b = buckets.get(k)!
    b.kdas.push(r.avgKDA)
    if (r.avgGolddiffat15 !== null) b.golds.push(r.avgGolddiffat15)
    if (r.avgCsdiffat15 !== null) b.css.push(r.avgCsdiffat15)
    if (r.avgDpm !== null) b.dpms.push(r.avgDpm)
  }

  const normStats = new Map<string, {
    muKda: number; sdKda: number
    muGold: number; sdGold: number
    muCs: number; sdCs: number
    muDpm: number; sdDpm: number
  }>()

  for (const [k, b] of buckets) {
    normStats.set(k, {
      muKda: mean(b.kdas), sdKda: stdev(b.kdas),
      muGold: mean(b.golds), sdGold: stdev(b.golds),
      muCs: mean(b.css), sdCs: stdev(b.css),
      muDpm: mean(b.dpms), sdDpm: stdev(b.dpms),
    })
  }

  // 가중치 (사전 승인됨)
  const W_KDA = 0.35
  const W_GOLD = 0.25
  const W_CS = 0.20
  const W_DPM = 0.20

  return rows.map(r => {
    const k = `${r.role}|${r.year}`
    const ns = normStats.get(k)!

    const zKDA = ns.sdKda > 0 ? (r.avgKDA - ns.muKda) / ns.sdKda : 0

    // 데이터 부재 시 0 (포지션 평균 처리 — 호빈 확인 필요)
    const zGolddiff = r.avgGolddiffat15 !== null && ns.sdGold > 0
      ? (r.avgGolddiffat15 - ns.muGold) / ns.sdGold : 0
    const zCsdiff = r.avgCsdiffat15 !== null && ns.sdCs > 0
      ? (r.avgCsdiffat15 - ns.muCs) / ns.sdCs : 0
    const zDpm = r.avgDpm !== null && ns.sdDpm > 0
      ? (r.avgDpm - ns.muDpm) / ns.sdDpm : 0

    // composite z-score (결측치는 가중치 재분배 없이 0 처리 — 단순화 판단)
    const compositeZ = zKDA * W_KDA + zGolddiff * W_GOLD + zCsdiff * W_CS + zDpm * W_DPM

    // OVR 기여: z=±1.5 → ±6점 (scale=4.0)
    // 기존 KDA ±3 대비 폭 확장 (4개 지표 통합으로 신뢰도 향상)
    const ovrBonus = Math.max(-6, Math.min(6, Math.round(compositeZ * 4.0)))

    return {
      ...r,
      zKDA: Math.round(zKDA * 100) / 100,
      zGolddiff: Math.round(zGolddiff * 100) / 100,
      zCsdiff: Math.round(zCsdiff * 100) / 100,
      zDpm: Math.round(zDpm * 100) / 100,
      compositeZ: Math.round(compositeZ * 100) / 100,
      ovrBonus,
    }
  })
}

async function processYear(year: number) {
  const outPath = path.join(process.cwd(), 'pipeline-cache', 'oe', `stats_${year}.json`)
  if (fs.existsSync(outPath)) {
    console.log(`[${year}] stats_${year}.json 이미 존재 — 덮어씀`)
  }

  console.log(`\n=== ${year} 처리 시작 ===`)
  const raw = await parseOeCsv(year)
  if (raw.length === 0) {
    console.log(`[${year}] 데이터 없음 — 스킵`)
    return
  }

  const agg = aggregate(raw)
  console.log(`[${year}] 집계 완료: ${raw.length}건 → ${agg.length}건 (${MIN_GAMES}게임 이상)`)

  const norm = normalize(agg)
  fs.writeFileSync(outPath, JSON.stringify(norm, null, 2), 'utf-8')

  // 요약 출력
  const topPlayers = norm
    .sort((a, b) => b.compositeZ - a.compositeZ)
    .slice(0, 10)

  console.log(`[${year}] TOP 10 composite z-score:`)
  topPlayers.forEach(p => {
    console.log(`  ${p.playername.padEnd(20)} ${p.role.padEnd(4)} ${p.team.padEnd(25)} z=${p.compositeZ.toFixed(2)} ovrBonus=${p.ovrBonus > 0 ? '+' : ''}${p.ovrBonus}`)
  })

  // 포지션별 샘플 커버리지
  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP']
  console.log(`[${year}] 포지션별 선수 수:`)
  roles.forEach(r => {
    const cnt = norm.filter(x => x.role === r).length
    const golddiffCoverage = norm.filter(x => x.role === r && x.avgGolddiffat15 !== null).length
    console.log(`  ${r}: ${cnt}명 (golddiff 커버리지: ${golddiffCoverage}/${cnt})`)
  })

  console.log(`[${year}] ovrBonus 분포: -6~-4: ${norm.filter(x=>x.ovrBonus<=-4).length}, -3~-1: ${norm.filter(x=>x.ovrBonus>=-3&&x.ovrBonus<=-1).length}, 0: ${norm.filter(x=>x.ovrBonus===0).length}, 1~3: ${norm.filter(x=>x.ovrBonus>=1&&x.ovrBonus<=3).length}, 4~6: ${norm.filter(x=>x.ovrBonus>=4).length}`)
  console.log(`[${year}] 저장: ${outPath}`)
}

async function main() {
  const years = [2019, 2020, 2021]
  for (const yr of years) {
    await processYear(yr)
  }
  console.log('\n전체 완료')
}

main().catch(e => { process.stderr.write(`Fatal: ${e}\n`); process.exit(1) })
