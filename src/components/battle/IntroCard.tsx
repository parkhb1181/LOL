import type { BattlePlayer } from '@/lib/battle/utils';
import { formatLabel } from '@/lib/battle/utils';

interface IntroCardProps {
  player: BattlePlayer;
  color: string; // 슬롯 색 (빨강/파랑)
  className?: string;
}

export default function IntroCard({ player, color, className = '' }: IntroCardProps) {
  const label = formatLabel(player.nameEn, player.year);

  return (
    <div className={`rounded-2xl overflow-hidden bg-[#111827] flex flex-col ${className}`}>
      {/* 사진 영역 */}
      <div className="relative w-full aspect-[3/4] flex-shrink-0">
        {player.photo ? (
          // HTML img — canvas 아님, CORS 불필요
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
        {/* OVR 배지 */}
        <div className="absolute top-2 left-2 rounded px-1.5 py-0.5 bg-black/60">
          <span className="text-white font-bold text-sm leading-none">{player.ovr}</span>
        </div>
        {/* 슬롯 색 하단 바 */}
        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: color }} />
      </div>

      {/* 이름 정보 */}
      <div className="px-2 py-2 text-center">
        <p className="text-white font-bold text-xs leading-tight line-clamp-1">{label}</p>
        <p className="text-[#6b7280] text-[10px] mt-0.5 line-clamp-1">{player.role} · {player.team}</p>
      </div>
    </div>
  );
}
