import type { BattlePlayer } from '@/lib/battle/utils';
import { formatLabel } from '@/lib/battle/utils';

interface IntroCardProps {
  player: BattlePlayer;
  color: string;
  className?: string;
}

export default function IntroCard({ player, color, className = '' }: IntroCardProps) {
  const label = formatLabel(player.nameEn, player.year);

  return (
    <div className={`rounded-xl overflow-hidden bg-[#111827] flex flex-col shadow-lg ${className}`}>
      {/* 사진 영역 — aspect-square(1:1) = PC 카드 비율, 모바일 세로 비율(3/4)에서 변경 */}
      <div className="relative w-full aspect-square flex-shrink-0">
        {player.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photo}
            alt={player.nameEn}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: color }}>
            <span className="text-white font-bold text-5xl">
              {player.nameEn[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
        )}
        {/* OVR 배지 — 좌상단 */}
        <div className="absolute top-1.5 left-1.5 rounded px-1.5 py-0.5 bg-black/70">
          <span className="text-white font-bold text-sm leading-none">{player.ovr}</span>
        </div>
        {/* 팀 컬러 하단 라인 */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: color }} />
      </div>

      {/* 이름·역할 정보 */}
      <div className="px-2 py-1.5 text-center">
        <p className="text-white font-bold text-xs leading-tight line-clamp-1">{label}</p>
        <p className="text-[#6b7280] text-[10px] mt-0.5 line-clamp-1">{player.role} · {player.team}</p>
      </div>
    </div>
  );
}
