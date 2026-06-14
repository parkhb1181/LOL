import type { BattlePlayer } from '@/lib/battle/utils';
import { formatLabel } from '@/lib/battle/utils';

interface IntroCardProps {
  player: BattlePlayer;
  color: string;
  className?: string;
}

// PlayerCard(본체) 구조 복제:
//   aspect-[5/7] / 사진 absolute inset-0 full-bleed / 하단 그라디언트 /
//   OVR 좌상단 / role+name+team 좌하단 오버레이
// 배틀 전용 컴포넌트 — PlayerCard 수정 없이 독립 구현
export default function IntroCard({ player, color, className = '' }: IntroCardProps) {
  const label = formatLabel(player.nameEn, player.year); // "{year2} {nameEn}"

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
          <span className="text-white font-black text-4xl">
            {player.nameEn[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
      )}

      {/* 하단 그라디언트 오버레이 (PlayerCard 동일 수식) */}
      <div
        className="absolute inset-x-0 bottom-0 h-[42%] pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(20,20,28,1) 0%, rgba(20,20,28,0.85) 40%, transparent 100%)' }}
      />

      {/* 팀 컬러 하단 라인 (슬롯 색 식별) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 z-20" style={{ background: color }} />

      {/* OVR + 리그 배지 — 좌상단 (PlayerCard: absolute top-2 left-2) */}
      <div className="absolute top-1.5 left-1.5 z-20 flex flex-col items-center leading-none">
        <span className="text-white font-black text-2xl leading-none drop-shadow-lg">
          {player.ovr}
        </span>
        <span
          className="text-[7px] font-bold px-1 py-[1px] rounded-sm uppercase tracking-wide mt-0.5 text-white leading-none"
          style={{ backgroundColor: color }}
        >
          {player.league}
        </span>
      </div>

      {/* 하단 텍스트 오버레이 — 그라디언트 위 (PlayerCard: absolute bottom-2.5 left-2.5) */}
      <div
        className="absolute bottom-2 left-2 right-2 z-20"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)' }}
      >
        <div className="text-white/60 text-[7px] uppercase tracking-wide leading-none">
          {player.role}
        </div>
        {/* label = "{year2} {nameEn}" 형식 */}
        <div className="text-white font-bold text-[11px] leading-tight truncate uppercase mt-0.5">
          {label}
        </div>
        <div className="text-white/60 text-[7px] mt-0.5 truncate">
          {player.team}
        </div>
      </div>
    </div>
  );
}
