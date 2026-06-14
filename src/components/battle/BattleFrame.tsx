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

  // 인트로 카드 슬라이드인 (마운트 50ms 후 CSS transition 발동)
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

  const winnerPlayer = isDraw ? null : (winnerLabel === labelA ? playerA : playerB);
  const winnerColor = winnerLabel === labelA ? SLOT_COLORS[0] : SLOT_COLORS[1];
  const loserPlayer = isDraw ? null : (winnerLabel === labelA ? playerB : playerA);
  const loserColor = winnerLabel === labelA ? SLOT_COLORS[1] : SLOT_COLORS[0];

  return (
    // 9:16 고정 프레임 — 틱톡/릴스/쇼츠 녹화 비율
    <div
      className="relative bg-white flex flex-col overflow-hidden w-full rounded-2xl shadow-xl border border-[#e5e7eb]"
      style={{ maxWidth: 405, aspectRatio: '9/16' }}
    >
      {/* ── URL 상단 고정 (전 phase 공통) ──
           틱톡/릴스/쇼츠 UI가 하단을 가리므로 상단에 배치 */}
      <div className="flex-shrink-0 border-b border-[#f3f4f6] py-2 text-center">
        <p className="text-[#9ca3af] text-xs tracking-widest font-medium">
          grandslamlol.vercel.app
        </p>
      </div>

      {/* ── 메인 컨텐츠 ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-3 min-h-0">

        {/* ── 인트로 ── */}
        {innerPhase === 'intro' && (
          <>
            {/* 매치업 텍스트 — "20 CANYON  vs  13 FAKER" */}
            <p className="text-[#1f2937] text-sm font-bold tracking-wide text-center leading-snug">
              {labelA}
              <span className="mx-2 text-[#9ca3af] font-normal">vs</span>
              {labelB}
            </p>

            <div className="flex items-center gap-2 w-full">
              {/* 왼쪽 카드 — 왼쪽에서 슬라이드인 */}
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
                <span className="text-[#9ca3af] font-bold text-xl">VS</span>
              </div>

              {/* 오른쪽 카드 — 오른쪽에서 슬라이드인 */}
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
            <p className="text-[#9ca3af] text-xs tracking-widest flex-shrink-0">
              {labelA}  ·  {labelB}
            </p>
            <BattleArena
              playerA={playerA}
              playerB={playerB}
              autoStart
              frameMode
              onBattleEnd={handleBattleEnd}
            />
          </>
        )}

        {/* ── 결과 — 승자 카드 크게, 패자 작게/흐리게 ── */}
        {innerPhase === 'result' && (
          <div
            className={`flex flex-col items-center gap-4 w-full transition-all duration-500 ${
              resultVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {/* 승패 텍스트 */}
            <div className="text-center">
              {isDraw ? (
                <p className="text-[#6b7280] font-bold text-2xl tracking-widest">DRAW</p>
              ) : (
                <>
                  <p className="text-[#fbbf24] font-bold text-lg tracking-widest leading-none">WINNER</p>
                  <p className="text-[#111827] font-bold text-base mt-0.5">{winnerLabel}</p>
                </>
              )}
            </div>

            {/* 승자 카드 + 패자 카드 나란히 (승자 크게, 패자 작게 흐리게) */}
            {!isDraw && winnerPlayer ? (
              <div className="flex items-end gap-3 w-full justify-center">
                {/* 승자 카드 — 크게 */}
                <div className="w-[58%]">
                  <IntroCard player={winnerPlayer} color={winnerColor} className="w-full" />
                </div>
                {/* 패자 카드 — 작게, 흐리게 */}
                {loserPlayer && (
                  <div className="w-[33%] opacity-30 self-end mb-1">
                    <IntroCard player={loserPlayer} color={loserColor} className="w-full" />
                  </div>
                )}
              </div>
            ) : (
              // DRAW: 두 카드 동일 크기
              <div className="flex gap-3 w-full justify-center">
                <div className="w-[44%]">
                  <IntroCard player={playerA} color={SLOT_COLORS[0]} className="w-full" />
                </div>
                <div className="w-[44%]">
                  <IntroCard player={playerB} color={SLOT_COLORS[1]} className="w-full" />
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
