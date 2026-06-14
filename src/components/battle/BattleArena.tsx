'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { BattlePlayer } from '@/lib/battle/utils';
import { ovrToHp, formatLabel } from '@/lib/battle/utils';
import { getSkillDef, getSkillForPlayer } from '@/lib/battle/skills';
import type { SkillType } from '@/lib/battle/skills';

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
  skill: SkillType;
}

interface Projectile {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  shooterIdx: 0 | 1;
  type: SkillType;
  launchX: number; launchY: number;
  angle: number;  // 표창 회전용
}

interface PendingExplosion {
  x: number; y: number;
  targetIdx: 0 | 1;
  damage: number;
  triggerFrame: number;
}

interface ActiveExplosion {
  x: number; y: number;
  startFrame: number;
  maxRadius: number;
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
  // 스킬 시스템
  frame: number;
  projectiles: Projectile[];
  pendingExplosions: PendingExplosion[];
  activeExplosions: ActiveExplosion[];
  skillLastFired: [number, number];
  nextProjId: number;
}

type StepResult = {
  winner: string | null;
  didHit: boolean;
  hitX: number;
  hitY: number;
};

// R2 pub-*.r2.dev는 CORS 미설정 → 동일 origin 프록시 경유
function toProxyUrl(photo: string): string {
  return `/battle/img?url=${encodeURIComponent(photo)}`;
}

// crossOrigin을 src 전에 설정(R2 CORS) — startBattle에서 Promise.all로 대기
function preloadImage(url: string, cache: ImgCache): Promise<void> {
  return new Promise<void>(resolve => {
    const entry = cache.get(url);
    if (entry instanceof HTMLImageElement) { resolve(); return; }
    if (entry === 'error') { resolve(); return; }
    if (entry === 'loading') {
      const t = setInterval(() => {
        const e = cache.get(url);
        if (e instanceof HTMLImageElement || e === 'error') { clearInterval(t); resolve(); }
      }, 50);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous'; // ★ src 전에 설정
    cache.set(url, 'loading');
    img.onload = () => { cache.set(url, img); resolve(); };
    img.onerror = () => {
      // eslint-disable-next-line no-console
      console.error('[BattleArena] 이미지 로드 실패 — R2 CORS 확인:', url);
      cache.set(url, 'error');
      resolve();
    };
    img.src = url;
  });
}

function getFromCache(url: string, cache: ImgCache): HTMLImageElement | null {
  const entry = cache.get(url);
  return entry instanceof HTMLImageElement ? entry : null;
}

function makeBalls(size: number, playerA: BattlePlayer, playerB: BattlePlayer): Ball[] {
  return [
    {
      x: size * 0.28, y: size * 0.44,
      vx: INIT_SPEED, vy: INIT_SPEED * 0.6,
      radius: BALL_RADIUS,
      hp: ovrToHp(playerA.ovr), maxHp: ovrToHp(playerA.ovr),
      color: SLOT_COLORS[0],
      photo: playerA.photo ? toProxyUrl(playerA.photo) : null,
      label: formatLabel(playerA.nameEn, playerA.year),
      initials: playerA.nameEn[0]?.toUpperCase() ?? 'A',
      skill: getSkillForPlayer(playerA.playerId, 0),
    },
    {
      x: size * 0.72, y: size * 0.44,
      vx: -INIT_SPEED, vy: -INIT_SPEED * 0.6,
      radius: BALL_RADIUS,
      hp: ovrToHp(playerB.ovr), maxHp: ovrToHp(playerB.ovr),
      color: SLOT_COLORS[1],
      photo: playerB.photo ? toProxyUrl(playerB.photo) : null,
      label: formatLabel(playerB.nameEn, playerB.year),
      initials: playerB.nameEn[0]?.toUpperCase() ?? 'B',
      skill: getSkillForPlayer(playerB.playerId, 1),
    },
  ];
}

function checkWinner(balls: Ball[]): string | null {
  const [a, b] = balls;
  if (a.hp <= 0 || b.hp <= 0) {
    return a.hp > b.hp ? a.label : (b.hp > a.hp ? b.label : 'DRAW');
  }
  return null;
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
      a.vx -= relSpeed * nx; a.vy -= relSpeed * ny;
      b.vx += relSpeed * nx; b.vy += relSpeed * ny;
      const dmg = Math.max(1, Math.round(relSpeed * DMG_COEFF));
      a.hp = Math.max(0, a.hp - dmg);
      b.hp = Math.max(0, b.hp - dmg);
      didHit = true;
    }

    const overlap = (minDist - dist) * 0.5;
    a.x -= nx * overlap; a.y -= ny * overlap;
    b.x += nx * overlap; b.y += ny * overlap;

    if (a.hp <= 0 || b.hp <= 0) {
      const winner = a.hp > b.hp ? a.label : (b.hp > a.hp ? b.label : 'DRAW');
      return { winner, didHit, hitX, hitY };
    }
    return { winner: null, didHit, hitX, hitY };
  }

  return { winner: null, didHit: false, hitX: 0, hitY: 0 };
}

