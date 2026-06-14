'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { BattlePlayer } from '@/lib/battle/utils';
import { ovrToHp, formatLabel } from '@/lib/battle/utils';

const BALL_RADIUS = 28; // A3: 44 → 28 (0.636x), 사진 식별 가능 최소선
const INIT_SPEED = 3.2;
const DMG_COEFF = 6;
const FLASH_FRAMES = 10; // A4: 충돌 플래시 지속 프레임
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
  hitCount: number; // A5: 누적 충돌 횟수
  flashT: number;   // A4: 잔여 프레임 (0=없음)
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

function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  size: number,
  imgCache: ImgCache,
) {
  // 배경
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // A6: 진한 아레나 테두리
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, size - 3, size - 3);

  // 중앙 점선 구분선
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── 공 그리기 ──
  for (const ball of state.balls) {
    // 그림자
    ctx.beginPath();
    ctx.arc(ball.x + 3, ball.y + 4, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fill();

    // 공 베이스 (팀 색)
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();

    // A1: 사진 원형 클립 (photo=null이면 이니셜 폴백)
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

    // 반사광 하이라이트
    ctx.beginPath();
    ctx.arc(ball.x - ball.radius * 0.28, ball.y - ball.radius * 0.3, ball.radius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
  }

  // A4: 충돌 플래시 — 공 위에 렌더
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

  // A5: 충돌 카운터 — 상단 중앙, 공 영역 위
  {
    const fs = Math.round(size * 0.038);
    const text = `x ${state.hitCount}`;
    ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.fillRect(size / 2 - 38, 7, 76, fs + 8);
    ctx.fillStyle = '#1f2937';
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(text, size / 2, 11);
  }

  // A2: HP 바 — 아레나 하단 고정 (공 위에 렌더하므로 항상 가독)
  {
    const bp = Math.round(size * 0.04);        // 좌우 여백
    const bw = Math.round(size * 0.41);        // 바 너비
    const bh = 10;                             // 바 높이
    const by = size - bp - bh;                // 바 상단 Y
    const lfs = Math.max(9, Math.round(size * 0.029));
    const ly = by - 3;                        // 레이블 바닥 Y

    const [ba, bb] = state.balls;
    const ar = Math.max(0, ba.hp / ba.maxHp);
    const br = Math.max(0, bb.hp / bb.maxHp);
    const ac = ar > 0.5 ? '#16a34a' : ar > 0.25 ? '#d97706' : '#dc2626';
    const bc = br > 0.5 ? '#16a34a' : br > 0.25 ? '#d97706' : '#dc2626';

    // 반투명 배경 패널 (흰 배경이어도 공과 겹칠 때 가독성 보장)
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.fillRect(bp - 2, ly - lfs - 2, bw + 4, lfs + bh + 8);
    ctx.fillRect(size - bp - bw - 2, ly - lfs - 2, bw + 4, lfs + bh + 8);

    // 왼쪽 바 (A, 빨강)
    ctx.font = `bold ${lfs}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#1f2937';
    ctx.fillText(ba.label, bp, ly);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6b7280';
    ctx.font = `${Math.max(8, lfs - 1)}px system-ui, sans-serif`;
    ctx.fillText(`${ba.hp}/${ba.maxHp}`, bp + bw, ly);

    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(bp, by, bw, bh);
    if (ar > 0) {
      ctx.fillStyle = ac;
      ctx.fillRect(bp, by, bw * ar, bh);
    }

    // 오른쪽 바 (B, 파랑 — 우→좌 미러 채움)
    ctx.font = `bold ${lfs}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#1f2937';
    ctx.fillText(bb.label, size - bp, ly);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b7280';
    ctx.font = `${Math.max(8, lfs - 1)}px system-ui, sans-serif`;
    ctx.fillText(`${bb.hp}/${bb.maxHp}`, size - bp - bw, ly);

    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(size - bp - bw, by, bw, bh);
    if (br > 0) {
      ctx.fillStyle = bc;
      ctx.fillRect(size - bp - bw + bw * (1 - br), by, bw * br, bh);
    }
  }

  // 승자 오버레이 (finished)
  if (state.phase === 'finished' && state.winner) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size * 0.40;
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
    hitCount: 0, flashT: 0, flashX: 0, flashY: 0,
  });

  const [uiPhase, setUiPhase] = useState<Phase>('idle');
  const [canvasSized, setCanvasSized] = useState(false);
  const canvasSizedOnce = useRef(false);
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
      hitCount: 0,
      flashT: 0,
      flashX: 0,
      flashY: 0,
    };
    stateRef.current = freshState;
    setUiPhase('running');

    const cache = imgCacheRef.current;

    const loop = () => {
      const s = stateRef.current;
      if (s.phase !== 'running') return;

      // A4: 플래시 카운트다운
      if (s.flashT > 0) s.flashT -= 1;

      const result = stepPhysics(s.balls, size);

      if (result.didHit) {
        s.hitCount += 1;
        s.flashT = FLASH_FRAMES;
        s.flashX = result.hitX;
        s.flashY = result.hitY;
      }

      if (result.winner !== null) {
        s.phase = 'finished';
        s.winner = result.winner;
        drawFrame(ctx, s, size, cache);
        setUiPhase('finished');
        onBattleEndRef.current?.(result.winner);
        return;
      }

      drawFrame(ctx, s, size, cache);
      s.rafId = requestAnimationFrame(loop);
    };

    freshState.rafId = requestAnimationFrame(loop);
  }, [playerA, playerB]);

  const startBattleRef = useRef(startBattle);
  useEffect(() => { startBattleRef.current = startBattle; }, [startBattle]);

  // autoStart: canvasSized 확정 직후 1회 실행
  useEffect(() => {
    if (!autoStart || !canvasSized) return;
    startBattleRef.current();
  }, [autoStart, canvasSized]);

  if (frameMode) {
    return (
      <div
        ref={containerRef}
        className="w-full aspect-square overflow-hidden"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    );
  }

  const aLabel = formatLabel(playerA.nameEn, playerA.year);
  const bLabel = formatLabel(playerB.nameEn, playerB.year);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[520px]">
      <div
        ref={containerRef}
        className="w-full aspect-square rounded-xl overflow-hidden border-2 border-[#1f2937]"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      <div className="flex items-center gap-6 text-sm flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: SLOT_COLORS[0] }} />
          <span className="text-white font-semibold">{aLabel}</span>
          <span className="text-[#6b7280] text-xs">OVR {playerA.ovr} → {ovrToHp(playerA.ovr)} HP</span>
        </div>
        <span className="text-[#4a4a7a] font-bold text-xs">VS</span>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: SLOT_COLORS[1] }} />
          <span className="text-white font-semibold">{bLabel}</span>
          <span className="text-[#6b7280] text-xs">OVR {playerB.ovr} → {ovrToHp(playerB.ovr)} HP</span>
        </div>
      </div>

      <button
        onClick={startBattle}
        className="px-10 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-lg transition-colors text-base tracking-wide"
      >
        {uiPhase === 'idle' ? '재생' : '다시 재생'}
      </button>
    </div>
  );
}
