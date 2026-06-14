'use client';

import { useState, useMemo } from 'react';
import type { BattlePlayer } from '@/lib/battle/utils';
import { randomPair, sortedByOvr, formatLabel } from '@/lib/battle/utils';

interface Props {
  players: BattlePlayer[];
  onSelect: (a: BattlePlayer, b: BattlePlayer) => void;
}

export default function MatchPicker({ players, onSelect }: Props) {
  const sorted = useMemo(() => sortedByOvr(players), [players]);

  // lazy init — sorted가 이미 준비된 상태에서 마운트됨 (BattleClient가 로드 완료 후 렌더)
  const [idA, setIdA] = useState<string>(() => sorted[0]?.id ?? '');
  const [idB, setIdB] = useState<string>(() => sorted[1]?.id ?? '');

  const playerMap = useMemo(
    () => new Map(players.map(p => [p.id, p])),
    [players],
  );

  const handleRandom = () => {
    if (sorted.length < 2) return;
    const [a, b] = randomPair(sorted);
    setIdA(a.id);
    setIdB(b.id);
  };

  const handleStart = () => {
    const a = playerMap.get(idA);
    const b = playerMap.get(idB);
    if (!a || !b) return;
    onSelect(a, b);
  };

  // 드롭다운 표시 형식: "16 FAKER (LCK) OVR:99"
  const optLabel = (p: BattlePlayer) =>
    `${formatLabel(p.nameEn, p.year)} (${p.league}) OVR:${p.ovr}`;

  const canStart = !!idA && !!idB && idA !== idB;

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex gap-3 items-center">
        <select
          value={idA}
          onChange={e => setIdA(e.target.value)}
          className="flex-1 min-w-0 bg-[#1a1a2e] text-white border border-[#2a2a4a] rounded-lg px-3 py-2 text-sm"
        >
          {sorted.map(p => (
            <option key={p.id} value={p.id}>{optLabel(p)}</option>
          ))}
        </select>

        <span className="text-[#6b7280] font-bold text-sm flex-shrink-0">VS</span>

        <select
          value={idB}
          onChange={e => setIdB(e.target.value)}
          className="flex-1 min-w-0 bg-[#1a1a2e] text-white border border-[#2a2a4a] rounded-lg px-3 py-2 text-sm"
        >
          {sorted.map(p => (
            <option key={p.id} value={p.id}>{optLabel(p)}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleRandom}
          disabled={sorted.length < 2}
          className="flex-1 py-2.5 bg-[#1a1a2e] hover:bg-[#2a2a4a] disabled:opacity-40 text-[#9ca3af] border border-[#2a2a4a] font-semibold rounded-lg transition-colors text-sm"
        >
          랜덤 매치업
        </button>
        <button
          onClick={handleStart}
          disabled={!canStart}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors text-sm"
        >
          배틀 시작
        </button>
      </div>
    </div>
  );
}