// 스킬 스텝: 투사체 발사·이동·충돌, 지연 폭발 트리거
// HP 변화 발생 시 true 반환 → 호출자가 setLiveHp 수행
function stepSkills(state: BattleState, size: number): boolean {
  let hpChanged = false;
  const { balls, frame } = state;

  // 쿨타임 경과 시 투사체 발사
  for (let i = 0; i < 2; i++) {
    const shooter = balls[i];
    const def = getSkillDef(shooter.skill);
    if (frame - state.skillLastFired[i] >= def.cooldownFrames) {
      const target = balls[1 - i];
      const dx = target.x - shooter.x;
      const dy = target.y - shooter.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0.001) {
        state.projectiles.push({
          id: state.nextProjId++,
          x: shooter.x, y: shooter.y,
          vx: (dx / d) * def.projectileSpeed,
          vy: (dy / d) * def.projectileSpeed,
          radius: def.projectileRadius,
          shooterIdx: i as 0 | 1,
          type: shooter.skill,
          launchX: shooter.x, launchY: shooter.y,
          angle: 0,
        });
        state.skillLastFired[i] = frame;
      }
    }
  }

  // 투사체 이동 및 적중 판정
  const toRemove = new Set<number>();
  for (const proj of state.projectiles) {
    proj.x += proj.vx;
    proj.y += proj.vy;
    if (proj.type === 'shuriken') proj.angle += 0.3;

    if (proj.x < -80 || proj.x > size + 80 || proj.y < -80 || proj.y > size + 80) {
      toRemove.add(proj.id);
      continue;
    }

    const targetIdx = (1 - proj.shooterIdx) as 0 | 1;
    const target = balls[targetIdx];
    const dx = target.x - proj.x;
    const dy = target.y - proj.y;
    if (Math.sqrt(dx * dx + dy * dy) < target.radius + proj.radius) {
      toRemove.add(proj.id);
      const def = getSkillDef(proj.type);

      if (proj.type === 'shuriken') {
        // 즉시 데미지 + 지연 폭발 예약
        target.hp = Math.max(0, target.hp - def.immediateDamage);
        hpChanged = true;
        state.pendingExplosions.push({
          x: proj.x, y: proj.y,
          targetIdx,
          damage: def.explosionDamage,
          triggerFrame: frame + def.explosionDelayFrames,
        });
        state.flashT = FLASH_FRAMES;
        state.flashX = target.x;
        state.flashY = target.y;
      } else {
        // 창: 발사-적중 거리 비례 데미지 (니달리 Q 감성)
        const travelDist = Math.sqrt(
          (proj.x - proj.launchX) ** 2 + (proj.y - proj.launchY) ** 2,
        );
        const mult = 1.0 + Math.min(1.0, travelDist / def.maxScaleDistance) * (def.maxDistMultiplier - 1.0);
        const dmg = Math.round(def.immediateDamage * mult);
        target.hp = Math.max(0, target.hp - dmg);
        hpChanged = true;
        // 장거리 크리티컬: 더 밝고 긴 플래시
        state.flashT = travelDist > def.maxScaleDistance * 0.65 ? FLASH_FRAMES + 6 : FLASH_FRAMES;
        state.flashX = target.x;
        state.flashY = target.y;
      }
    }
  }
  state.projectiles = state.projectiles.filter(p => !toRemove.has(p.id));

  // 지연 폭발 트리거
  const nextPending: PendingExplosion[] = [];
  for (const exp of state.pendingExplosions) {
    if (frame >= exp.triggerFrame) {
      const target = balls[exp.targetIdx];
      target.hp = Math.max(0, target.hp - exp.damage);
      hpChanged = true;
      state.activeExplosions.push({
        x: target.x, y: target.y,
        startFrame: frame,
        maxRadius: 30,
      });
    } else {
      nextPending.push(exp);
    }
  }
  state.pendingExplosions = nextPending;

  // 완료된 폭발 이펙트 제거 (30프레임 ≈ 0.5s)
  state.activeExplosions = state.activeExplosions.filter(ex => frame - ex.startFrame < 30);

  return hpChanged;
}

