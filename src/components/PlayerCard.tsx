'use client'
// §6.2 PlayerCard — size variant: 'pick' | 'slot' | 'result'
// 색·재질 토큰은 CSS 변수로만 수신 (DESIGN_GUIDE 토큰 확정 전 하드코딩 금지)
// §5 킬스위치: NEXT_PUBLIC_PHOTOS_ENABLED=false 시 전원 아바타

import Image from 'next/image'
import { useState } from 'react'
import type { PlayerSeason } from '@/lib/data'

function photoSrc(player: PlayerSeason): string | null {
  if (process.env.NEXT_PUBLIC_PHOTOS_ENABLED === 'false') return null
  return player.photo ?? null
}

export type CardSize = 'pick' | 'slot' | 'result'

type Props = {
  player: PlayerSeason
  size?: CardSize
  disabled?: boolean
  onClick?: () => void
}

const SIZE_CLS: Record<CardSize, string> = {
  pick:   'w-28 h-40',
  slot:   'w-20 h-28',
  result: 'w-36 h-52',
}

const OVR_SIZE: Record<CardSize, string> = {
  pick:   'text-2xl',
  slot:   'text-lg',
  result: 'text-3xl',
}

const ROLE_ABBR: Record<string, string> = {
  TOP: 'TOP', JGL: 'JGL', MID: 'MID', ADC: 'ADC', SUP: 'SUP',
}

// 리그별 배지 색상 — 식별 우선
const LEAGUE_BADGE: Record<string, string> = {
  LCK: 'bg-red-900/70 text-red-300',
  LPL: 'bg-blue-900/70 text-blue-300',
  LEC: 'bg-purple-900/70 text-purple-300',
  LCS: 'bg-orange-900/70 text-orange-300',
}

function avatarBg(teamSlug: string): string {
  const h = [...teamSlug].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hues = [210, 150, 30, 280, 350, 190, 60, 320]
  return `hsl(${hues[h % hues.length]}, 40%, 35%)`
}

export default function PlayerCard({ player, size = 'pick', disabled = false, onClick }: Props) {
  const [imgError, setImgError] = useState(false)
  const [crownError, setCrownError] = useState(false)

  const name = player.nameEn
  const isWorlds = player.frame === 'WORLDS'
  const hasCrown = player.crown
  const hasMsi = player.msiWinner
  const badges = player.badges

  // 트로피 크기 — 1.5배 (기존 대비)
  const trophyW = { worlds: size === 'slot' ? 18 : 24, msi: size === 'slot' ? 14 : 17 }
  const trophyH = { worlds: size === 'slot' ? 24 : 33, msi: size === 'slot' ? 19 : 23 }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        SIZE_CLS[size],
        'relative flex flex-col rounded-lg overflow-hidden select-none transition-transform',
        'bg-[var(--card-bg,#1a1a2e)] border',
        isWorlds
          ? 'border-[var(--card-worlds-border,#c0a060)] shadow-[0_0_12px_var(--card-worlds-glow,#c0a06055)]'
          : 'border-[var(--card-border,#2a2a4a)]',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-pointer hover:scale-105 active:scale-95',
      ].join(' ')}
      aria-label={`${player.nameEn} ${player.year} ${player.team}`}
    >
      {/* WORLDS 시머 스윕 */}
      {isWorlds && (
        <span className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-lg" aria-hidden>
          <span className="absolute inset-y-0 w-full animate-[shimmer_2.5s_linear_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </span>
      )}

      {/* 좌상단: OVR + 역할 */}
      <div className="absolute top-1 left-1.5 z-20 flex flex-col leading-none">
        <span className={`${OVR_SIZE[size]} font-black drop-shadow text-[var(--card-ovr,#f0f0f0)]`}>
          {player.ovr}
        </span>
        <span className="text-[10px] font-semibold text-[var(--card-role,#a0a0c0)] uppercase tracking-wider">
          {ROLE_ABBR[player.role] ?? player.role}
        </span>
      </div>

      {/* 우상단: 리그 뱃지(항상) + All-Pro 뱃지(해당자만) */}
      <div className="absolute top-1 right-1 z-20 flex flex-col gap-0.5">
        <span className={`text-[7px] font-bold px-1 py-0.5 rounded-sm uppercase leading-none ${LEAGUE_BADGE[player.league] ?? 'bg-[var(--card-badge-bg,#2a4a8a)] text-[var(--card-badge-text,#80aaff)]'}`}>
          {player.league}
        </span>
        {badges.includes('ALLPRO_1ST') && (
          <span className="text-[7px] font-bold bg-yellow-900/70 text-yellow-300 px-1 py-0.5 rounded-sm leading-none">
            ALL-PRO
          </span>
        )}
      </div>

      {/* 중앙 사진 / 아바타 */}
      {/* plain <img> 사용 — Next.js Image Optimizer 경유 시 R2 onError 폴백 버그 회피 */}
      <div className="flex-1 relative w-full" data-photo={player.photo ?? 'null'}>
        {photoSrc(player) && !imgError ? (
          <img
            src={photoSrc(player)!}
            alt={player.nameEn}
            className="absolute inset-0 w-full h-full object-cover object-top"
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-white/80 font-black text-2xl"
            style={{ background: avatarBg(player.teamSlug) }}
          >
            {player.nameEn.charAt(0).toUpperCase()}
          </div>
        )}

        {/* 왕관 오버레이 — 사진 좌상단 (CURSOR_GUIDE §6.2 — 에셋 수정 금지) */}
        {hasCrown && !crownError && (
          <div className="absolute top-2 left-1.5 z-20 w-7 h-7 -rotate-12 pointer-events-none">
            <Image
              src="/img/crown.png"
              alt="crown"
              width={28}
              height={28}
              className="object-contain drop-shadow"
              onError={() => setCrownError(true)}
            />
          </div>
        )}

        {/* 트로피 오버레이 — 사진 우하단 (누끼 배경제거 처리됨, 1.5배 크기) */}
        {(isWorlds || hasMsi) && (
          <div className="absolute bottom-1 right-1 z-20 flex gap-0.5 items-end pointer-events-none">
            {isWorlds && (
              <div className="relative" style={{ width: trophyW.worlds, height: trophyH.worlds }}>
                <Image src="/img/world.png" alt="Worlds" fill className="object-contain drop-shadow" />
              </div>
            )}
            {hasMsi && (
              <div className="relative" style={{ width: trophyW.msi, height: trophyH.msi }}>
                <Image src="/img/msi.png" alt="MSI" fill className="object-contain drop-shadow" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 하단: 이름 + 팀·연도 */}
      <div className="px-1.5 pb-1.5 pt-1 bg-[var(--card-footer-bg,#0d0d1a)]">
        <p className="text-center text-[var(--card-name,#e8e8f0)] font-semibold truncate leading-tight" style={{ fontSize: size === 'slot' ? '9px' : '11px' }}>
          {name}
        </p>
        <p className="text-center text-[var(--card-meta,#6868a0)] truncate" style={{ fontSize: '8px' }}>
          {player.team} · {player.year}
        </p>
      </div>
    </button>
  )
}
