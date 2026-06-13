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
  worldsMvp: boolean
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

// calc/compress/clamp/individualBonus 전부 끝난 최종 OVR을 덮어씀
// key: `${playerId}|${year}|${leagueCode}`
// ⚠️ OVR 99는 이 테이블로만 부여 (compressOvr 상한 = 98) — 4명 고정
const OVR_OVERRIDES: Record<string, number> = {
  // ── OVR 99 확정 4명 ──────────────────────────────────────────────────────
  'Faker|2013|LCK': 99,
  'Faker|2016|LCK': 99,
  'MaRin|2015|LCK': 99,
  'Canyon|2020|LCK': 99,
  // ── OVR 98 ──────────────────────────────────────────────────────────────
  'Faker|2015|LCK': 98,
  'ShowMaker|2020|LCK': 98,
  'Chovy|2024|LCK': 98,
  // ── T1 2023-2025 ────────────────────────────────────────────────────────
  'Faker|2023|LCK': 97,
  'Zeus|2023|LCK': 97,
  'Oner|2023|LCK': 97,
  'Keria|2023|LCK': 96,
  'Keria|2024|LCK': 90,    // 월즈 우승인데 2022(93)보다 낮은 모순 완화 — 88→90
  'Faker|2024|LCK': 95,
  'Zeus|2024|LCK': 91,
  'Gumayusi|2024|LCK': 90,
  'Faker|2025|LCK': 95,
  // ── SKT 2015-2016 Worlds 우승 — AP1st 부재 시대 보정 (Patch 2) ──────────
  'Bang|2015|LCK': 95,                  // 2015 Worlds 우승 ADC, AP1st 제도 미비
  'Bang|2016|LCK': 95,                  // 2016 Worlds 우승 ADC
  'Wolf (Lee Jae-wan)|2015|LCK': 94,   // 2015 슬럼프 시즌 — 팀 성과 대비 개인 하향 유지
  'Wolf (Lee Jae-wan)|2016|LCK': 93,   // 91→93 (그랜드슬램급, 15=94와 역전 완화)
  // ── Samsung White 2014 ──────────────────────────────────────────────────
  'Mata|2014|LCK': 96,   // 역대 유일 서폿 F.MVP
  'imp|2014|LCK': 94,
  'PawN|2014|LCK': 93,
  'DanDy|2014|LCK': 93,
  'Looper|2014|LCK': 90,
  // ── LCK 개별 보정 ───────────────────────────────────────────────────────
  'Smeb|2015|LCK': 91,
  'Khan|2017|LCK': 88,       // 서머 결승 MVP, 반시즌 패널티 과함 — 85→88
  'Score|2018|LCK': 90,     // KT 2018 최고 시즌, 국내 우승+Worlds 4강
  'Nuguri|2020|LCK': 95,    // Worlds 우승 완전체 탑, Zeus 2023급
  // ── SSG 2017 — 향로 메타 월즈 준우승 (Patch 2·3 상향) ──────────────────
  'Ruler|2017|LCK': 92,     // Worlds 2017 F.MVP — 92 (Patch 3)
  'CoreJJ|2017|LCK': 91,    // 향로 핵심 SUP — Ruler(92) 아래, LCS 시절(90) 위
  'Crown|2017|LCK': 89,     // SSG 미드, 월즈 준우승
  'Ambition|2017|LCK': 89,  // SSG 정글, 월즈 준우승
  'CuVee|2017|LCK': 89,     // SSG 탑 위크사이드, 월즈 준우승
  // ── DRX 2022 — 월즈 미라클런 ─────────────────────────────────────────────
  'Zeka (Kim Geon-woo)|2022|LCK': 91,  // 월즈 우승 미드
  'Kingen|2022|LCK': 89,               // 87→89 (월즈 결승 MVP 체면)
  'BeryL|2022|LCK': 90,                // 월즈 우승 오더 SUP
  'Deft|2022|LCK': 85,                 // 81→85 (+4, 역대 최장수 프로 월즈 우승 ADC)
  'BeryL|2021|LCK': 89,               // 93→89 (부진 시즌이 우승 시즌 20/22=90보다 높은 모순 해소)
  // ── LPL ─────────────────────────────────────────────────────────────────
  'Scout|2021|LPL': 97,
  'Viper (Park Do-hyeon)|2021|LPL': 97,
  'Kanavi|2023|LPL': 96,
  'knight (Zhuo Ding)|2023|LPL': 94,   // 96→94 (Faker 24/25=95와 역전 해소)
  'Ruler|2023|LPL': 96,
  'knight (Zhuo Ding)|2024|LPL': 94,   // 96→94
  '369|2023|LPL': 95,
  'Elk|2024|LPL': 96,
  'Bin (Chen Ze-Bin)|2024|LPL': 92,   // 96→92 (Patch 4 — 국제 우승 0, LPL 정규만)
  'ON|2024|LPL': 89,                   // 93→89 (Patch 4)
  'TheShy|2023|LPL': 91,
  'SofM|2020|LPL': 90,
  // ── IG 2018 Worlds 우승 (Patch 2·3) ──────────────────────────────────────
  'TheShy|2018|LPL': 93,         // 역대 최고점 세체탑
  'Rookie|2018|LPL': 95,         // 93→95 (단일시즌 역대급 미드, 압도적 상징성)
  'Ning|2018|LPL': 92,           // 정글 최초 Worlds F.MVP
  'JackeyLove|2018|LPL': 86,    // IG 월즈 우승 ADC — 1차 구제 누락 보정
  // ── RNG 2018 MSI 우승 ────────────────────────────────────────────────────
  'Uzi (Jian Zi-Hao)|2018|LPL': 92,  // 역대 최고 MSI 시즌 ADC
  // ── FPX 2019 Worlds 우승 ─────────────────────────────────────────────────
  'Doinb|2019|LPL': 93,
  'Tian|2019|LPL': 92,    // Worlds F.MVP
  'Lwx|2019|LPL': 91,
  'GimGoon|2019|LPL': 90,
  'Crisp|2019|LPL': 90,
  // ── LEC ─────────────────────────────────────────────────────────────────
  'YellOwStaR|2015|LEC': 90,    // 곡선 완화 방지
  'Rekkles|2018|LEC': 90,       // 95→90 (Patch 4 — LEC 정규 독식, 국제 한계)
  'Jankos|2019|LEC': 91,        // 97→91 (Patch 4 + 검증: Tian 92 ≥ Jankos)
  'Perkz|2019|LEC': 91,         // 93→91 (2차 — 비원딜, 정통 원딜 위 과함)
  'Caps|2019|LEC': 97,          // G2 2019 MID — 유지 (Worlds 결승 에이스)
  'Perkz|2022|LEC': 76,
  'Yike|2023|LEC': 88,          // 94→88 (Patch 4 — LEC만, 국제 한계)
  'Caps|2024|LEC': 91,          // 95→91 (Patch 4)
  'BrokenBlade|2024|LEC': 87,   // 90→87 (Patch 4)
  // ── LCS ─────────────────────────────────────────────────────────────────
  'Blaber|2020|LCS': 73,
  'Blaber|2021|LCS': 75,
  'CoreJJ|2019|LCS': 90,                         // 93→90 (Patch 4 + 모순해소: 2017 SSG > LCS 시절)
  'Berserker (Kim Min-cheol)|2022|LCS': 86,
  'Berserker (Kim Min-cheol)|2023|LCS': 88,
}

