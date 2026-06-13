// 시즌 REVEAL용 — 섹션별 마지막(또는 대표) 경기 4개만 추출

import type { SimStep } from './sim'

export type HighlightSection = 'Spring Split' | 'MSI' | 'Summer Split' | 'Worlds'

export type HighlightStep = {
  section: HighlightSection
  step: SimStep
}

function synth(stage: string, label: string): SimStep {
  return { stage, label }
}

function lastSpring(by: Map<string, SimStep>): SimStep {
  return (
    by.get('Spring_final') ??
    by.get('Spring_sf') ??
    by.get('Spring_missed') ??
    synth('Spring_missed', 'Spring Split — Playoffs DNQ')
  )
}

function lastMsi(by: Map<string, SimStep>): SimStep {
  const played = by.get('msi_r3') ?? by.get('msi_r2') ?? by.get('msi_r1')
  if (played) return played
  if (by.get('msi_win')) return by.get('msi_win')!
  const reached = by.has('Spring_final') || !!by.get('Spring_sf')?.series?.[0]?.win
  if (!reached) return synth('msi_out', 'MSI — DNQ (Missed Spring Finals)')
  return synth('msi_out', 'MSI — Eliminated')
}

function lastSummer(by: Map<string, SimStep>): SimStep {
  return (
    by.get('Summer_final') ??
    by.get('Summer_sf') ??
    by.get('Summer_missed') ??
    synth('Summer_missed', 'Summer Split — Playoffs DNQ')
  )
}

function lastWorlds(by: Map<string, SimStep>): SimStep {
  const ko = by.get('worlds_final') ?? by.get('worlds_sf') ?? by.get('worlds_qf')
  if (ko) return ko
  for (let r = 5; r >= 1; r--) {
    const s = by.get(`worlds_swiss_r${r}`)
    if (s) return s
  }
  if (by.get('worlds_swiss_out')) return by.get('worlds_swiss_out')!
  if (by.get('worlds_win')) return by.get('worlds_win')!
  const reached = by.has('Summer_sf') || by.has('Summer_final') || by.has('worlds_swiss_r1')
  if (!reached) return synth('worlds_swiss_out', 'Worlds — DNQ (Missed Summer Playoffs)')
  return synth('worlds_swiss_out', 'Worlds — Swiss Eliminated')
}

/** Spring → MSI → Summer → Worlds 순 4스텝 */
export function pickHighlightSteps(steps: SimStep[]): HighlightStep[] {
  const by = new Map(steps.map(s => [s.stage, s]))
  return [
    { section: 'Spring Split', step: lastSpring(by) },
    { section: 'MSI', step: lastMsi(by) },
    { section: 'Summer Split', step: lastSummer(by) },
    { section: 'Worlds', step: lastWorlds(by) },
  ]
}

export function highlightStepsFlat(highlights: HighlightStep[]): SimStep[] {
  return highlights.map(h => h.step)
}

/** 섹션별 최종 도달 라운드 (English) */
export function highlightRoundLabel(h: HighlightStep): string {
  const { step } = h
  const stage = step.stage
  const ser = step.series?.[0]
  const won = ser?.win ?? stage.endsWith('win')

  if (stage === 'Spring_missed' || stage === 'Summer_missed') return 'Missed Playoffs'
  if (stage === 'worlds_swiss_out') return 'Swiss Exit'
  if (stage === 'msi_out') {
    return step.label.includes('DNQ') ? 'Did Not Qualify' : 'Eliminated'
  }
  if (stage === 'msi_win' || stage === 'worlds_win') return 'Champion'

  if (
    won &&
    (stage === 'Spring_final' || stage === 'Summer_final' ||
     stage === 'worlds_final' || stage === 'msi_r3')
  ) {
    return 'Champion'
  }

  if (stage === 'Spring_final' || stage === 'Summer_final' || stage === 'worlds_final' || stage === 'msi_r3') {
    return 'Finals'
  }
  if (stage === 'Spring_sf' || stage === 'Summer_sf' || stage === 'worlds_sf' || stage === 'msi_r2') {
    return 'Semifinals'
  }
  if (stage === 'worlds_qf' || stage === 'msi_r1') return 'Quarterfinals'
  if (stage.startsWith('worlds_swiss_r')) return 'Swiss Stage'

  return step.label
}

/** RESULT / REVEAL용 한 줄 요약 — 라운드 + 경기 결과 */
export function highlightSummary(h: HighlightStep): string {
  const round = highlightRoundLabel(h)
  const { step } = h
  const ser = step.series?.[0]
  if (ser) {
    const wl = ser.win ? 'W' : 'L'
    return `${round} · ${wl} vs ${ser.opp} (${ser.score})`
  }
  return round
}
