// Oracle's Elixir XLSX 파싱 → pipeline-cache/oe/oe-stats-{year}.json
//
// OE XLSX 컬럼(실제 확인 기준):
//   position(10), player(11), team(12), league(2), split(3), date(4),
//   k(21), d(22), a(23), teamkills(24), gamelength(19),
//   dmgtochamps(61), dmgtochampsperminute(62), earnedgoldshare(64),
//   gdat15(≈85), csdat15(≈97), xpdat10(≈90)
//
// 출력 key: "${player.toLowerCase()}|${team}|${year}|${league}"
// 대상 리그: LCK, LPL, LEC/EULCS, LCS/NALCS

import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const OE_DIR = path.join(process.cwd(), 'pipeline-cache', 'oe')

// OE 리그명 → 내부 leagueCode 매핑
const LEAGUE_MAP: Record<string, string> = {
  'LCK': 'LCK',
  'LPL': 'LPL',
  'LEC': 'LEC',
  'EULCS': 'LEC',
  'EU LCS': 'LEC',
  'Europe': 'LEC',
  'LCS': 'LCS',
  'NALCS': 'LCS',
  'NA LCS': 'LCS',
  'North America': 'LCS',
}

// OE position → 내부 Role 매핑
const ROLE_MAP: Record<string, string> = {
  'Top': 'TOP',
  'Jungle': 'JGL',
  'Mid': 'MID',
  'Middle': 'MID',  // 2016~2018 XLSX 실제 컬럼값
  'ADC': 'ADC',
  'Bot': 'ADC',
  'Support': 'SUP',
  'Support ': 'SUP',
}

export type OePlayerEntry = {
  playerName: string
  team: string
  year: number
  leagueCode: string
  role: string
  n: number            // 경기 수
  avgKills: number
  avgDeaths: number
  avgAssists: number
  avgTeamKills: number
  avgDmgtochamps: number
  avgDpm: number
  avgEarnedGoldShare: number
  avgGdat15: number    // gold diff at 15 (null → 0)
  avgCsdat15: number   // cs diff at 15 (csdat15 or csdat10 폴백)
  avgXpdat10: number   // xp diff at 10
  gdat15Coverage: number  // gdat15 있는 경기 비율 (0~1)
}

export type OeStatsFile = Record<string, OePlayerEntry>  // key: "player|team|year|lc"

