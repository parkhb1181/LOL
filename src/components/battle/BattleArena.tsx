'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { BattlePlayer } from '@/lib/battle/utils';
import { ovrToHp, formatLabel } from '@/lib/battle/utils';

const BALL_RADIUS = 44;
const INIT_SPEED = 3.2;
const DMG_COEFF = 6;
const SLOT_COLORS = ['#ef4444', '#3b82f6'] as const; // A=빨강, B=파랑

// 이미지 캐시: URL → 로드 결과
type ImgEntry = HTMLImageElement | 'loading' | 'error';
type ImgCache = Map<string, ImgEntry>;

interface Ball {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  hp: number; maxHp: number;
  color: string;
  photo: string | null;
  label: string;    // "16 FAKER" — HP바 위 표시
  initials: string; // 사진 미로드/없음 시 폴백 이니셜
}

type Phase = 'idle' | 'running' | 'finished';

interface BattleState {
  balls: Ball[];
  phase: Phase;
  winner: string | null;
  rafId: number;
}

// 이미지 로드 시작 후 캐시 반환 — 비동기이므로 로드 전에는 null
function getOrLoadImage(url: string, cache: ImgCache): HTMLImageElement | null {
  const entry = cache.get(url);
  if (entry instanceof HTMLImageElement) return entry;
  if (entry === 'loading' || entry === 'error') return null;
  const img = new Image();
  img.crossOrigin = 'anonymous'; // R2 CORS 허용
  cache.set(url, 'loading');
  img.onload = () => cache.set(url, img);
  img.onerror = () => cache.set(url, 'error');
  img.src = url;
  return null;
}

function makeBalls(size: number, playerA: BattlePlayer, playerB: BattlePlayer): Ball[] {
  return [
    {
      x: size * 0.28, y: size * 0.5,
      vx: INIT_SPEED, vy: INIT_SPEED * 0.55,
      radius: BALL_RADIUS,
      hp: ovrToHp(playerA.ovr), maxHp: ovrToHp(playerA.ovr),
      color: SLOT_COLORS[0],
      photo: playerA.photo,
      label: formatLabel(playerA.nameEn, playerA.year),
      initials: playerA.nameEn[0]?.toUpperCase() ?? 'A',
    },
    {
      x: size * 0.72, y: size * 0.5,
      vx: -INIT_SPEED, vy: -INIT_SPEED * 0.55,
      radius: BALL_RADIUS,
      hp: ovrToHp(playerB.ovr), maxHp: ovrToHp(playerB.ovr),
      color: SLOT_COLORS[1],
      photo: playerB.photo,
      label: formatLabel(playerB.nameEn, playerB.year),
      initials: playerB.nameEn[0]?.toUpperCase() ?? 'B',
    },
  ];
}

// 물리 한 프레임 — null이 아니면 승자 label 반환
function stepPhysics(balls: Ball[], size: number): string | null {
  const [a, b] = balls;

  a.x += a.vx; a.y += a.vy;
  b.x += b.vx; b.y += b.vy;

  // 벽 반사 — 속도 부호 강제 (코너 끼임 방지)
  for (const ball of balls) {
    if (ball.x - ball.radius < 0)    { ball.x = ball.radius;        ball.vx =  Math.abs(ball.vx); }
    if (ball.x + ball.radius > size) { ball.x = size - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.radius < 0)    { ball.y = ball.radius;        ball.vy =  Math.abs(ball.vy); }
    if (ball.y + ball.radius > size) { ball.y = size - ball.radius; ball.vy = -Math.abs(ball.vy); }
  }

  // 공-공 충돌
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.radius + b.radius;

  if (dist < minDist && dist > 0.001) {
    const nx = dx / dist;
    const ny = dy / dist;
    const relSpeed = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;

    if (relSpeed > 0) {
      // 등질량 탄성 충돌 — 충돌 방향 속도 교환
      a.vx -= relSpeed * nx;  a.vy -= relSpeed * ny;
      b.vx += relSpeed * nx;  b.vy += relSpeed * ny;
      // HP 감소: 충돌 상대속도 × DMG_COEFF
      const dmg = Math.max(1, Math.round(relSpeed * DMG_COEFF));
      a.hp = Math.max(0, a.hp - dmg);
      b.hp = Math.max(0, b.hp - dmg);
    }

    // 위치 분리 (겹침 제거)
    const overlap = (minDist - dist) * 0.5;
    a.x -= nx * overlap;  a.y -= ny * overlap;
    b.x += nx * overlap;  b.y += ny * overlap;

    if (a.hp <= 0 || b.hp <= 0) {
      if (a.hp > b.hp) return a.label;
      if (b.hp > a.hp) return b.label;
      return 'DRAW';
    }
  }

  return null;
}

