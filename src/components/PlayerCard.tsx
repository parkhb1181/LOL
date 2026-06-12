'use client'
// §6.2 PlayerCard — size variant: 'pick' | 'slot' | 'result'
// 색·재질 토큰은 CSS 변수로만 수신 (DESIGN_GUIDE 토큰 확정 전 하드코딩 금지)
// 사진: player.photo (players.json R2 URL) → onError 아바타 폴백
// §5 킬스위치: NEXT_PUBLIC_PHOTOS_ENABLED=false 시 전원 아바타
// photo 소스: players.json의 photo 필드 (R2 URL) — env var 불사용

import Image from 'next/image'
import { useState } from 'react'
import type { PlayerSeason } from '@/lib/data'

// §5 킬스위치 적용 후 photo 필드 반환 — player.photo 직접 반환, env var 미사용
function photoSrc(player: PlayerSeason): string | null {
  if (process.env.NEXT_PUBLIC_PHOTOS_ENABLED === 'false') return null
  return player.photo ?? null  // players.json R2 URL, 없으면 null
}

export type CardSize = 'pick' | 'slot' | 'result'

type Props = {
  player: PlayerSeason
  size?: CardSize
  disabled?: boolean
  onClick?: () => void
}

const SIZE_CLS: Record<CardSize, string> = {
  pick:   'w-28 h-40',   // 세로 5:7 비율 (112px × 160px)
  slot:   'w-20 h-28',
  result: 'w-36 h-52',
}

const OVR_SIZE: Record<CardSize, string> = {
  pick:   'text-2xl',
  slot:   'text-lg',
  result: 'text-3xl',
}

// 역할 약어
const ROLE_ABBR: Record<string, string> = {
  TOP: 'TOP', JGL: 'JGL', MID: 'MID', ADC: 'ADC', SUP: 'SUP',
}

// 이니셜 아바타 배경색 (팀 컬러 대신 임시 — DESIGN_GUIDE 토큰 대체 예정)
function avatarBg(teamSlug: string): string {
  // 팀슬러그 해시 → CSS 변수 fallback (var(--card-avatar-bg) 미정의 시 회색)
  const h = [...teamSlug].reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const hues = [210, 150, 30, 280, 350, 190, 60, 320]
  return `hsl(${hues[h % hues.length]}, 40%, 35%)`
}

export default function PlayerCard({ player, size = 'pick', disabled = false, onClick }: Props) {
  // imgError: 초기값 false(hydration 안전) — onError 시 아바타로 전환
  const [imgError, setImgError] = useState(false)
  // crownError: crown.png 미수령 시 broken icon 대신 레이어 전체 숨김
  const [crownError, setCrownError] = useState(false)

  const name = player.nameEn
  const isWorlds = player.frame === 'WORLDS'
  const hasCrown = player.crown
  const hasMsi = player.msiWinner
  const badges = player.badges

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
      {/* WORLDS 시머 스윕 — globals.css @keyframes shimmer 사용 */}
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

      {/* 우상단: 배지 (최대 2개) */}
      {badges.length > 0 && (
        <div className="absolute top-1 right-1 z-20 flex flex-col gap-0.5">
          {badges.map(b => (
            <span
              key={b}
              className="text-[7px] font-bold bg-[var(--card-badge-bg,#2a4a8a)] text-[var(--card-badge-text,#80aaff)] px-1 py-0.5 rounded-sm uppercase"
            >
              {b === 'LEAGUE_CHAMP' ? 'LC' : 'A1'}
            </span>
          ))}
        </div>
      )}

      {/* 중앙 사진 / 아바타 */}
      <div className="flex-1 relative w-full">
        {photoSrc(player) && !imgError ? (
          <Image
            src={photoSrc(player)!}
            alt={player.nameEn}
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 112px, 144px"
            onError={() => setImgError(true)}
          />
        ) : (
          // 아바타 폴백: 이니셜 + 팀컬러 그라디언트
          <div
            className="absolute inset-0 flex items-center justify-center text-white/80 font-black text-2xl"
            style={{ background: avatarBg(player.teamSlug) }}
          >
            {player.nameEn.charAt(0).toUpperCase()}
          </div>
        )}

        {/* 왕관 오버레이 — WORLDS_MVP 개인 수상자 (Cursor 에셋 생성 금지)
            crownError 시 div 전체 숨김 — broken icon 방지 */}
        {hasCrown && !crownError && (
          <div className="absolute top-9 left-1 z-20 w-5 h-5 -rotate-12 pointer-events-none">
            <Image
              src="/img/crown.png"
              alt="crown"
              width={20}
              height={20}
              className="object-contain drop-shadow"
              onError={() => setCrownError(true)}
            />
          </div>
        )}
      </div>

      {/* 하단: 아이콘 + 이름 + 팀·연도 */}
      <div className="px-1.5 pb-1.5 pt-1 bg-[var(--card-footer-bg,#0d0d1a)]">
        {/* 우승 아이콘 — Worlds(팀) + MSI(팀) 나란히. Worlds가 MSI보다 명확히 크게 */}
        {(isWorlds || hasMsi) && (
          <div className="flex justify-center items-end gap-1 mb-0.5">
            {isWorlds && (
              <div className="relative flex-shrink-0" style={{ width: size === 'slot' ? 12 : 16, height: size === 'slot' ? 16 : 22 }}>
                <Image src="/img/world.png" alt="Worlds" fill className="object-contain drop-shadow" />
              </div>
            )}
            {hasMsi && (
              <div className="relative flex-shrink-0" style={{ width: size === 'slot' ? 9 : 11, height: size === 'slot' ? 12 : 15 }}>
                <Image src="/img/msi.png" alt="MSI" fill className="object-contain drop-shadow" />
              </div>
            )}
          </div>
        )}
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
