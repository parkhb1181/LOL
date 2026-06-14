'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

// 하드코딩 테스트 선수 (2단계에서 실 데이터 연동 예정)
const PLAYERS = [
  { name: 'Faker', color: '#ef4444', initials: 'F', maxHp: 200 },
  { name: 'Ruler', color: '#3b82f6', initials: 'R', maxHp: 200 },
];

const BALL_RADIUS = 44;
const INIT_SPEED = 3.2;
// 충돌 데미지 = 충돌 상대속도 × 이 계수
const DMG_COEFF = 6;

interface Ball {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  hp: number; maxHp: number;
  name: string; color: string; initials: string;
}

type Phase = 'idle' | 'running' | 'finished';

interface BattleState {
  balls: Ball[];
  phase: Phase;
  winner: string | null;
  rafId: number;
}

function makeBalls(size: number): Ball[] {
  return [
    {
      x: size * 0.28, y: size * 0.5,
      vx: INIT_SPEED, vy: INIT_SPEED * 0.55,
      radius: BALL_RADIUS,
      hp: PLAYERS[0].maxHp, maxHp: PLAYERS[0].maxHp,
      name: PLAYERS[0].name, color: PLAYERS[0].color, initials: PLAYERS[0].initials,
    },
    {
      x: size * 0.72, y: size * 0.5,
      vx: -INIT_SPEED, vy: -INIT_SPEED * 0.55,
      radius: BALL_RADIUS,
      hp: PLAYERS[1].maxHp, maxHp: PLAYERS[1].maxHp,
      name: PLAYERS[1].name, color: PLAYERS[1].color, initials: PLAYERS[1].initials,
    },
  ];
}

// 물리 한 프레임: 반환값이 null이 아니면 게임 종료 (승자 이름)
function stepPhysics(balls: Ball[], size: number): string | null {
  const [a, b] = balls;

  a.x += a.vx; a.y += a.vy;
  b.x += b.vx; b.y += b.vy;

  // 벽 반사 — 속도 부호를 강제해 벽 안쪽 방향으로만 튕김
  for (const ball of balls) {
    if (ball.x - ball.radius < 0)    { ball.x = ball.radius;        ball.vx =  Math.abs(ball.vx); }
    if (ball.x + ball.radius > size) { ball.x = size - ball.radius; ball.vx = -Math.abs(ball.vx); }
    if (ball.y - ball.radius < 0)    { ball.y = ball.radius;        ball.vy =  Math.abs(ball.vy); }
    if (ball.y + ball.radius > size) { ball.y = size - ball.radius; ball.vy = -Math.abs(ball.vy); }
  }

  // 공-공 충돌 감지
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = a.radius + b.radius;

  if (dist < minDist && dist > 0.001) {
    const nx = dx / dist;
    const ny = dy / dist;

    // 충돌 방향 상대 속도 (양수 = 서로 접근 중)
    const relSpeed = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;

    if (relSpeed > 0) {
      // 등질량 탄성 충돌 — 충돌 방향 속도 교환
      a.vx -= relSpeed * nx;  a.vy -= relSpeed * ny;
      b.vx += relSpeed * nx;  b.vy += relSpeed * ny;

      // HP 감소
      const dmg = Math.max(1, Math.round(relSpeed * DMG_COEFF));
      a.hp = Math.max(0, a.hp - dmg);
      b.hp = Math.max(0, b.hp - dmg);
    }

    // 위치 분리 (겹침 제거)
    const overlap = (minDist - dist) * 0.5;
    a.x -= nx * overlap;  a.y -= ny * overlap;
    b.x += nx * overlap;  b.y += ny * overlap;

    // 승자 판정
    if (a.hp <= 0 || b.hp <= 0) {
      if (a.hp > b.hp) return a.name;
      if (b.hp > a.hp) return b.name;
      return 'DRAW';
    }
  }

  return null;
}

function drawFrame(ctx: CanvasRenderingContext2D, state: BattleState, size: number) {
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
    // 그림자 — 흰 배경에서 과하지 않게
    ctx.beginPath();
    ctx.arc(ball.x + 4, ball.y + 6, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fill();

    // 공 본체
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();

    // 하이라이트 (입체감)
    ctx.beginPath();
    ctx.arc(
      ball.x - ball.radius * 0.28,
      ball.y - ball.radius * 0.28,
      ball.radius * 0.32,
      0, Math.PI * 2,
    );
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fill();

    // 이니셜 — 공 위에 흰 텍스트 (공 색이 진해 충분한 대비)
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(ball.radius * 0.9)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ball.initials, ball.x, ball.y + 1);

    // HP 바
    const barW = ball.radius * 3;
    const barH = 9;
    const barX = ball.x - barW / 2;
    const barY = ball.y - ball.radius - 26;
    const hpRatio = Math.max(0, ball.hp / ball.maxHp);
    const hpColor = hpRatio > 0.5 ? '#16a34a' : hpRatio > 0.25 ? '#d97706' : '#dc2626';

    // 바 배경 — 연한 회색 (흰 배경 대비)
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(barX, barY, barW, barH);

    // 바 채움
    if (hpRatio > 0) {
      ctx.fillStyle = hpColor;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
    }

    // 이름 + HP 수치 — 어두운 색으로 흰 배경 대비 확보
    ctx.fillStyle = '#1f2937';
    ctx.font = `bold 12px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${ball.name}  ${ball.hp} / ${ball.maxHp}`, ball.x, barY - 3);
  }

  // 승자 오버레이 — 어두운 딤 위에 텍스트 (흰 배경과 무관하게 가독성 유지)
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
    ctx.font = `bold ${Math.round(size * 0.1)}px system-ui, sans-serif`;
    ctx.fillText(state.winner, cx, cy + size * 0.045);
  }
}

export default function BattleArena() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

      // idle 상태면 안내 문구 렌더
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

  // 언마운트 시 RAF 취소
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

    // 기존 루프 중단
    cancelAnimationFrame(stateRef.current.rafId);

    const freshState: BattleState = {
      balls: makeBalls(size),
      phase: 'running',
      winner: null,
      rafId: 0,
    };
    stateRef.current = freshState;
    setUiPhase('running');

    // 게임 루프 — stateRef를 통해 최신 state를 읽음
    const loop = () => {
      const s = stateRef.current;
      if (s.phase !== 'running') return;

      const winner = stepPhysics(s.balls, size);
      if (winner !== null) {
        s.phase = 'finished';
        s.winner = winner;
        drawFrame(ctx, s, size);
        setUiPhase('finished');
        return;
      }

      drawFrame(ctx, s, size);
      s.rafId = requestAnimationFrame(loop);
    };

    freshState.rafId = requestAnimationFrame(loop);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-[520px]">
      {/* 아레나 */}
      <div
        ref={containerRef}
        className="w-full aspect-square rounded-xl overflow-hidden border border-[#d1d5db]"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* 선수 표기 */}
      <div className="flex items-center gap-8 text-sm">
        {PLAYERS.map((p, i) => (
          <div key={p.name} className="flex items-center gap-2">
            {i === 1 && <span className="text-[#4a4a7a] font-bold text-xs mr-2">VS</span>}
            <span
              className="w-3.5 h-3.5 rounded-full flex-shrink-0"
              style={{ background: p.color }}
            />
            <span className="text-white font-semibold">{p.name}</span>
          </div>
        ))}
      </div>

      {/* 재생 버튼 */}
      <button
        onClick={startBattle}
        className="px-10 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-lg transition-colors text-base tracking-wide"
      >
        {uiPhase === 'idle' ? '재생' : '다시 재생'}
      </button>
    </div>
  );
}