function drawInitials(ctx: CanvasRenderingContext2D, ball: Ball) {
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(ball.radius * 0.85)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ball.initials, ball.x, ball.y + 1);
}

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

  // 아레나 테두리
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
      const img = getFromCache(ball.photo, imgCache);
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

  // 폭발 이펙트 (공 위에)
  for (const exp of state.activeExplosions) {
    const t = (state.frame - exp.startFrame) / 30;
    const r = exp.maxRadius * Math.min(1, t * 2.5);
    const alpha = Math.max(0, 1 - t);
    ctx.save();
    ctx.globalAlpha = alpha * 0.75;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 투사체 (최상위)
  for (const proj of state.projectiles) {
    ctx.save();
    ctx.translate(proj.x, proj.y);

    if (proj.type === 'shuriken') {
      ctx.rotate(proj.angle);
      const r = proj.radius;
      // 4날 표창: 삼각 날개 4개
      ctx.fillStyle = '#374151';
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.45, -r * 0.28);
        ctx.lineTo(r, 0);
        ctx.lineTo(r * 0.45, r * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 창: 자루 + 창날
      ctx.rotate(Math.atan2(proj.vy, proj.vx));
      const w = proj.radius * 0.85;
      const shaftLen = proj.radius * 3.5;
      const headLen = proj.radius * 2;
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-shaftLen, -w / 2, shaftLen, w);
      ctx.fillStyle = '#d1d5db';
      ctx.beginPath();
      ctx.moveTo(headLen, 0);
      ctx.lineTo(0, -w * 1.4);
      ctx.lineTo(0, w * 1.4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // 충돌/스킬 플래시
  if (state.flashT > 0) {
    const alpha = Math.min(1, state.flashT / FLASH_FRAMES);
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

// HP 바 — 캔버스 외부, 테두리 검정
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
      {/* A — 좌→우 채움 */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="font-label-caps text-[10px] font-bold truncate" style={{ color: SLOT_COLORS[0] }}>{labelA}</span>
          <span className="font-label-caps text-[9px] text-[#6b7280] ml-1 flex-shrink-0">{hpA}/{maxA}</span>
        </div>
        {/* 검정 테두리, 초록 채움 */}
        <div className="h-4 border-2 border-[#111827] overflow-hidden">
          <div className="h-full transition-all duration-150"
            style={{ width: `${Math.round(rA * 100)}%`, background: hpColor(rA) }} />
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center text-[#9ca3af] text-[9px] font-bold">vs</div>

      {/* B — 우→좌 채움 (flex-row-reverse 앵커) */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <span className="font-label-caps text-[9px] text-[#6b7280] mr-1 flex-shrink-0">{hpB}/{maxB}</span>
          <span className="font-label-caps text-[10px] font-bold truncate text-right" style={{ color: SLOT_COLORS[1] }}>{labelB}</span>
        </div>
        {/* flex-row-reverse: 채움이 오른쪽에서 줄어듦 */}
        <div className="h-4 border-2 border-[#111827] overflow-hidden flex flex-row-reverse">
          <div className="h-full transition-all duration-150"
            style={{ width: `${Math.round(rB * 100)}%`, background: hpColor(rB) }} />
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
    frame: 0,
    projectiles: [],
    pendingExplosions: [],
    activeExplosions: [],
    skillLastFired: [0, 0],
    nextProjId: 0,
  });

  const [uiPhase, setUiPhase] = useState<Phase>('idle');
  const [canvasSized, setCanvasSized] = useState(false);
  const canvasSizedOnce = useRef(false);

  const maxA = ovrToHp(playerA.ovr);
  const maxB = ovrToHp(playerB.ovr);
  const [liveHp, setLiveHp] = useState<{ a: number; b: number } | null>(null);

  const onBattleEndRef = useRef(onBattleEnd);
  // useEffect: onBattleEnd prop 변경 시 ref 갱신 (RAF 클로저 내부에서 최신값 참조)
  useEffect(() => { onBattleEndRef.current = onBattleEnd; }, [onBattleEnd]);

  // ResizeObserver: 컨테이너 너비 → 캔버스 픽셀 크기 동기화
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

  const startBattle = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    if (size < 1) return;

    cancelAnimationFrame(stateRef.current.rafId);

    // 공 사진 프리로드 — 1프레임부터 사진 표시 보장
    const cache = imgCacheRef.current;
    const photos = [playerA.photo, playerB.photo]
      .filter(Boolean)
      .map(url => toProxyUrl(url as string));
    await Promise.all(photos.map(url => preloadImage(url, cache)));
    if (!canvasRef.current) return; // await 후 언마운트 방어

    const freshState: BattleState = {
      balls: makeBalls(size, playerA, playerB),
      phase: 'running',
      winner: null,
      rafId: 0,
      flashT: 0, flashX: 0, flashY: 0,
      frame: 0,
      projectiles: [],
      pendingExplosions: [],
      activeExplosions: [],
      skillLastFired: [0, 0],
      nextProjId: 0,
    };
    stateRef.current = freshState;
    setUiPhase('running');
    setLiveHp({ a: maxA, b: maxB });

    const loop = () => {
      const s = stateRef.current;
      if (s.phase !== 'running') return;

      s.frame += 1;
      if (s.flashT > 0) s.flashT -= 1;

      // 공 충돌 물리
      const physResult = stepPhysics(s.balls, size);
      if (physResult.didHit) {
        s.flashT = FLASH_FRAMES;
        s.flashX = physResult.hitX;
        s.flashY = physResult.hitY;
        setLiveHp({ a: s.balls[0].hp, b: s.balls[1].hp });
      }
      if (physResult.winner !== null) {
        s.phase = 'finished';
        s.winner = physResult.winner;
        drawFrame(ctx, s, size, cache);
        setUiPhase('finished');
        setLiveHp({ a: s.balls[0].hp, b: s.balls[1].hp });
        onBattleEndRef.current?.(physResult.winner);
        return;
      }

      // 스킬 스텝 (투사체·폭발)
      const skillChanged = stepSkills(s, size);
      if (skillChanged) {
        setLiveHp({ a: s.balls[0].hp, b: s.balls[1].hp });
        const w = checkWinner(s.balls);
        if (w !== null) {
          s.phase = 'finished';
          s.winner = w;
          drawFrame(ctx, s, size, cache);
          setUiPhase('finished');
          setLiveHp({ a: s.balls[0].hp, b: s.balls[1].hp });
          onBattleEndRef.current?.(w);
          return;
        }
      }

      drawFrame(ctx, s, size, cache);
      s.rafId = requestAnimationFrame(loop);
    };

    freshState.rafId = requestAnimationFrame(loop);
  }, [playerA, playerB, maxA, maxB]);

  const startBattleRef = useRef(startBattle);
  useEffect(() => { startBattleRef.current = startBattle; }, [startBattle]);

  // autoStart: 캔버스 크기 확정 후 자동 시작 (frameMode=true 시 사용)
  useEffect(() => {
    if (!autoStart || !canvasSized) return;
    startBattleRef.current();
  }, [autoStart, canvasSized]);

  const labelA = formatLabel(playerA.nameEn, playerA.year);
  const labelB = formatLabel(playerB.nameEn, playerB.year);

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
        onClick={() => { void startBattle(); }}
        className="px-10 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-lg transition-colors text-base tracking-wide"
      >
        {uiPhase === 'idle' ? '재생' : '다시 재생'}
      </button>
    </div>
  );
}
