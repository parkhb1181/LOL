'use client'
// /r 서버 컴포넌트 → PlayerCard(use client) 연결 브릿지
// 서버에서 직렬화된 PlayerSeason[] 수신 → PlayerCard 렌더링
import PlayerCard from './PlayerCard'
import type { PlayerSeason } from '@/lib/data'

type Props = { players: PlayerSeason[] }

export default function ResultCards({ players }: Props) {
  return (
    <div className="flex flex-wrap gap-2 md:gap-3 justify-center w-full">
      {players.map(p => (
        <PlayerCard key={p.id} player={p} size="result" />
      ))}
    </div>
  )
}
