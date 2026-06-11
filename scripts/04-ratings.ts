// Phase 1: 레이팅 산출 — §4.3 공식 + awards.csv 병합
// 입력: rosters.json, results.json, awards.csv

import fs from 'fs'
import path from 'path'
import type { RosterEntry, RostersFile } from './02-rosters'
import type { ResultEntry } from './03-results'

// 팀명 정규화 — ScoreboardPlayers vs TournamentResults 불일치 해소
// 2013 SKT T1 분리 시대: ScoreboardPlayers="SK Telecom T1 2", TournamentResults="SK Telecom T1"
const TEAM_ALIASES: Record<string, string> = {
  'SK Telecom T1 2': 'SK Telecom T1',
}
function normalizeTeam(t: string): string { return TEAM_ALIASES[t] ?? t }

// §3 스키마와 일치하는 중간 출력 (photo는 Phase 2에서 채움)
export type RatedEntry = {
  playerId: string
  nameEn: string
  nameKo: string | null
  team: string
  year: number
  leagueCode: string
  role: string
  ovr: number
  frame: 'WORLDS' | 'NORMAL'
  crown: boolean
  msiWinner: boolean
  badges: ('LEAGUE_CHAMP' | 'ALLPRO_1ST')[]
}

type AwardRow = {
  playerId: string
  year: number
  league: string
  award: string
  value: number
}

function parseAwardsCsv(csv: string): AwardRow[] {
  const lines = csv.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  // header: playerId,year,league,award,value
  return lines.slice(1).map(line => {
    const cols = line.split(',')
    return {
      playerId: cols[0] ?? '',
      year: parseInt(cols[1] ?? '0', 10),
      league: cols[2] ?? '',
      award: cols[3] ?? '',
      value: parseFloat(cols[4] ?? '0') || 0,
    }
  }).filter(r => r.playerId && r.year > 0 && r.award)
}

// §4.3 레이팅 공식 (§6.1 룰 패치 반영)
// Rule 1: 연내 복수 스플릿 가점 합산 — 최고 1회 아님
// Rule 4: AllPro 2020+ 시즌만 (제도 부재 이전 미적용)
function calcOvr(params: {
  playoffPlaces: number[]   // 연내 플옵 결과 전부 (합산 적용)
  msiPlace: number | null
  worldsPlace: number | null
  awards: AwardRow[]
}): number {
  let score = 60

  // 국내 플옵 — 스플릿별 합산 (Rule 1)
  for (const p of params.playoffPlaces) {
    if (p === 1) score += 8
    else if (p === 2) score += 5
    else if (p <= 4) score += 2
    else if (p <= 6) score += 1
    else score += 1
  }

  // MSI
  if (params.msiPlace !== null) {
    const p = params.msiPlace
    if (p === 1) score += 5
    else if (p === 2) score += 3
    else if (p <= 4) score += 2
  }

  // Worlds
  if (params.worldsPlace !== null) {
    const p = params.worldsPlace
    if (p === 1) score += 13
    else if (p === 2) score += 8
    else if (p <= 4) score += 5
    else if (p <= 8) score += 3
    else score += 1  // 진출만
  }

  // awards (Rule 4: AllPro는 2020+ 시즌만)
  for (const a of params.awards) {
    if (a.award === 'SEASON_MVP') score += 6
    else if (a.award === 'FINALS_MVP') score += 4
    else if (a.award === 'WORLDS_MVP') score += 8
    else if (a.award === 'ALLPRO_1ST' && a.year >= 2020) score += 5
    else if (a.award === 'ALLPRO_2ND' && a.year >= 2020) score += 3
    else if (a.award === 'ALLPRO_3RD' && a.year >= 2020) score += 1
    else if (a.award === 'EDITORIAL') score += a.value
  }

  return Math.max(60, Math.min(99, Math.round(score)))
}

// OVR 범위 압축 60~99 → 75~99 (선형 변환)
// 하한 75로 낮춰 78~80 밀집 완화 (격차 최대 24)
function compressOvr(raw: number): number {
  const clamped = Math.max(60, Math.min(99, raw))
  return Math.max(75, Math.min(99, Math.round(75 + (clamped - 60) * 24 / 39)))
}

// 개인 성능 지표 (pipeline-cache/stats.json에서 로드)
type PlayerStats = {
  gameCount: number
  avgKda: number
  avgKp: number
  avgGoldShare: number
  avgDmg: number       // raw AVG(DamageToChampions) — 포지션별 정규화로 비교
  hasStats: boolean
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}
function stdev(arr: number[], mu?: number): number {
  if (arr.length < 2) return 1
  const m = mu ?? mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length) || 1
}