// §9 연도×리그 계수 — 국내 플옵 가점에만 적용 (Worlds/MSI/수상 이중 페널티 방지)
// key: `${year}|${leagueCode}` — 없는 연도는 LCK=1.0, 나머지=0.80
const LEAGUE_COEFF_TABLE: Record<string, number> = {
  '2013|LCK':1.00, '2013|LPL':0.80, '2013|LEC':0.82, '2013|LCS':0.78,
  '2014|LCK':0.95, '2014|LPL':0.82, '2014|LEC':0.83, '2014|LCS':0.78,
  '2015|LCK':1.00, '2015|LPL':0.83, '2015|LEC':0.83, '2015|LCS':0.78,
  '2016|LCK':1.00, '2016|LPL':0.85, '2016|LEC':0.82, '2016|LCS':0.78,
  '2017|LCK':1.00, '2017|LPL':0.88, '2017|LEC':0.82, '2017|LCS':0.77,
  '2018|LCK':0.95, '2018|LPL':0.95, '2018|LEC':0.82, '2018|LCS':0.76,
  '2019|LCK':0.95, '2019|LPL':0.98, '2019|LEC':0.90, '2019|LCS':0.78,
  '2020|LCK':1.00, '2020|LPL':0.92, '2020|LEC':0.83, '2020|LCS':0.76,
  '2021|LCK':1.00, '2021|LPL':0.95, '2021|LEC':0.80, '2021|LCS':0.75,
  '2022|LCK':1.00, '2022|LPL':0.92, '2022|LEC':0.80, '2022|LCS':0.75,
  '2023|LCK':1.00, '2023|LPL':0.92, '2023|LEC':0.80, '2023|LCS':0.75,
  '2024|LCK':1.00, '2024|LPL':0.90, '2024|LEC':0.78, '2024|LCS':0.75,
  '2025|LCK':1.00, '2025|LPL':0.90, '2025|LEC':0.78, '2025|LCS':0.75,
}
function getLeagueCoeff(year: number, leagueCode: string): number {
  return LEAGUE_COEFF_TABLE[`${year}|${leagueCode}`] ?? (leagueCode === 'LCK' ? 1.0 : 0.80)
}