// XLSX 한 파일을 로드해 OePlayerEntry 맵으로 반환
function parseXlsx(filePath: string, forceYear?: number): OeStatsFile {
  console.log(`  파싱: ${path.basename(filePath)}`)
  const wb = XLSX.read(fs.readFileSync(filePath))
  const sh = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sh)

  // 컬럼 인덱스 사전 확인 (첫 행 헤더 기반이 아닌 키 기반)
  const acc = new Map<string, {
    k: number[]; d: number[]; a: number[]; tk: number[]; dmg: number[]; dpm: number[]
    gs: number[]; gd15: number[]; cd15: number[]; xd10: number[]
    lc: string; role: string; playerName: string; team: string; year: number
  }>()

  let skipped = 0

  for (const row of rows) {
    const pos = row['position']?.toString() ?? ''
    if (pos === 'Team' || pos === '') { skipped++; continue }

    const lc = LEAGUE_MAP[row['league']?.toString() ?? '']
    if (!lc) continue  // 비주요 리그 skip

    const playerName = row['player']?.toString()?.trim() ?? ''
    const team = row['team']?.toString()?.trim() ?? ''
    if (!playerName || !team) continue

    const role = ROLE_MAP[pos] ?? ''
    if (!role) continue

    // 연도 파생: 파일명에서 추출하거나 date 필드 사용
    let year = forceYear ?? 0
    if (!year) {
      const dateStr = row['date']?.toString() ?? ''
      const m = dateStr.match(/\d{4}/)
      year = m ? parseInt(m[0]) : 0
    }
    if (!year) continue

    const k   = parseFloat(row['k']?.toString() ?? '0') || 0
    const d   = parseFloat(row['d']?.toString() ?? '0') || 0
    const a   = parseFloat(row['a']?.toString() ?? '0') || 0
    const tk  = parseFloat(row['teamkills']?.toString() ?? '0') || 0
    const dmg = parseFloat(row['dmgtochamps']?.toString() ?? '0') || 0
    const dpm = parseFloat(row['dmgtochampsperminute']?.toString() ?? '0') || 0
    const gs  = parseFloat(row['earnedgoldshare']?.toString() ?? '0') || 0

    // at-15 diff: 필드 없으면 0 (2016은 csdat10 폴백)
    const gd15Raw = row['gdat15']?.toString()
    const gd15  = gd15Raw !== undefined && gd15Raw !== '' ? parseFloat(gd15Raw) || 0 : NaN
    const cd15Raw = row['csdat15']?.toString() ?? row['csdat10']?.toString()
    const cd15  = cd15Raw !== undefined && cd15Raw !== '' ? parseFloat(cd15Raw) || 0 : 0
    const xd10Raw = row['xpdat10']?.toString()
    const xd10  = xd10Raw !== undefined && xd10Raw !== '' ? parseFloat(xd10Raw) || 0 : 0

    const key = `${playerName.toLowerCase()}|${team}|${year}|${lc}`

    if (!acc.has(key)) {
      acc.set(key, {
        k: [], d: [], a: [], tk: [], dmg: [], dpm: [],
        gs: [], gd15: [], cd15: [], xd10: [],
        lc, role, playerName, team, year,
      })
    }
    const e = acc.get(key)!
    e.k.push(k); e.d.push(d); e.a.push(a); e.tk.push(tk)
    e.dmg.push(dmg); e.dpm.push(dpm); e.gs.push(gs)
    if (!isNaN(gd15)) e.gd15.push(gd15)
    e.cd15.push(cd15); e.xd10.push(xd10)
  }

  console.log(`    skip(Team행): ${skipped}, 유효 경기 집계: ${acc.size}개 선수×팀`)

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  const result: OeStatsFile = {}
  for (const [key, e] of acc) {
    if (e.k.length < 3) continue  // 3경기 미만 skip
    result[key] = {
      playerName: e.playerName,
      team: e.team,
      year: e.year,
      leagueCode: e.lc,
      role: e.role,
      n: e.k.length,
      avgKills:          parseFloat(avg(e.k).toFixed(3)),
      avgDeaths:         parseFloat(avg(e.d).toFixed(3)),
      avgAssists:        parseFloat(avg(e.a).toFixed(3)),
      avgTeamKills:      parseFloat(avg(e.tk).toFixed(3)),
      avgDmgtochamps:    parseFloat(avg(e.dmg).toFixed(1)),
      avgDpm:            parseFloat(avg(e.dpm).toFixed(2)),
      avgEarnedGoldShare:parseFloat(avg(e.gs).toFixed(4)),
      avgGdat15:         parseFloat(avg(e.gd15).toFixed(1)),
      avgCsdat15:        parseFloat(avg(e.cd15).toFixed(2)),
      avgXpdat10:        parseFloat(avg(e.xd10).toFixed(1)),
      gdat15Coverage:    parseFloat((e.gd15.length / e.k.length).toFixed(3)),
    }
  }
  return result
}

