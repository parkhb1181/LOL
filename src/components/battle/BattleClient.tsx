'use client';

import { useState, useEffect } from 'react';
import type { BattlePlayer } from '@/lib/battle/utils';
import MatchPicker from './MatchPicker';
import BattleArena from './BattleArena';

export default function BattleClient() {
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<[BattlePlayer, BattlePlayer] | null>(null);
  // key 변경 → BattleArena 리마운트 (물리 상태 완전 초기화)
  const [battleKey, setBattleKey] = useState(0);

  // 마운트 후 players.json 로드 (번들 포함 X — public/ 정적 파일 fetch)
  useEffect(() => {
    fetch('/data/players.json')
      .then(r => r.json())
      .then((data: unknown) => {
        setPlayers(data as BattlePlayer[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelect = (a: BattlePlayer, b: BattlePlayer) => {
    setSelected([a, b]);
    setBattleKey(k => k + 1);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-[560px]">
      {loading ? (
        <p className="text-[#6b7280] text-sm">선수 데이터 로딩 중...</p>
      ) : (
        <MatchPicker players={players} onSelect={handleSelect} />
      )}

      {selected && (
        <BattleArena
          key={battleKey}
          playerA={selected[0]}
          playerB={selected[1]}
        />
      )}
    </div>
  );
}