// 리그 계수를 0.85~1.0 범위로 압축 — AllPro/SEASON_MVP 전용 (이중 페널티 방지)
// 원래 계수 0.75~1.00 → 0.85~1.00 선형 재매핑
function getAwardCoeff(leagueCoeff: number): number {
  return 0.85 + Math.max(0, Math.min(0.25, leagueCoeff - 0.75)) * 0.60
}

// raw 점수 누적 — 비선형 압축 전 단계 (천장 없음)
// Rule 1: 연내 복수 스플릿 합산 / Rule 4: AllPro 2020+ 시즌만
function calcOvr(params: {
  playoffPlaces: number[]
  msiPlace: number | null
  worldsPlace: number | null
  awards: AwardRow[]
  leagueCode: string
  year: number
}): number {
  let score = 60
  const coeff = getLeagueCoeff(params.year, params.leagueCode)
  const awardCoeff = getAwardCoeff(coeff)

  // 국내 플옵 × 리그 계수 (Rule 1: 스플릿별 합산)
  for (const p of params.playoffPlaces) {
    let pts = 0
    if (p === 1) pts = 8
    else if (p === 2) pts = 5
    else if (p <= 4) pts = 2
    else if (p <= 6) pts = 1
    else pts = 1
    score += pts * coeff
  }

  // MSI (리그 계수 면제): 우승+8 / 준우승+5 / 4강+2
  if (params.msiPlace !== null) {
    const p = params.msiPlace
    if (p === 1) score += 8
    else if (p === 2) score += 5
    else if (p <= 4) score += 2
  }

  // Worlds (리그 계수 면제): 우승+15 / F(준우승)+12 / 4강+8 / 8강+5 / 진출+2
  if (params.worldsPlace !== null) {
    const p = params.worldsPlace
    if (p === 1) score += 15
    else if (p === 2) score += 12
    else if (p <= 4) score += 8
    else if (p <= 8) score += 5
    else score += 2
  }

  // 개인 수상 — AllPro/SEASON_MVP에 awardCoeff 적용 (0.85~1.0)
  // WORLDS_MVP: Worlds 순위 가점으로 흡수, 별도 가산 제거
  for (const a of params.awards) {
    if (a.award === 'SEASON_MVP') score += 6 * awardCoeff
    else if (a.award === 'FINALS_MVP') score += 4
    else if (a.award === 'WORLDS_MVP') score += 0
    else if (a.award === 'ALLPRO_1ST' && a.year >= 2020) score += 5 * awardCoeff
    else if (a.award === 'ALLPRO_2ND' && a.year >= 2020) score += 3 * awardCoeff
    else if (a.award === 'ALLPRO_3RD' && a.year >= 2020) score += 1 * awardCoeff
    else if (a.award === 'EDITORIAL') score += a.value
  }

  return score  // unclamped raw
}

