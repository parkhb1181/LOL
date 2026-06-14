// 배틀 전용 선수 필드 (players.json 부분 타입 — 읽기 전용)
export interface BattlePlayer {
  id: string;
  playerId: string;
  nameEn: string;
  year: number;
  ovr: number;
  photo: string | null;
  role: string;
  team: string;
  league: string;
}

// OVR(60~99) → HP 증폭 변환
// 기준점: OVR 80 → 200 HP  (K = 200 / 25 = 8)
// 근거: DMG_COEFF=6, INIT_SPEED=3.2 기준 평균 충돌 데미지 ~20 → OVR 80끼리 ~10회 충돌로 종료
export function ovrToHp(ovr: number): number {
  return Math.max(50, Math.round((ovr - 55) * 8));
}

// "{년도 2자리} {NAME 대문자}" — 예: "16 FAKER", "24 CHOVY"
export function formatLabel(nameEn: string, year: number): string {
  return `${String(year).slice(-2)} ${nameEn.toUpperCase()}`;
}

// OVR 내림차순 → nameEn 오름차순 (드롭다운 기본 정렬)
export function sortedByOvr(players: BattlePlayer[]): BattlePlayer[] {
  return [...players].sort(
    (a, b) => b.ovr - a.ovr || a.nameEn.localeCompare(b.nameEn),
  );
}

// 중복 없는 랜덤 2인 추출
export function randomPair(players: BattlePlayer[]): [BattlePlayer, BattlePlayer] {
  const n = players.length;
  const idxA = Math.floor(Math.random() * n);
  let idxB = Math.floor(Math.random() * n);
  while (idxB === idxA) idxB = Math.floor(Math.random() * n);
  return [players[idxA], players[idxB]];
}
