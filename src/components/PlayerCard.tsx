'use client'
// §6.2 PlayerCard — v0 확정 디자인 (FlyQuest 2020 HTML 기준)
// - OVR: Anton(font-ovr-display), 좌상단
// - 리그: solid 색상 배지, OVR 아래
// - 이름: Bebas Neue(font-heading-md) UPPERCASE, 하단 좌정렬
// 도감/드래프트/결과 공유 컴포넌트 — 왕관 에셋 미수령으로 crown 미구현

import { useState } from 'react'
import type { PlayerSeason } from '@/lib/data'

export type CardSize = 'pick' | 'slot' | 'result' | 'dex'

type Props = {
  player: PlayerSeason
  size?: CardSize
  disabled?: boolean
  onClick?: () => void
  isFlying?: boolean
}

function photoSrc(player: PlayerSeason): string | null {
  if (process.env.NEXT_PUBLIC_PHOTOS_ENABLED === 'false') return null
  return player.photo ?? null
}

// OVR 텍스트 색 + text-shadow (4단계, 사용자 요청)
function ovrCls(ovr: number, isGold: boolean): string {
  if (isGold || ovr >= 95) return 'text-secondary text-glow-gold'
  if (ovr >= 90) return 'text-sky-300 text-glow-blue'
  if (ovr >= 85) return 'text-on-surface text-glow-white'
  return 'text-[#94a3b8] text-glow-gray'
}

// 카드 하단 border glow (OVR 티어 기준)
function ovrGlowCls(ovr: number, isGold: boolean): string {
  if (isGold || ovr >= 95) return 'glow-border-gold'
  if (ovr >= 90) return 'glow-border-blue'
  return 'glow-border-gray'
}

// 리그 배지: solid bg — 동적 인라인 스타일로 purge 방지
const LEAGUE_BADGE: Record<string, { bg: string; color: string }> = {
  LCK: { bg: '#0284c7', color: '#fff' },
  LPL: { bg: '#dc2626', color: '#fff' },
  LEC: { bg: '#7e22ce', color: '#fff' },
  LCS: { bg: '#f97316', color: '#14141c' },
}

// 아바타 배경 (사진 없을 때)
function avatarBg(teamSlug: string): string {
  const h = [...teamSlug].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hues = [210, 150, 30, 280, 350, 190, 60, 320]
  return `hsl(${hues[h % hues.length]}, 35%, 28%)`
}

// 카드 너비 (5:7 비율)
const SIZE_W: Record<CardSize, string> = {
  pick:   'w-[140px] aspect-[5/7] draft-pick-w',
  slot:   'w-[110px] md:w-[140px] aspect-[5/7]',
  result: 'w-[130px] md:w-[160px] aspect-[5/7]',
  dex:    'w-full aspect-[5/7]',  // 그리드 셀 채움 — 도감 전용
}

// OVR 폰트 크기 (Anton — font-ovr-display)
const SIZE_OVR: Record<CardSize, string> = {
  pick:   'text-[38px] md:text-[46px]',
  slot:   'text-[28px] md:text-[36px]',
  result: 'text-[34px] md:text-[42px]',
  dex:    'text-[32px] md:text-[44px]',
}

// 이름 폰트 크기 (Bebas Neue — font-heading-md)
const SIZE_NAME: Record<CardSize, string> = {
  pick:   'text-[20px] md:text-[26px]',
  slot:   'text-[13px] md:text-[17px]',
  result: 'text-[17px] md:text-[22px]',
  dex:    'text-[16px] md:text-[22px]',
}

export default function PlayerCard({
  player,
  size = 'pick',
  disabled = false,
  onClick,
  isFlying = false,
}: Props) {
  const [imgError, setImgError] = useState(false)

  const isWorlds = player.frame === 'WORLDS'
  const hasMsi   = player.msiWinner && !isWorlds
  const isGold   = isWorlds

  const borderCls = isWorlds
    ? 'border-2 border-secondary/50'
    : hasMsi
    ? 'border-2 border-amber-400/35'
    : 'border border-outline-variant/50'

  const badge    = LEAGUE_BADGE[player.league]
  const hasPhoto = !!photoSrc(player) && !imgError

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        SIZE_W[size],
        'rounded relative overflow-hidden',
        'bg-surface-container-high',
        borderCls,
        isWorlds ? 'card-selected' : '',
        ovrGlowCls(player.ovr, isGold),
        'card-lift group select-none',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        isFlying ? 'is-flying' : '',
      ].filter(Boolean).join(' ')}
      aria-label={`${player.nameEn} ${player.year} ${player.team}`}
    >
      {/* 1. 사진 / 아바타 — 카드 전체 채움 */}
      <div className="absolute inset-0 overflow-hidden">
        {hasPhoto ? (
          <img
            src={photoSrc(player)!}
            alt={player.nameEn}
            loading="lazy"
            className={[
              'w-full h-full object-cover object-top transition-transform duration-300',
              size === 'dex'
                ? 'scale-[0.82] origin-top group-hover:scale-[0.86]'
                : 'group-hover:scale-105',
            ].join(' ')}
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={[
              'w-full h-full flex items-center justify-center text-white/60 font-black text-4xl transition-transform duration-300',
              size === 'dex' ? 'scale-[0.82] origin-top group-hover:scale-[0.86]' : 'group-hover:scale-105',
            ].join(' ')}
            style={{ background: avatarBg(player.teamSlug) }}
          >
            {player.nameEn.charAt(0).toUpperCase()}
          </div>
        )}
        {/* 하단 페이드 — v0 from body bg #14141c */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#14141c] via-[#14141c]/45 to-transparent pointer-events-none" />
      </div>

      {/* 2. 노이즈 텍스처 */}
      <div className="absolute inset-0 noise-overlay opacity-10 pointer-events-none" aria-hidden />

      {/* 4. 좌상단: OVR (Anton) + 리그 배지 (solid pill) */}
      <div className="absolute top-2 left-2 z-20 flex flex-col items-center leading-none">
        {/* ovr-number: globals.css hover 규칙 대상 */}
        <span className={[
          'ovr-number font-ovr-display leading-none drop-shadow',
          SIZE_OVR[size],
          ovrCls(player.ovr, isGold),
        ].join(' ')}>
          {player.ovr}
        </span>
        {badge && (
          <span
            className="font-label-caps text-[8px] px-1.5 py-[2px] rounded-sm uppercase tracking-wider mt-1"
            style={{ backgroundColor: badge.bg, color: badge.color }}
          >
            {player.league}
          </span>
        )}
      </div>

      {/* 5. 우상단: AP1 배지 (있을 때만) */}
      {player.badges.includes('ALLPRO_1ST') && (
        <div className="absolute top-2 right-1.5 z-20">
          <span className="font-label-caps text-[7px] uppercase tracking-wider px-1.5 py-[2px] rounded-sm bg-yellow-900/60 border border-yellow-600/40 text-yellow-300">
            AP1
          </span>
        </div>
      )}

      {/* 6. 하단 좌정렬: 역할 + 선수 이름 + 팀·연도 */}
      <div className="absolute bottom-2.5 left-2.5 z-20 w-full pr-3">
        <div className="font-label-caps text-[9px] text-outline/70 mb-[2px] uppercase">{player.role}</div>
        <div className={[
          'font-heading-md leading-none truncate uppercase text-on-surface',
          SIZE_NAME[size],
        ].join(' ')}>
          {player.nameEn}
        </div>
        <div className="text-[7px] text-outline/40 mt-[2px] truncate">{player.team} · {player.year}</div>
      </div>
    </button>
  )
}