// raw → OVR 구간별 비선형 압축 (상한 98 — 99는 OVR_OVERRIDES 4명 전용)
// raw ≤ 60       → 60
// v2: 바닥 상향 + 80대 넉넉하게 + 90 초반 완화
// raw ≤ 60       → OVR 70     (바닥)
// raw 60~80      → OVR 70~82  (×0.60, raw 20 = OVR 12)
// raw 80~100     → OVR 82~92  (×0.50, raw 20 = OVR 10)
// raw 100~120    → OVR 92~96  (×0.20, raw 20 = OVR 4)
// raw 120~140    → OVR 96~98  (×0.10, raw 20 = OVR 2)
// raw ≥ 140      → 98
function compressOvr(raw: number): number {
  if (raw <= 60) return 70
  if (raw <= 80) return 70 + (raw - 60) * 0.60
  if (raw <= 100) return 82 + (raw - 80) * 0.50
  if (raw <= 120) return 92 + (raw - 100) * 0.20
  if (raw <= 140) return 96 + (raw - 120) * 0.10
  return 98
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

  // ─── OE 복합 지표 로드 (2019~2021, v1.1) ──────────────────────────────────
  // key: `${normalizedName}|${year}|${leagueCode}` → ovrBonus (±6)
  // normalizedName: playerId에서 "(XXX)" suffix 제거 후 소문자화
  const OE_DIR = path.join(process.cwd(), 'pipeline-cache', 'oe')
  const oeBonusByKey = new Map<string, number>()

  if (fs.existsSync(OE_DIR)) {
    for (const yr of [2019, 2020, 2021]) {
      const statsPath = path.join(OE_DIR, `stats_${yr}.json`)
      if (!fs.existsSync(statsPath)) continue
      const rows = JSON.parse(fs.readFileSync(statsPath, 'utf-8')) as Array<{
        playername: string; year: number; league: string; ovrBonus: number
      }>
      for (const r of rows) {
        const normName = r.playername.toLowerCase()
        const key = `${normName}|${r.year}|${r.league}`
        // 중복 시 ovrBonus 절댓값이 큰 쪽 보존 (팀 이적 선수 대비)
        if (!oeBonusByKey.has(key) || Math.abs(r.ovrBonus) > Math.abs(oeBonusByKey.get(key)!)) {
          oeBonusByKey.set(key, r.ovrBonus)
        }
      }
    }
    console.log(`OE v1.1 지표 로드: ${oeBonusByKey.size}건`)
  }

  // ─── 2013~2015 다지표 보너스 로드 (04e-early-stats.ts 출력) ─────────────────
  // key: `${playerId}|${year}|${leagueCode}` (대소문자 원본 유지) → statsBonus
  const earlyStatsByKey = new Map<string, number>()
  const earlyStatsPath = path.join(process.cwd(), 'pipeline-cache', 'ovr-stats-early.json')
  if (fs.existsSync(earlyStatsPath)) {
    const earlyData = JSON.parse(fs.readFileSync(earlyStatsPath, 'utf-8')) as Record<string, { statsBonus: number }>
    for (const [k, v] of Object.entries(earlyData)) {
      earlyStatsByKey.set(k, v.statsBonus)
    }
    console.log(`2013~2015 다지표 보너스 로드: ${earlyStatsByKey.size}건`)
  }

  // ─── 2022~2023 다지표 보너스 로드 (04c-oe-stats.ts 출력) ────────────────────
  // key: `${playerId(lower)}|${year}|${team(lower)}` → ovrAdjust (다지표 ±8)
  const lateStatsByKey = new Map<string, number>()
  const lateStatsPath = path.join(process.cwd(), 'pipeline-cache', 'oe-stats-2022-2023.json')
  if (fs.existsSync(lateStatsPath)) {
    const lateData = JSON.parse(fs.readFileSync(lateStatsPath, 'utf-8')) as Array<{
      playerId: string; team: string; year: number; ovrAdjust: number
    }>
    for (const r of lateData) {
      const k = `${r.playerId.toLowerCase()}|${r.year}|${r.team.toLowerCase()}`
      lateStatsByKey.set(k, r.ovrAdjust)
    }
    console.log(`2022~2023 다지표 보너스 로드: ${lateStatsByKey.size}건`)
  }

  // ─── 2024~2025 다지표 보너스 로드 (04d-oe-stats.ts 출력) ──────────────────
  // key: `${playerId(lower)}|${year}|${team(lower)}` → ovrBonus (다지표 ±8)
  const newStatsByKey = new Map<string, number>()
  const newStatsPath = path.join(process.cwd(), 'pipeline-cache', 'oe-stats-2024-2025.json')
  if (fs.existsSync(newStatsPath)) {
    const newData = JSON.parse(fs.readFileSync(newStatsPath, 'utf-8')) as Array<{
      playerId: string; team: string; year: number; ovrBonus: number
    }>
    for (const r of newData) {
      const k = `${r.playerId.toLowerCase()}|${r.year}|${r.team.toLowerCase()}`
      newStatsByKey.set(k, r.ovrBonus)
    }
    console.log(`2024~2025 다지표 보너스 로드: ${newStatsByKey.size}건`)
  }

  // ─── 2016~2018 지표 로드 (04e-ovr-final.ts 출력 — OE 다지표+LP 폴백, cap ±7) ──────
  // key: `${playerId}|${year}|${leagueCode}` (원본 대소문자)
  const v11StatsPath = path.join(process.cwd(), 'pipeline-cache', 'ovr-stats-v11-final.json')
  const v11StatsMap = new Map<string, number>()  // → statsBonus
  if (fs.existsSync(v11StatsPath)) {
    const v11Data = JSON.parse(fs.readFileSync(v11StatsPath, 'utf-8')) as Record<string, { statsBonus: number }>
    for (const [k, v] of Object.entries(v11Data)) {
      v11StatsMap.set(k, v.statsBonus)
    }
    console.log(`2016~2018 지표 로드: ${v11StatsMap.size}건 (v11-final OE+LP)`)
  }

  // Leaguepedia playerId → OE 정규화 이름 변환
  // 예: "Dread (Lee Jin-hyeok)" → "dread", "BeryL" → "beryl"
  function normalizePlayerId(pid: string): string {
    return pid.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase()
  }

  // ─── stats_agg 로드 (2013~2018 KDA, 재수집 불요) ──────────────────────────
  // key: `${playerId}|${team}|${year}` → kda  (2019+ 는 OE로 교체됨)
  const CARGO_DIR = path.join(process.cwd(), 'pipeline-cache', 'cargo')
  const aggByKey = new Map<string, number>()

  if (fs.existsSync(CARGO_DIR)) {
    const aggFiles = fs.readdirSync(CARGO_DIR).filter(f => f.startsWith('stats_agg_'))
    for (const f of aggFiles) {
      const m = f.match(/^stats_agg_\w+_(\d+)\.json$/)
      if (!m) continue
      const yr = parseInt(m[1])
      const rows = JSON.parse(fs.readFileSync(path.join(CARGO_DIR, f), 'utf-8')) as Record<string, string>[]
      for (const r of rows) {
        const pid = r.Link?.trim()
        const tm = r.Team?.trim()
        if (!pid || !tm) continue
        const n = parseInt(r.N || '0')
        if (n < 3) continue
        const avgK = parseFloat(r.AvgK || '0')
        const avgD = parseFloat(r.AvgD || '0')
        const avgA = parseFloat(r.AvgA || '0')
        const kda = (avgK + avgA) / Math.max(1, avgD)
        const key = `${pid}|${tm}|${yr}`
        if (!aggByKey.has(key)) aggByKey.set(key, kda)
      }
    }
    console.log(`stats_agg 로드: ${aggByKey.size}건`)
  }

  // ─── role × year 정규화 버킷 (2013~2018 KDA 정규화용 — 2019~2021은 OE로 교체) ──
  const normBuckets = new Map<string, number[]>()  // key: `${role}|${year}`
  for (const e of entries) {
    if (e.year > 2018) continue
    const kda = aggByKey.get(`${e.playerId}|${e.team}|${e.year}`)
    if (kda === undefined) continue
    const bk = `${e.role}|${e.year}`
    if (!normBuckets.has(bk)) normBuckets.set(bk, [])
    normBuckets.get(bk)!.push(kda)
  }
  const normStats = new Map<string, { mu: number; sd: number }>()
  for (const [k, vals] of normBuckets) {
    const mu = mean(vals)
    const sd = stdev(vals, mu)
    normStats.set(k, { mu, sd })
  }

  // ─── 팀-연도별 최대 gameCount (주전/서브 기준선) ─────────────────────────
  const teamMaxGames = new Map<string, number>()  // key: `${team}|${year}`
  for (const e of entries) {
    const k = `${e.team}|${e.year}`
    teamMaxGames.set(k, Math.max(teamMaxGames.get(k) ?? 0, e.gameCount))
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
    // 비선형 압축 전 raw 점수 (unclamped)
    const rawOvr = calcOvr({ playoffPlaces, msiPlace, worldsPlace, awards, leagueCode, year })

    // ─── stats 보정 — raw에 합산 후 비선형 압축 ──────────────────────────────
    let statsBonus = 0

    if (year >= 2024) {
      // 2024~2025 다지표 (04d-oe-stats.ts) — link=playerId 기준
      const k = `${playerId.toLowerCase()}|${year}|${team.toLowerCase()}`
      const bonus = newStatsByKey.get(k)
      if (bonus !== undefined) statsBonus = bonus
    } else if (year >= 2022 && year <= 2023) {
      // 2022~2023 다지표 (KDA+GS+CS+Dmg 4종, 04c-oe-stats.ts)
      const k = `${playerId.toLowerCase()}|${year}|${team.toLowerCase()}`
      const bonus = lateStatsByKey.get(k)
      if (bonus !== undefined) statsBonus = bonus
    } else if (year >= 2019 && year <= 2021) {
      // OE 복합 지표 (v1.1): KDA+골드차+라인전+데미지 4종 가중 composite z-score
      const normName = normalizePlayerId(playerId)
      const oeKey = `${normName}|${year}|${leagueCode}`
      const oeBonus = oeBonusByKey.get(oeKey)
      if (oeBonus !== undefined) statsBonus = oeBonus
    } else if (year <= 2015) {
      // 2013~2015 다지표 (04e-early-stats.ts) — KDA+GS+KP 동적 가중치
      const earlyBonus = earlyStatsByKey.get(`${playerId}|${year}|${leagueCode}`)
      if (earlyBonus !== undefined) statsBonus = earlyBonus
    } else if (year >= 2016 && year <= 2018) {
      // 2016~2018 KDA+GS+KP, cap ±7 (소스에서 이미 cap됨)
      const bonus = v11StatsMap.get(`${playerId}|${year}|${leagueCode}`)
      if (bonus !== undefined) statsBonus = bonus
    }

    // 주전/서브 구분 — 전 시대 공통
    const maxGames = teamMaxGames.get(`${team}|${year}`) ?? entry.gameCount
    if (entry.gameCount < maxGames * 0.8) {
      statsBonus -= 1
    }

    // 방호막: 개별 스크립트 이미 cap됨, 여기선 ±7 재확인
    statsBonus = Math.max(-7, Math.min(7, statsBonus))

    // stats를 raw에 합산 → 비선형 압축 (99는 OVR_OVERRIDES 전용)
    const rawTotal = rawOvr + statsBonus
    const baseOvr = Math.max(60, Math.min(98, Math.round(compressOvr(rawTotal))))

    // 하드오버라이드 — OVR_OVERRIDES 매칭 시 calc/compress 결과 전부 무시
    const ovr = OVR_OVERRIDES[`${playerId}|${year}|${leagueCode}`] ?? baseOvr

    // frame: Worlds Place=1 시즌
    const frame: 'WORLDS' | 'NORMAL' = worldsPlace === 1 ? 'WORLDS' : 'NORMAL'

    // crown: 해당 시즌 FINALS_MVP 또는 WORLDS_MVP 수상 시만 (SEASON_MVP 제외 — 호빈 확정)
    const crown = awards.some(a => a.award === 'FINALS_MVP' || a.award === 'WORLDS_MVP')

    // worldsMvp: awards.csv WORLDS_MVP 행 기준 — frame 추론 금지 (Faker 2015/Nuguri 2020 오분류 방지)
    const worldsMvp = awards.some(a => a.award === 'WORLDS_MVP')

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
      worldsMvp,
      msiWinner,
      badges,
    })
  }

  // ─── 동률 해시 분산 후처리 ────────────────────────────────────────────────
  // 조건: 같은 team|year 5명 전원 OVR 동률 AND OVR < 85 AND Worlds 진출X
  // playerId 문자코드 합 % 3 → +0/+1/+2 (결정론, 재현성 유지, EDITORIAL 행 불요)
  {
    const tieGroups = new Map<string, typeof rated>()
    for (const r of rated) {
      const k = `${r.team}|${r.year}`
      if (!tieGroups.has(k)) tieGroups.set(k, [])
      tieGroups.get(k)!.push(r)
    }
    for (const [key, group] of tieGroups) {
      if (group.length < 5) continue
      const baseOvr = group[0].ovr
      if (!group.every(r => r.ovr === baseOvr)) continue  // 동률 아님
      if (baseOvr >= 85) continue                          // 고티어 보존
      const [team, yearStr] = key.split('|')
      const wKey = `${normalizeTeam(team)}|${yearStr}`
      if (worldsByTeamYear.has(wKey)) continue             // Worlds 진출 팀 보존
      for (const r of group) {
        const hash = Array.from(r.playerId).reduce((s, c) => s + c.charCodeAt(0), 0) % 3
        r.ovr = Math.max(75, Math.min(99, r.ovr + hash))
      }
    }
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