function drawInitials(ctx: CanvasRenderingContext2D, ball: Ball) {
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(ball.radius * 0.9)}px system-ui, sans-serif`;
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
  // 흰 배경
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // 아레나 테두리
  ctx.strokeStyle = '#9ca3af';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  // 중앙선 (장식)
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const ball of state.balls) {
    // 그림자
    ctx.beginPath();
    ctx.arc(ball.x + 4, ball.y + 6, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();

    // 슬롯 색 원형 배경 (사진 없으면 전면, 있으면 3px 테두리로 노출)
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();

    if (ball.photo) {
      const img = getOrLoadImage(ball.photo, imgCache);
      if (img) {
        // 사진: radius-3 원형 클립 → 3px 색 링이 테두리로 남음
        ctx.save();
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius - 3, 0, Math.PI * 2);
        ctx.clip();
        const r = ball.radius - 3;
        ctx.drawImage(img, ball.x - r, ball.y - r, r * 2, r * 2);
        ctx.restore();
      } else {
        // 이미지 로드 중/실패 → 이니셜 폴백
        drawInitials(ctx, ball);
      }
    } else {
      drawInitials(ctx, ball);
    }

    // 하이라이트 — 사진 위에도 그려 입체감 유지
    ctx.beginPath();
    ctx.arc(
      ball.x - ball.radius * 0.28,
      ball.y - ball.radius * 0.28,
      ball.radius * 0.32,
      0, Math.PI * 2,
    );
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();

    // HP 바
    const barW = ball.radius * 3;
    const barH = 9;
    const barX = ball.x - barW / 2;
    const barY = ball.y - ball.radius - 26;
    const hpRatio = Math.max(0, ball.hp / ball.maxHp);
    const hpColor = hpRatio > 0.5 ? '#16a34a' : hpRatio > 0.25 ? '#d97706' : '#dc2626';

    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(barX, barY, barW, barH);
    if (hpRatio > 0) {
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }

    // 이름(label) + HP 수치
    ctx.fillStyle = '#1f2937';
    ctx.font = `bold 12px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${ball.label}  ${ball.hp} / ${ball.maxHp}`, ball.x, barY - 3);
  }

  // 승자 오버레이
  if (state.phase === 'finished' && state.winner) {
    ctx.fillStyle = 'rgba(0,0,0,0.68)';
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;

    ctx.fillStyle = '#fbbf24';
    ctx.font = `bold ${Math.round(size * 0.06)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WINNER', cx, cy - size * 0.065);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(size * 0.09)}px system-ui, sans-serif`;
    ctx.fillText(state.winner, cx, cy + size * 0.045);
  }
}

interface BattleArenaProps {
  playerA: BattlePlayer;
  playerB: BattlePlayer;
}

export default function BattleArena({ playerA, playerB }: BattleArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgCacheRef = useRef<ImgCache>(new Map());
  const stateRef = useRef<BattleState>({
    balls: [],
    phase: 'idle',
    winner: null,
    rafId: 0,
  });

  // UI용 phase — 버튼 라벨 갱신에만 사용
  const [uiPhase, setUiPhase] = useState<Phase>('idle');

  // 컨테이너 크기에 맞춰 캔버스 해상도 설정
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const applySize = () => {
      const size = container.clientWidth;
      if (size < 1) return;
      canvas.width = size;
      canvas.height = size;

      if (stateRef.current.phase === 'idle') {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, size - 2, size - 2);
        ctx.fillStyle = '#6b7280';
        ctx.font = `${Math.round(size * 0.035)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('재생 버튼을 눌러 시작', size / 2, size / 2);
      }
    };

    const observer = new ResizeObserver(applySize);
    observer.observe(container);
    applySize();
    return () => observer.disconnect();
  }, []);

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
    };
    stateRef.current = freshState;
    setUiPhase('running');

    const cache = imgCacheRef.current;

    const loop = () => {
      const s = stateRef.current;
      if (s.phase !== 'running') return;

      const winner = stepPhysics(s.balls, size);
      if (winner !== null) {
        s.phase = 'finished';
        s.winner = winner;
        drawFrame(ctx, s, size, cache);
        setUiPhase('finished');
        return;
      }

      drawFrame(ctx, s, size, cache);
      s.rafId = requestAnimationFrame(loop);
    };

    freshState.rafId = requestAnimationFrame(loop);
  }, [playerA, playerB]);

  const aLabel = formatLabel(playerA.nameEn, playerA.year);
  const bLabel = formatLabel(playerB.nameEn, playerB.year);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[520px]">
      {/* 아레나 */}
      <div
        ref={containerRef}
        className="w-full aspect-square rounded-xl overflow-hidden border border-[#d1d5db]"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* 선수 정보 (OVR → HP 표시) */}
      <div className="flex items-center gap-6 text-sm flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: SLOT_COLORS[0] }} />
          <span className="text-white font-semibold">{aLabel}</span>
          <span className="text-[#6b7280] text-xs">OVR {playerA.ovr} → {ovrToHp(playerA.ovr)} HP</span>
        </div>
        <span className="text-[#4a4a7a] font-bold text-xs">VS</span>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: SLOT_COLORS[1] }} />
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
