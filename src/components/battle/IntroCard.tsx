import type { BattlePlayer } from '@/lib/battle/utils';
import { formatLabel } from '@/lib/battle/utils';

interface IntroCardProps {
  player: BattlePlayer;
  color: string;
  className?: string;
}

// PlayerCard(본체) 구조 + 폰트 동일 복제:
//   aspect-[5/7] / 사진 absolute inset-0 full-bleed / 하단 그라디언트 /
//   OVR 좌상단 (font-ovr-display, text-secondary gold) /
//   role+name+team 좌하단 오버레이 (font-heading-md / font-label-caps)
// 배틀 전용 컴포넌트 — PlayerCard 수정 없이 독립 구현, md: 반응형 없음 (항상 PC 카드 레이아웃)

const LEAGUE_BG: Record<string, string> = {
  LCK: '#0284c7',
  LPL: '#dc2626',
  LEC: '#7e22ce',
  LCS: '#f97316',
};

export default function IntroCard({ player, color, className = '' }: IntroCardProps) {
  const label = formatLabel(player.nameEn, player.year);
  const leagueBg = LEAGUE_BG[player.league] ?? '#374151';

  return (
    <div className={`relative rounded-xl overflow-hidden bg-[#14141c] aspect-[5/7] ${className}`}>

      {/* 사진 — 카드 전체 채움 (PlayerCard: absolute inset-0 object-cover) */}
      {player.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={player.photo}
          alt={player.nameEn}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      ) : (
        <div
          className="absolute inset-0 w-full h-full flex items-center justify-center"
          style={{ background: color }}
        >
          <span className="font-ovr-display text-white text-4xl">
            {player.nameEn[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
      )}

      {/* 하단 그라디언트 오버레이 — 텍스트 확장에 맞춰 높이 증가 */}
      <div
        className="absolute inset-x-0 bottom-0 h-[52%] pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(20,20,28,1) 0%, rgba(20,20,28,0.85) 45%, transparent 100%)' }}
      />

      {/* 팀 컬러 하단 라인 (슬롯 색 식별) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 z-20" style={{ background: color }} />

      {/* OVR + 리그 배지 — 좌상단 (PlayerCard: absolute top-2 left-2) */}
      <div className="absolute top-1.5 left-1.5 z-20 flex flex-col items-start leading-none">
        {/* Anton 폰트, 골드색 + glow — PlayerCard의 font-ovr-display text-secondary text-glow-gold */}
        <span className="font-ovr-display text-[28px] leading-none text-secondary text-glow-gold drop-shadow">
          {player.ovr}
        </span>
        {/* 리그별 고유 컬러 배지 (슬롯색이 아닌 리그 브랜드색) */}
        <span
          className="font-label-caps text-[7px] px-1.5 py-[2px] rounded-sm uppercase tracking-wider mt-1 text-white leading-none"
          style={{ backgroundColor: leagueBg }}
        >
          {player.league}
        </span>
      </div>

      {/* 하단 텍스트 오버레이 — 그라디언트 위 */}
      <div className="absolute bottom-2.5 left-2.5 right-2 z-20">
        {/* 포지션 */}
        <div className="font-label-caps text-[10px] text-white/60 uppercase tracking-wide leading-none">
          {player.role}
        </div>
        {/* 이름 — Bebas Neue, 카드 폭 대비 시원한 크기 */}
        <div className="font-heading-md text-[18px] leading-tight truncate uppercase text-on-surface mt-0.5">
          {label}
        </div>
        {/* 팀명 */}
        <div className="font-label-caps text-[9px] text-white/60 mt-0.5 truncate">
          {player.team}
        </div>
      </div>
    </div>
  );
}