async function main() {
  // 파일 목록 — 연도별 처리
  const files: { path: string; year: number; label: string }[] = [
    { path: path.join(OE_DIR, '2016-complete.xlsx'), year: 2016, label: '2016-complete' },
    { path: path.join(OE_DIR, '2017-complete.xlsx'), year: 2017, label: '2017-complete' },
    // 2018-spring: 다운로드 실패 (oracleselixir.com Cloudflare 차단)
    // 2018-worlds: HTML 에러 페이지 수신 — skip
    { path: path.join(OE_DIR, '2018-spring.xlsx'),   year: 2018, label: '2018-spring' },
    { path: path.join(OE_DIR, '2018-summer.xlsx'),   year: 2018, label: '2018-summer' },
  ]

  // 연도별 통합 맵 (spring + summer + worlds 합산)
  const byYear = new Map<number, OeStatsFile>()

  for (const f of files) {
    if (!fs.existsSync(f.path)) {
      console.log(`파일 없음: ${f.label} — skip`)
      continue
    }
    console.log(`처리: ${f.label}`)
    const parsed = parseXlsx(f.path, f.year)

    if (!byYear.has(f.year)) byYear.set(f.year, {})
    const merged = byYear.get(f.year)!

    // 같은 key가 있으면 경기 수 가중치로 합산
    for (const [key, entry] of Object.entries(parsed)) {
      if (!merged[key]) {
        merged[key] = entry
      } else {
        const existing = merged[key]
        const totalN = existing.n + entry.n
        const w1 = existing.n / totalN
        const w2 = entry.n / totalN
        const weightedAvg = (a: number, b: number) =>
          parseFloat((a * w1 + b * w2).toFixed(4))

        merged[key] = {
          ...existing,
          n: totalN,
          avgKills:           weightedAvg(existing.avgKills, entry.avgKills),
          avgDeaths:          weightedAvg(existing.avgDeaths, entry.avgDeaths),
          avgAssists:         weightedAvg(existing.avgAssists, entry.avgAssists),
          avgTeamKills:       weightedAvg(existing.avgTeamKills, entry.avgTeamKills),
          avgDmgtochamps:     weightedAvg(existing.avgDmgtochamps, entry.avgDmgtochamps),
          avgDpm:             weightedAvg(existing.avgDpm, entry.avgDpm),
          avgEarnedGoldShare: weightedAvg(existing.avgEarnedGoldShare, entry.avgEarnedGoldShare),
          avgGdat15:          weightedAvg(existing.avgGdat15, entry.avgGdat15),
          avgCsdat15:         weightedAvg(existing.avgCsdat15, entry.avgCsdat15),
          avgXpdat10:         weightedAvg(existing.avgXpdat10, entry.avgXpdat10),
          gdat15Coverage:     weightedAvg(existing.gdat15Coverage, entry.gdat15Coverage),
        }
      }
    }
  }

  // 연도별 JSON 저장
  for (const [year, stats] of byYear) {
    const outPath = path.join(OE_DIR, `oe-stats-${year}.json`)
    fs.writeFileSync(outPath, JSON.stringify(stats, null, 2), 'utf-8')

    const entries = Object.values(stats)
    const leagues = ['LCK', 'LPL', 'LEC', 'LCS']
    const byleague = leagues.map(lc => `${lc}:${entries.filter(e => e.leagueCode === lc).length}`).join(' ')
    const gdat15pct = (entries.filter(e => e.gdat15Coverage > 0.5).length / entries.length * 100).toFixed(1)

    console.log(`\n${year}: ${entries.length}건 저장`)
    console.log(`  리그: [${byleague}]`)
    console.log(`  gdat15 커버리지 50%+ : ${gdat15pct}%`)

    // 샘플 (상위 5건 by avgDpm)
    const top5 = entries.sort((a, b) => b.avgDpm - a.avgDpm).slice(0, 5)
    console.log('  DPM 상위5:')
    for (const e of top5) {
      console.log(`    ${e.playerName} (${e.team} ${e.year} ${e.role}): DPM=${e.avgDpm.toFixed(0)} dmg=${e.avgDmgtochamps.toFixed(0)} gd15=${e.avgGdat15.toFixed(0)} n=${e.n}`)
    }
  }
}

main().catch(e => { process.stderr.write(`Fatal: ${e}\n`); process.exit(1) })
