'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { BattlePlayer } from '@/lib/battle/utils';
import { ovrToHp, formatLabel } from '@/lib/battle/utils';

const BALL_RADIUS = 28;
const INIT_SPEED = 3.2;
const DMG_COEFF = 6;
const FLASH_FRAMES = 10;
const SLOT_COLORS = ['#ef4444', '#3b82f6'] as const;

type ImgEntry = HTMLImageElement | 'loading' | 'error';
type ImgCache = Map<string, ImgEntry>;

interface Ball {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  hp: number; maxHp: number;
  color: string;
  photo: string | null;
  label: string;
  initials: string;
}

type Phase = 'idle' | 'running' | 'finished';

interface BattleState {
  balls: Ball[];
  phase: Phase;
  winner: string | null;
  rafId: number;
  flashT: number;
  flashX: number;
  flashY: number;
}

type StepResult = {
  winner: string | null;
  didHit: boolean;
  hitX: number;
  hitY: number;
};

function getOrLoadImage(url: string, cache: ImgCache): HTMLImageElement | null {
  const entry = cache.get(url);
  if (entry instanceof HTMLImageElement) return entry;
  if (entry === 'loading' || entry === 'error') return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  cache.set(url, 'loading');
  img.onload = () => cache.set(url, img);
  img.onerror = () => cache.set(url, 'error');
  img.src = url;
  return null;
}

function makeBalls(size: number, playerA: BattlePlayer, playerB: BattlePlayer): Ball[] {
  return [
    {
      x: size * 0.28, y: size * 0.44,
      vx: INIT_SPEED, vy: INIT_SPEED * 0.6,
      radius: BALL_RADIUS,
      hp: ovrToHp(playerA.ovr), maxHp: ovrToHp(playerA.ovr),
      color: SLOT_COLORS[0],
      photo: playerA.photo,
      label: formatLabel(playerA.nameEn, playerA.year),
      initials: playerA.nameEn[0]?.toUpperCase() ?? 'A',
    },
    {
      x: size * 0.72, y: size * 0.44,
      vx: -INIT_SPEED, vy: -INIT_SPEED * 0.6,
      radius: BALL_RADIUS,
      hp: ovrToHp(playerB.ovr), maxHp: ovrToHp(playerB.ovr),
      color: SLOT_COLORS[1],
      photo: playerB.photo,
      label: formatLabel(playerB.nameEn, playerB.year),
      initials: playerB.nameEn[0]?.toUpperCase() ?? 'B',
    },
  ];
}

function stepPhysics(balls: Ball[], size: number): StepResult {
  const [a, b] = balls;
  a.x += a.vx; a.y += a.vy;
  b.x += b.vx; b.y += b.vy;

  for (const ball of balls) {
    if (ball.x - ball.radius < 0)    { ball.x = ball.radius;        ball.vx =  Math.abs(ball.vx); }
    if (ball.x + ball.radius > size) { ball.x = size - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.radius < 0)    { ball.y = ball.radius;        ball.vy =  Math.abs(ball.vy); }
    if (ball.y + ball.radius > size) { ball.y = size - ball.radius; ball.vy = -Math.abs(ball.vy); }
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.radius + b.radius;

  if (dist < minDist && dist > 0.001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const relSpeed = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
    const hitX = (a.x + b.x) / 2;
    const hitY = (a.y + b.y) / 2;
    let didHit = false;

    if (relSpeed > 0) {
      a.vx -= relSpeed * nx;  a.vy -= relSpeed * ny;
      b.vx += relSpeed * nx;  b.vy += relSpeed * ny;
      const dmg = Math.max(1, Math.round(relSpeed * DMG_COEFF));
      a.hp = Math.max(0, a.hp - dmg);
      b.hp = Math.max(0, b.hp - dmg);
      didHit = true;
    }

    const overlap = (minDist - dist) * 0.5;
    a.x -= nx * overlap;  a.y -= ny * overlap;
    b.x += nx * overlap;  b.y += ny * overlap;

    if (a.hp <= 0 || b.hp <= 0) {
      const winner = a.hp > b.hp ? a.label : (b.hp > a.hp ? b.label : 'DRAW');
      return { winner, didHit, hitX, hitY };
    }
    return { winner: null, didHit, hitX, hitY };
  }

  return { winner: null, didHit: false, hitX: 0, hitY: 0 };
}

function drawInitials(ctx: CanvasRenderingContext2D, ball: Ball) {
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(ball.radius * 0.85)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ball.initials, ball.x, ball.y + 1);
}

