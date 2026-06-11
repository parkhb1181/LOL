'use client'
// §6.2 PlayerCard — size variant: 'pick' | 'slot' | 'result'
// 색·재질 토큰은 CSS 변수로만 수신 (DESIGN_GUIDE 토큰 확정 전 하드코딩 금지)
// 사진: 결정론적 R2 URL(NEXT_PUBLIC_R2_PUBLIC_BASE_URL/players/{id}.webp) → onError 아바타 폴백
// players.json photo 필드 불사용 — R2에 파일이 올라오는 대로 자동 반영

import Image from 'next/image'
import { useState } from 'react'
import type { PlayerSeason } from '@/lib/data'

// 결정론적 R2 URL 생성 — 환경변수 미설정 또는 NEXT_PUBLIC_PHOTOS_ENABLED=false 시 null
function photoUrl(id: string): string | null {
  if (process.env.NEXT_PUBLIC_PHOTOS_ENABLED === 'false') return null
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL
  return base ? `${base}/players/${id}.webp` : null
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

// OVR 등급 — DESIGN_GUIDE v1.0 전 임시 임계값 (토큰 확정 후 CSS 변수로 대체)
function getOvrTier(ovr: number): 'legendary' | 'gold' | 'silver' | 'base' {
  if (ovr >= 99) return 'legendary'
  if (ovr >= 90) return 'gold'
  if (ovr >= 84) return 'silver'
  return 'base'
}

export default function PlayerCard({ player, size = 'pick', disabled = false, onClick }: Props) {
  // imgError: 초기값 false(hydration 안전) — onError 시 아바타로 전환
  const [imgError, setImgError] = useState(false)
  // crownError: crown.png 미수령 시 broken icon 대신 레이어 전체 숨김
  const [crownError, setCrownError] = useState(false)

  // 버그3 fix: IGN(nameEn) 항상 표시 — nameKo는 실명이라 언어 토글과 무관하게 닉네임 고정
  const name = player.nameEn
  const isWorlds = player.frame === 'WORLDS'
  const hasCrown = player.crown
  const hasMsi = player.msiWinner
  const badges = player.badges
  const tier = getOvrTier(player.ovr)

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        SIZE_CLS[size],
        'relative flex flex-col rounded-lg overflow-hidden select-none transition-transform',
        // 배경: OVR 등급별 (임시 — DESIGN_GUIDE v1.0 토큰 교체 예정)
        tier === 'legendary' ? 'bg-[var(--card-legendary-bg,#131000)]' :
        tier === 'gold'      ? 'bg-[var(--card-gold-bg,#110f07)]' :
        tier === 'silver'    ? 'bg-[var(--card-silver-bg,#0f1012)]' :
                               'bg-[var(--card-bg,#1a1a2e)]',
        'border',
        // 테두리: WORLDS 프레임 우선, 아니면 OVR 등급
        isWorlds
          ? 'border-[var(--card-worlds-border,#c0a060)] shadow-[0_0_12px_var(--card-worlds-glow,#c0a06055)]'
          : tier === 'legendary'
            ? 'border-[var(--card-legendary-border,#d4a017)] shadow-[0_0_10px_var(--card-legendary-glow,#d4a01730)]'
            : tier === 'gold'
              ? 'border-[var(--card-gold-border,#7a5f10)]'
              : tier === 'silver'
                ? 'border-[var(--card-silver-border,#505870)]'
                : 'border-[var(--card-border,#2a2a4a)]',
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'cursor-pointer hover:scale-105 active:scale-95',
      ].join(' ')}
      aria-label={`${player.nameEn} ${player.year} ${player.team}`}
    >
      {/* WORLDS 시머 스윕 — WORLDS 프레임 전용 */}
      {isWorlds && (
        <span className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-lg" aria-hidden>
          <span className="absolute -inset-full animate-[shimmer_2.5s_linear_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12" />
        </span>
      )}
      {/* legendary(OVR 99) 골드 시머 — WORLDS 아닌 카드 한정 */}
      {tier === 'legendary' && !isWorlds && (
        <span className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-lg" aria-hidden>
          <span className="absolute -inset-full animate-[shimmer_2.5s_linear_infinite] bg-gradient-to-r from-transparent via-[#ffd70018] to-transparent -skew-x-12" />
        </span>
      )}

      {/* 좌상단: OVR + 역할 */}
      <div className="absolute top-1 left-1.5 z-20 flex flex-col leading-none">
        <span className={`${OVR_SIZE[size]} font-black drop-shadow ${
          tier === 'legendary' ? 'text-[var(--card-legendary-ovr,#ffd700)]' :
          tier === 'gold'      ? 'text-[var(--card-gold-ovr,#d4a540)]' :
          tier === 'silver'    ? 'text-[var(--card-silver-ovr,#c8cdd6)]' :
                                 'text-[var(--card-ovr,#f0f0f0)]'
        }`}>
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
        {photoUrl(player.id) && !imgError ? (
          <Image
            // 결정론적 URL: R2에 파일이 있으면 즉시 표시, 없으면 onError → 아바타
            src={photoUrl(player.id)!}
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
        {/* 우승 아이콘 — Worlds(팀) + MSI(팀) 나란히. 위치는 이름 위 */}
        {(isWorlds || hasMsi) && (
          <div className="flex justify-center items-end gap-1 mb-0.5">
            {isWorlds && (
              <div className="relative" style={{ width: size === 'slot' ? 10 : 13, height: size === 'slot' ? 14 : 18 }}>
                <Image src="/img/world.png" alt="Worlds" fill className="object-contain drop-shadow" />
              </div>
            )}
            {hasMsi && (
              <div className="relative" style={{ width: size === 'slot' ? 9 : 12, height: size === 'slot' ? 14 : 18 }}>
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