async function main() {
  const outPath = path.join(process.cwd(), 'pipeline-cache', 'ratings.json')
  if (fs.existsSync(outPath)) {
    console.log('ratings.json 캐시 존재 — 재실행 불요')
    return
  }

  const rostersPath = path.join(process.cwd(), 'pipeline-cache', 'rosters.json')
  const resultsPath = path.join(process.cwd(), 'pipeline-cache', 'results.json')
  const awardsPath = path.join(process.cwd(), 'pipeline-input', 'awards.csv')

  if (!fs.existsSync(rostersPath)) throw new Error('rosters.json 없음')
  if (!fs.existsSync(resultsPath)) throw new Error('results.json 없음')

  const { players, entries }: RostersFile = JSON.parse(fs.readFileSync(rostersPath, 'utf-8'))
  const results: ResultEntry[] = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'))
  const awardsCsv = fs.existsSync(awardsPath) ? fs.readFileSync(awardsPath, 'utf-8') : ''
  const allAwards = parseAwardsCsv(awardsCsv)

  // 개인 성능 지표 로드 (04b-stats.ts 미실행 시 보정 없이 진행)
  const statsPath = path.join(process.cwd(), 'pipeline-cache', 'stats.json')
  const statsFile: Record<string, PlayerStats> = fs.existsSync(statsPath)
    ? JSON.parse(fs.readFileSync(statsPath, 'utf-8'))
    : {}
  const hasIndivStats = Object.keys(statsFile).length > 0
  if (!hasIndivStats) {
    console.warn('stats.json 없음 — 개인 보정 없이 진행 (04b-stats.ts 먼저 실행 권장)')
  }

  // 포지션별 지표 분포 수집 (포지션 정규화 z-score용)
  // entries를 순회하며 실값 있는 선수만 포함 (gameCount >= 3)
  const roleBufs: Record<string, { kdas: number[]; kps: number[]; golds: number[]; dmgs: number[] }> = {
    TOP: { kdas: [], kps: [], golds: [], dmgs: [] },
    JGL: { kdas: [], kps: [], golds: [], dmgs: [] },
    MID: { kdas: [], kps: [], golds: [], dmgs: [] },
    ADC: { kdas: [], kps: [], golds: [], dmgs: [] },
    SUP: { kdas: [], kps: [], golds: [], dmgs: [] },
  }
  for (const e of entries) {
    const sk = `${e.playerId.toLowerCase()}|${e.year}|${e.team}`
    const s = statsFile[sk]
    if (!s?.hasStats || s.gameCount < 3) continue
    const buf = roleBufs[e.role]
    if (!buf) continue
    buf.kdas.push(s.avgKda)
    buf.kps.push(s.avgKp)
    buf.golds.push(s.avgGoldShare)
    buf.dmgs.push(s.avgDmg)
  }

  type RoleNorm = { mk: number; sk: number; mp: number; sp: number; mg: number; sg: number; md: number; sd: number }
  const roleNorm: Record<string, RoleNorm> = {}
  for (const [role, buf] of Object.entries(roleBufs)) {
    const mk = mean(buf.kdas), mp = mean(buf.kps), mg = mean(buf.golds), md = mean(buf.dmgs)
    roleNorm[role] = {
      mk, sk: stdev(buf.kdas, mk),
      mp, sp: stdev(buf.kps, mp),
      mg, sg: stdev(buf.golds, mg),
      md, sd: stdev(buf.dmgs, md),
    }
  }

  // 빠른 조회를 위한 인덱스
  // resultsByTeamYear: `${team}|${year}|${leagueCode}` → 플옵/Worlds/MSI 결과 배열
  const resultsByTeamYear = new Map<string, ResultEntry[]>()
  for (const r of results) {
    const k = `${r.team}|${r.year}|${r.leagueCode}`
    if (!resultsByTeamYear.has(k)) resultsByTeamYear.set(k, [])
    resultsByTeamYear.get(k)!.push(r)
  }

  // Worlds/MSI 결과 인덱스: `${team}|${year}` → place (Worlds), `${team}|${year}` → place (MSI)
  const worldsByTeamYear = new Map<string, number>()
  const msiByTeamYear = new Map<string, number>()
  for (const r of results) {
    const k = `${r.team}|${r.year}`
    if (r.leagueCode === 'WORLDS') {
      // Regional Finals 제외 — "Korea/Garena/SEA Regional Finals" 등 place=1이 지역 예선 우승(Worlds 우승 아님)
      if (!r.overviewPage.includes('World Championship')) continue
      const existing = worldsByTeamYear.get(k)
      if (existing === undefined || r.place < existing) worldsByTeamYear.set(k, r.place)
    } else if (r.leagueCode === 'MSI') {
      const existing = msiByTeamYear.get(k)
      if (existing === undefined || r.place < existing) msiByTeamYear.set(k, r.place)
    }
  }

  // awards 인덱스: `${playerId}|${year}` → AwardRow[]
  const awardsByPY = new Map<string, AwardRow[]>()
  for (const a of allAwards) {
    const k = `${a.playerId}|${a.year}`
    if (!awardsByPY.has(k)) awardsByPY.set(k, [])
    awardsByPY.get(k)!.push(a)
  }

  const rated: RatedEntry[] = []

  for (const entry of entries) {
    const { playerId, team, year, leagueCode, role } = entry
    const playerMeta = players[playerId]
    const nameEn = playerMeta?.nameEn ?? playerId
    const nameKo = playerMeta?.nameKo ?? null

    // 국내 플옵 — 연내 전체 플옵 결과 수집 (Rule 1: 합산)
    const domesticKey = `${team}|${year}|${leagueCode}`
    const domesticResults = resultsByTeamYear.get(domesticKey) ?? []
    const playoffPlaces = domesticResults.filter(r => r.isPlayoffs).map(r => r.place)

    // Worlds/MSI (팀명 정규화 후 매칭 — ScoreboardPlayers vs TournamentResults 불일치 해소)
    const normalizedTeam = normalizeTeam(team)
    const teamYearKey = `${normalizedTeam}|${year}`
    const worldsPlace = worldsByTeamYear.get(teamYearKey) ?? null
    const msiPlace = msiByTeamYear.get(teamYearKey) ?? null

    const awards = awardsByPY.get(`${playerId}|${year}`) ?? []
    const rawOvr = calcOvr({ playoffPlaces, msiPlace, worldsPlace, awards })
    const baseOvr = compressOvr(rawOvr)

    // 개인 성능 보정: 포지션 z-score → ±3 (99 희소성 보호: 기존 99 불변, 非99 상한 98)
    let individualBonus = 0
    const sk = `${playerId.toLowerCase()}|${year}|${team}`
    const s = statsFile[sk]
    if (s?.hasStats && s.gameCount >= 3) {
      const n = roleNorm[role]
      if (n) {
        const zK = (s.avgKda - n.mk) / n.sk
        const zP = (s.avgKp - n.mp) / n.sp
        const zG = (s.avgGoldShare - n.mg) / n.sg
        const zD = (s.avgDmg - n.md) / n.sd

        // 포지션별 가중치 — SUP은 KDA·KP 중심(딜·골드 낮아도 불이익 최소화)
        const composite = role === 'SUP'
          ? zK * 0.35 + zP * 0.45 + zG * 0.10 + zD * 0.10
          : role === 'TOP'
          ? zK * 0.25 + zP * 0.25 + zG * 0.30 + zD * 0.20
          : zK * 0.25 + zP * 0.25 + zG * 0.25 + zD * 0.25  // MID/JGL/ADC

        // z=±1 → bonus≈±3, z=±1.65 → bonus≈±5 (scale 3.0) — 에이스가 약팀에서도 튀도록
        individualBonus = Math.max(-5, Math.min(5, Math.round(composite * 3.0)))
      }
    }

    // 99 희소성 보호: baseOvr===99(EDITORIAL/WORLDS_MVP 산출)이면 보너스 무시
    const ovr = baseOvr === 99
      ? 99
      : Math.max(75, Math.min(98, baseOvr + individualBonus))

    // frame: Worlds Place=1 시즌
    const frame: 'WORLDS' | 'NORMAL' = worldsPlace === 1 ? 'WORLDS' : 'NORMAL'

    // crown: 해당 시즌 FINALS_MVP 또는 WORLDS_MVP 수상 시만 (SEASON_MVP 제외 — 호빈 확정)
    const crown = awards.some(a => a.award === 'FINALS_MVP' || a.award === 'WORLDS_MVP')

    // msiWinner: MSI Place=1
    const msiWinner = msiPlace === 1

    // badges
    const badges: ('LEAGUE_CHAMP' | 'ALLPRO_1ST')[] = []
    if (playoffPlaces.includes(1)) badges.push('LEAGUE_CHAMP')
    if (awards.some(a => a.award === 'ALLPRO_1ST' && a.year >= 2020)) badges.push('ALLPRO_1ST')

    rated.push({
      playerId,
      nameEn,
      nameKo,
      team,
      year,
      leagueCode,
      role,
      ovr,
      frame,
      crown,
      msiWinner,
      badges,
    })
  }

  fs.writeFileSync(outPath, JSON.stringify(rated, null, 2), 'utf-8')

  console.log(`\nratings.json 저장: ${rated.length}건`)
  const ovrDist = [60, 70, 80, 90].map(min => {
    const max = min + 9
    return `${min}-${max}: ${rated.filter(r => r.ovr >= min && r.ovr <= max).length}`
  })
  console.log(`  OVR 분포: ${ovrDist.join(', ')}`)
  console.log(`  WORLDS frame: ${rated.filter(r => r.frame === 'WORLDS').length}`)
  console.log(`  crown: ${rated.filter(r => r.crown).length}`)
  console.log(`  msiWinner: ${rated.filter(r => r.msiWinner).length}`)
}

main().catch(e => { process.stderr.write(`Fatal: ${e}\n`); process.exit(1) })
