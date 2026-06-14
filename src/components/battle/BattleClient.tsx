'use client';

import { useState, useEffect } from 'react';
import type { BattlePlayer } from '@/lib/battle/utils';
import MatchPicker from './MatchPicker';
import BattleFrame from './BattleFrame';

// outerPhase:
//   'picking' — 드롭다운·랜덤 UI 노출, BattleFrame 미표시
//   'playing' — BattleFrame 표시, 드롭다운 숨김, 버튼 2개(다시 재생·새 매치업) 노출
type OuterPhase = 'picking' | 'playing';

export default function BattleClient() {
  const [players, setPlayers] = useState<BattlePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<[BattlePlayer, BattlePlayer] | null>(null);
  const [outerPhase, setOuterPhase] = useState<OuterPhase>('picking');
  // battleKey 변경 → BattleFrame 리마운트 (intro부터 완전 재시작)
  const [battleKey, setBattleKey] = useState(0);

  // 마운트 후 players.json 로드 (public/ 정적 파일 fetch)
  useEffect(() => {
    fetch('/data/players.json')
      .then(r => r.json())
      .then((data: unknown) => {
        setPlayers(data as BattlePlayer[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // MatchPicker에서 "배틀 시작" — outerPhase를 'playing'으로 전환
  const handleSelect = (a: BattlePlayer, b: BattlePlayer) => {
    setSelected([a, b]);
    setBattleKey(k => k + 1);
    setOuterPhase('playing');
  };

  // "다시 재생" — battleKey 증가로 BattleFrame 리마운트 (intro부터 재시작)
  const handleReplay = () => {
    setBattleKey(k => k + 1);
  };

  // "새 매치업" — 피커 화면으로 복귀
  const handleNewMatch = () => {
    setOuterPhase('picking');
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-[560px]">
      {/* 피킹 화면: 로딩·드롭다운 노출 */}
      {outerPhase === 'picking' && (
        loading ? (
          <p className="text-[#6b7280] text-sm">선수 데이터 로딩 중...</p>
        ) : (
          <MatchPicker players={players} onSelect={handleSelect} />
        )
      )}

      {/* 플레이 화면: BattleFrame + 하단 버튼 2개 */}
      {outerPhase === 'playing' && selected && (
        <>
          <BattleFrame
            key={battleKey}
            playerA={selected[0]}
            playerB={selected[1]}
          />
          <div className="flex gap-3">
            <button
              onClick={handleReplay}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-lg transition-colors text-sm tracking-wide"
            >
              다시 재생
            </button>
            <button
              onClick={handleNewMatch}
              className="px-6 py-2.5 bg-[#374151] hover:bg-[#4b5563] active:bg-[#1f2937] text-white font-bold rounded-lg transition-colors text-sm tracking-wide"
            >
              새 매치업
            </button>
          </div>
        </>
      )}
    </div>
  );
}
