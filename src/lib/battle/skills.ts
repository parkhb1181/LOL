// Ball Battle — 스킬 정의 (데이터/쿨/데미지 분리)
// B1. 페이커(제드): 표창 + 지연 폭발
// B2. 캐년(니달리): 창 + 거리 비례 데미지

export type SkillType = 'shuriken' | 'spear';

export interface SkillDef {
  type: SkillType;
  cooldownFrames: number;    // ~60fps 기준 쿨타임
  projectileSpeed: number;   // px/frame
  projectileRadius: number;
  immediateDamage: number;
  // 표창(shuriken) 전용
  explosionDamage: number;
  explosionDelayFrames: number;
  explosionRadius: number;
  // 창(spear) 전용
  maxDistMultiplier: number;
  maxScaleDistance: number;  // 이 거리에서 maxDistMultiplier 적용
}

// 페이커 — 제드 표창: 저빈도·고폭발
export const SHURIKEN_DEF: SkillDef = {
  type: 'shuriken',
  cooldownFrames: 270,       // ~4.5s
  projectileSpeed: 5.5,
  projectileRadius: 7,
  immediateDamage: 20,
  explosionDamage: 30,
  explosionDelayFrames: 45,  // ~0.75s
  explosionRadius: 30,
  maxDistMultiplier: 1,
  maxScaleDistance: 1,
};

// 캐년 — 니달리 창: 고빈도·거리비례
export const SPEAR_DEF: SkillDef = {
  type: 'spear',
  cooldownFrames: 130,       // ~2.2s
  projectileSpeed: 7,
  projectileRadius: 5,
  immediateDamage: 15,
  maxDistMultiplier: 2.0,
  maxScaleDistance: 200,
  explosionDamage: 0,
  explosionDelayFrames: 0,
  explosionRadius: 0,
};

export function getSkillDef(type: SkillType): SkillDef {
  return type === 'shuriken' ? SHURIKEN_DEF : SPEAR_DEF;
}

// playerId 기반 스킬 배정 / 기타는 볼 인덱스로 배정 (A=표창, B=창)
export function getSkillForPlayer(playerId: string, ballIdx: 0 | 1): SkillType {
  const id = playerId.toLowerCase();
  if (id === 'faker') return 'shuriken';
  if (id === 'canyon') return 'spear';
  return ballIdx === 0 ? 'shuriken' : 'spear';
}
