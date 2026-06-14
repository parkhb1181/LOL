'use client';

import { useState, useEffect } from 'react';
import type { BattlePlayer } from '@/lib/battle/utils';
import { formatLabel } from '@/lib/battle/utils';
import IntroCard from './IntroCard';
import BattleArena from './BattleArena';

const SLOT_COLORS = ['#ef4444', '#3b82f6'] as const;
const INTRO_DURATION_MS = 2000;

type InnerPhase = 'intro' | 'battle' | 'result';

interface Props {
  playerA: BattlePlayer;
  playerB: BattlePlayer;
}

export default function BattleFrame({ playerA, playerB }: Props) {
  const [innerPhase, setInnerPhase] = useState<InnerPhase>('intro');
  const [winnerLabel, setWinnerLabel] = useState('');
  const [introVisible, setIntroVisible] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);

  // 인트로 카드 등장 애니메이션 (마운트 직후 50ms delay로 CSS transition 발동)
  useEffect(() => {
    if (innerPhase !== 'intro') return;
    setIntroVisible(false);
    const t = setTimeout(() => setIntroVisible(true), 50);
    return () => clearTimeout(t);
  }, [innerPhase]);

  // 인트로 → 배틀 자동 전환
  useEffect(() => {
    if (innerPhase !== 'intro') return;
    const t = setTimeout(() => setInnerPhase('battle'), INTRO_DURATION_MS);
    return () => clearTimeout(t);
  }, [innerPhase]);

  // 결과 화면 fade-in
  useEffect(() => {
    if (innerPhase !== 'result') return;
    setResultVisible(false);
    const t = setTimeout(() => setResultVisible(true), 50);
    return () => clearTimeout(t);
  }, [innerPhase]);

  const handleBattleEnd = (label: string) => {
    setWinnerLabel(label);
    setInnerPhase('result');
  };

  const labelA = formatLabel(playerA.nameEn, playerA.year);
  const labelB = formatLabel(playerB.nameEn, playerB.year);
  const isDraw = winnerLabel === 'DRAW';
  const winnerPlayer = isDraw
    ? null
    : winnerLabel === labelA ? playerA : playerB;
  const winnerColor = winnerLabel === labelA ? SLOT_COLORS[0] : SLOT_COLORS[1];

  return (
    // 9:16 고정 프레임 — 틱톡/릴스/쇼츠 녹화 비율
    <div
      className="relative bg-white flex flex-col overflow-hidden w-full rounded-2xl shadow-xl border border-[#e5e7eb]"
      style={{ maxWidth: 405, aspectRatio: '9/16' }}
    >
      {/* ── URL 상단 고정 (전 phase 공통) ──
           틱톡/릴스/쇼츠 UI가 하단을 가리므로 상단에 배치 */}
      <div className="flex-shrink-0 border-b border-[#f3f4f6] py-2.5 text-center">
        <p className="text-[#9ca3af] text-xs tracking-widest font-medium">
          grandslamlol.vercel.app
        </p>
      </div>

      {/* ── 메인 컨텐츠 ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4 min-h-0">

        {/* ── 인트로 ── */}
        {innerPhase === 'intro' && (
          <>
            <p className="text-[#374151] text-sm font-semibold tracking-wide text-center">
              {labelA}
              <span className="mx-2 text-[#d1d5db]">vs</span>
              {labelB}
            </p>

            <div className="flex items-center gap-3 w-full">
              {/* 왼쪽 카드 — 왼쪽에서 슬라이드 인 */}
              <div
                className={`flex-1 min-w-0 transition-all duration-500 ${
                  introVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
                }`}
              >
                <IntroCard player={playerA} color={SLOT_COLORS[0]} className="w-full" />
              </div>

              {/* VS */}
              <div
                className={`flex-shrink-0 transition-all duration-500 delay-150 ${
                  introVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                }`}
              >
                <span className="text-[#d1d5db] font-bold text-2xl">VS</span>
              </div>

              {/* 오른쪽 카드 — 오른쪽에서 슬라이드 인 */}
              <div
                className={`flex-1 min-w-0 transition-all duration-500 ${
                  introVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
                }`}
              >
                <IntroCard player={playerB} color={SLOT_COLORS[1]} className="w-full" />
              </div>
            </div>
          </>
        )}

        {/* ── 배틀 ── */}
        {innerPhase === 'battle' && (
          <>
            <p className="text-[#9ca3af] text-xs tracking-widest">
              {labelA}  ·  {labelB}
            </p>
            {/* frameMode: 버튼/라벨 숨김, autoStart: 자동 시작 */}
            <BattleArena
              playerA={playerA}
              playerB={playerB}
              autoStart
              frameMode
              onBattleEnd={handleBattleEnd}
            />
          </>
        )}

        {/* ── 결과 ── */}
        {innerPhase === 'result' && (
          <div
            className={`flex flex-col items-center gap-5 w-full transition-all duration-500 ${
              resultVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="text-center">
              <p className="text-[#fbbf24] font-bold text-3xl tracking-widest">WINNER</p>
              {isDraw ? (
                <p className="text-[#6b7280] font-bold text-xl mt-1">DRAW</p>
              ) : (
                <p className="text-[#111827] font-bold text-xl mt-1">{winnerLabel}</p>
              )}
            </div>

            {winnerPlayer && (
              // 승자 카드 — 인트로 대비 확대 (w-[55%])
              <div className="w-[55%]">
                <IntroCard player={winnerPlayer} color={winnerColor} className="w-full" />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