// HP 바 JSX용 색상 헬퍼
function hpColor(ratio: number): string {
  return ratio > 0.5 ? '#16a34a' : ratio > 0.25 ? '#d97706' : '#dc2626';
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  size: number,
  imgCache: ImgCache,
) {
  // 배경
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // 진한 아레나 테두리
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);

  // 공
  for (const ball of state.balls) {
    ctx.beginPath();
    ctx.arc(ball.x + 3, ball.y + 4, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();

    if (ball.photo) {
      const img = getOrLoadImage(ball.photo, imgCache);
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius - 3, 0, Math.PI * 2);
        ctx.clip();
        const r = ball.radius - 3;
        ctx.drawImage(img, ball.x - r, ball.y - r, r * 2, r * 2);
        ctx.restore();
      } else {
        drawInitials(ctx, ball);
      }
    } else {
      drawInitials(ctx, ball);
    }

    ctx.beginPath();
    ctx.arc(ball.x - ball.radius * 0.28, ball.y - ball.radius * 0.3, ball.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
  }

  // 충돌 플래시
  if (state.flashT > 0) {
    const alpha = state.flashT / FLASH_FRAMES;
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(state.flashX, state.flashY, 24, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(state.flashX, state.flashY, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 승자 오버레이
  if (state.phase === 'finished' && state.winner) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.round(size * 0.06)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WINNER', cx, cy - size * 0.065);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.085)}px system-ui, sans-serif`;
    ctx.fillText(state.winner, cx, cy + size * 0.04);
  }
}

// HP 바 2개를 캔버스 외부에 렌더하는 서브컴포넌트
function HpBars({
  labelA, labelB, hpA, hpB, maxA, maxB,
}: {
  labelA: string; labelB: string;
  hpA: number; hpB: number;
  maxA: number; maxB: number;
}) {
  const rA = Math.max(0, hpA / maxA);
  const rB = Math.max(0, hpB / maxB);

  return (
    <div className="w-full bg-white/90 border border-[#e5e7eb] px-3 py-2 flex gap-3 items-stretch">
      {/* A — 왼쪽, 좌→우 채움 */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="font-label-caps text-[10px] font-bold truncate" style={{ color: SLOT_COLORS[0] }}>{labelA}</span>
          <span className="font-label-caps text-[9px] text-[#6b7280] ml-1 flex-shrink-0">{hpA}/{maxA}</span>
        </div>
        {/* 직사각형 체력바: border 박스, 내부 채움, 모서리 없음 */}
        <div className="h-4 border-2 overflow-hidden" style={{ borderColor: '#ef444466' }}>
          <div
            className="h-full transition-all duration-150"
            style={{ width: `${Math.round(rA * 100)}%`, background: hpColor(rA) }}
          />
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center text-[#9ca3af] text-[9px] font-bold">vs</div>

      {/* B — 오른쪽, 우→좌 채움 (flex-row-reverse로 오른쪽 앵커) */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="font-label-caps text-[9px] text-[#6b7280] mr-1 flex-shrink-0">{hpB}/{maxB}</span>
          <span className="font-label-caps text-[10px] font-bold truncate text-right" style={{ color: SLOT_COLORS[1] }}>{labelB}</span>
        </div>
        {/* flex-row-reverse: 채움이 오른쪽에서 시작해 왼쪽으로 줄어듦 */}
        <div className="h-4 border-2 overflow-hidden flex flex-row-reverse" style={{ borderColor: '#3b82f666' }}>
          <div
            className="h-full transition-all duration-150"
            style={{ width: `${Math.round(rB * 100)}%`, background: hpColor(rB) }}
          />
        </div>
      </div>
    </div>
  );
}

interface BattleArenaProps {
  playerA: BattlePlayer;
  playerB: BattlePlayer;
  autoStart?: boolean;
  onBattleEnd?: (winnerLabel: string) => void;
  frameMode?: boolean;
}

export default function BattleArena({
  playerA,
  playerB,
  autoStart = false,
  onBattleEnd,
  frameMode = false,
}: BattleArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgCacheRef = useRef<ImgCache>(new Map());
  const stateRef = useRef<BattleState>({
    balls: [], phase: 'idle', winner: null, rafId: 0,
    flashT: 0, flashX: 0, flashY: 0,
  });

  const [uiPhase, setUiPhase] = useState<Phase>('idle');
  const [canvasSized, setCanvasSized] = useState(false);
  const canvasSizedOnce = useRef(false);

  // HP 바 상태 — 충돌 시에만 업데이트 (매 프레임 setStatex 방지)
  const maxA = ovrToHp(playerA.ovr);
  const maxB = ovrToHp(playerB.ovr);
  const [liveHp, setLiveHp] = useState<{ a: number; b: number } | null>(null);

  const onBattleEndRef = useRef(onBattleEnd);
  useEffect(() => { onBattleEndRef.current = onBattleEnd; }, [onBattleEnd]);

  // ResizeObserver: 컨테이너 너비 → 캔버스 픽셀 크기
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const applySize = () => {
      const size = container.clientWidth;
      if (size < 1) return;
      canvas.width = size;
      canvas.height = size;

      if (!canvasSizedOnce.current) {
        canvasSizedOnce.current = true;
        setCanvasSized(true);
      }

      if (stateRef.current.phase === 'idle') {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
        if (!frameMode) {
          ctx.fillStyle = '#9ca3af';
          ctx.font = `${Math.round(size * 0.035)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('재생 버튼을 눌러 시작', size / 2, size / 2);
        }
      }
    };

    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    applySize();
    return () => observer.disconnect();
  }, [frameMode]);

  useEffect(() => {
    return () => cancelAnimationFrame(stateRef.current.rafId);
  }, []);

  const startBattle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    if (size < 1) return;

    cancelAnimationFrame(stateRef.current.rafId);

    const freshState: BattleState = {
      balls: makeBalls(size, playerA, playerB),
      phase: 'running',
      winner: null,
      rafId: 0,
      flashT: 0,
      flashX: 0,
      flashY: 0,
    };
    stateRef.current = freshState;
    setUiPhase('running');
    // 초기 HP 세팅
    setLiveHp({ a: maxA, b: maxB });

    const cache = imgCacheRef.current;

    const loop = () => {
      const s = stateRef.current;
      if (s.phase !== 'running') return;

      if (s.flashT > 0) s.flashT -= 1;

      const result = stepPhysics(s.balls, size);

      if (result.didHit) {
        s.flashT = FLASH_FRAMES;
        s.flashX = result.hitX;
        s.flashY = result.hitY;
        // 충돌 시에만 HP state 업데이트 (매 프레임 렌더 방지)
        setLiveHp({ a: s.balls[0].hp, b: s.balls[1].hp });
      }

      if (result.winner !== null) {
        s.phase = 'finished';
        s.winner = result.winner;
        drawFrame(ctx, s, size, cache);
        setUiPhase('finished');
        setLiveHp({ a: s.balls[0].hp, b: s.balls[1].hp });
        onBattleEndRef.current?.(result.winner);
        return;
      }

      drawFrame(ctx, s, size, cache);
      s.rafId = requestAnimationFrame(loop);
    };

    freshState.rafId = requestAnimationFrame(loop);
  }, [playerA, playerB, maxA, maxB]);

  const startBattleRef = useRef(startBattle);
  useEffect(() => { startBattleRef.current = startBattle; }, [startBattle]);

  useEffect(() => {
    if (!autoStart || !canvasSized) return;
    startBattleRef.current();
  }, [autoStart, canvasSized]);

  const labelA = formatLabel(playerA.nameEn, playerA.year);
  const labelB = formatLabel(playerB.nameEn, playerB.year);

  // HP 바 (아레나 박스 밖 아래 — 캔버스 외부 JSX)
  const hpBarsEl = liveHp ? (
    <HpBars
      labelA={labelA} labelB={labelB}
      hpA={liveHp.a} hpB={liveHp.b}
      maxA={maxA} maxB={maxB}
    />
  ) : null;

  if (frameMode) {
    return (
      <div className="w-full flex flex-col gap-2">
        <div ref={containerRef} className="w-full aspect-square overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
        {hpBarsEl}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-[520px]">
      <div
        ref={containerRef}
        className="w-full aspect-square rounded-xl overflow-hidden border-2 border-[#1f2937]"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {hpBarsEl}

      <button
        onClick={startBattle}
        className="px-10 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-lg transition-colors text-base tracking-wide"
      >
        {uiPhase === 'idle' ? '재생' : '다시 재생'}
      </button>
    </div>
  );
}
