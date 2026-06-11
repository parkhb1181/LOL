# HANDOFF.md — 세션 인수인계 (Claude Code가 갱신)

> 규칙: Phase 완료·세션 종료 시 Claude Code가 갱신. 새 세션은 이 파일의 "진행 중 / 다음 작업"부터 재개.
> 여기에는 **상태만** 기록한다 — 절차·DoD·수치·스키마는 SSOT 3종이 원문 (복제 금지).

## 현재 상태
- 날짜 / Phase: D2 (2026-06-12) / 파이프라인 02~08 완료, 실데이터 players.json 생성
- 브랜치: main
- 빌드 상태: 파이프라인 통과 (18896bd). Next.js build는 마지막 확인 67ffd0a 이후 미재실행 (API 변경 없으므로 통과 예상)
- **복귀 후 재개 시작점**: Canyon/Chovy 앵커 조정 방향 결정 (아래 호빈 게이트 참조) → opponents-2026.json 실값 교체

## 완료
- 스캐폴드: Next.js 15 + TypeScript + Tailwind, src/ 구조
- `public/data/opponents-2026.json` 플레이스홀더 (regular 9팀 / intl 12팀)
- `src/lib/prng.ts` mulberry32 구현
- Phase 0 전체 (A~G + S1~S4 + WHERE 테스트) 완료
- Phase 1 스크립트 전체 구현 완료 (01~04, 07~10, lib/cargo.ts)
- sim.ts / grade.ts / useDraftMachine / PlayerCard / draft page / i18n 구현 완료
- **awards.csv v0.3** 확정 (WORLDS_MVP 11건·SEASON_MVP·FINALS_MVP·ALLPRO 교정 완료)
- **01-tournaments.ts 버그 수정** (Worlds 2017+ OverviewPage + LCK 2013~2015 League명)
- **cargo.ts 무한 재시도** (429/5xx/네트워크 오류 → 60s 고정 무한 대기)
- **03-results.ts** Worlds /Main Event 버그 수정 (trOverviewPage), LEC/LCS 국내 스킵
- **07-build.ts** LEC/LCS PlayerSeason v1 제외
- **GAME_SPEC §1-2-4-7 구현 완료** (커밋 16227be)
- **더미 데이터** 생성 (5팀 LCK — SKT16, T123, GenG24, KT18, DRX22)
- **6가지 개선 완료** (이전 세션 전달 목록):
  1. 카드 등급 색 제거 — 전 선수 동일 디자인
  2. 다전제 변경 — 정규시즌 Bo3 (CURSOR_GUIDE §7.1 수정 필요: Bo1→Bo3)
  3. html2canvas 폐기 결정 (이미지 공유 = OG만)
  4. 경기 가독성 — 섹션별 그룹 (스프링/MSI/서머/Worlds)
  5. RevealScreen 1단계씩 표시
  6. 홈 페이지 디자인 완성 (GRAND SLAM 타이포)
- **OG 이미지 강화 완료** (67ffd0a):
  - `/api/og/route.tsx`: 1200×630 ImageResponse — 등급/트로피/OVR/5인 스트립
  - `/r/page.tsx`: generateMetadata + 서버 렌더 결과 페이지 (URLSearchParams 직렬화)

### Phase 0 검증 결과 요약
| 항목 | 결과 |
|---|---|
| LCK League 값 | 2013~2015: `"LoL The Champions"`, 2016+: `"LoL Champions Korea"` |
| LPL League 값 | `"Tencent LoL Pro League"` |
| LEC League 값 | `"LoL EMEA Championship"` |
| LCS (2025) League 값 | `"League of Legends Championship of The Americas North"` |
| TournamentResults | **채택** |

## 진행 중
없음.

## 다음 작업

### ① Canyon/Chovy 앵커 조정 (호빈 결정 후)
선택지 3가지 → 호빈 결정 필요:
1. awards.csv EDITORIAL 마이너스 추가 (Canyon -3, Chovy -5 전후) → 목표 96 이하 진입
2. PRD §6.2 앵커 목표값 상향 (96~99로 수용) → "최고 선수는 99 가능" 설계
3. WORLDS_MVP/SEASON_MVP 가점 자체 하향 → 전체 분포 재조정

### ② opponents-2026.json 실값 교체 (D3 게이트)
현재 플레이스홀더 유지 — 호빈이 실명·레이팅 확정 후 교체

### ③ 프론트 잔여 작업
- DESIGN_GUIDE v1.0 승격 후 CSS 변수/토큰 적용
- PlayerCard: WORLDS 프레임 시머 애니메이션, crown 오버레이 (에셋 수령 후)
- lab/page.tsx: 카드 디자인 랩 구현
- 09-montecarlo.ts: 실데이터 교체 후 밸런스 검증

### ③ 프론트 잔여 작업 (GAME_SPEC 기반)
- DESIGN_GUIDE v1.0 승격 후 CSS 변수/토큰 적용 (현재 임시 하드코딩)
- PlayerCard: WORLDS 프레임 시머 애니메이션, crown 오버레이 (에셋 수령 후)
- lab/page.tsx: 카드 디자인 랩 구현
- 09-montecarlo.ts: 더미→실데이터 교체 후 밸런스 검증

## 호빈 게이트 대기
- **Canyon/Chovy 앵커 조정 방향 결정** — 현재 Canyon 97(목표 96), Chovy 99(목표 96). 위 3가지 선택지 중 결정 필요
- **opponents-2026.json 실값 교체** (D3 — 현재 플레이스홀더)
- **DESIGN_GUIDE v1.0 승격** (D4 전) — CSS 토큰 확정 후 프론트 적용

## 미해결 이슈
- 앵커 가중치 미확정 (08 결과 후 PRD §6.2 기준 튜닝)
- LEC/LCS v1.1 (파이프라인 국내 결과 수집 후 추가)
- 네이밍/도메인 (PRD §13 Q1)

## 세션 로그 (최근 5개만 유지)
- 2026-06-12 (세션12): 5가지 묶음 적용 완료 (18896bd). OVR 압축 78~99, 99→2명, 카드 풀 2999→1714명, Faker 닉네임/Faker2013 OVR 94 복구. Canyon 97/Chovy 99 구조적 한계 보고.
- 2026-06-12 (세션11): OG 이미지 강화 (/api/og) + /r generateMetadata 완료 (67ffd0a). 6가지 UI 개선 완료. build 통과.
- 2026-06-12 (세션10): GAME_SPEC v1 구현 — 자동스핀·fullReroll·S=20·타임라인. 더미 5팀 생성.
- 2026-06-11 (세션9): Worlds 2017~2025 TournamentResults 버그 수정(dcf50be). 통합 재실행 계획 수립.
- 2026-06-11 (세션8): LCK 2013~2015 League명 실값 확인. 01-tournaments.ts 픽스(b7be083).
- 2026-06-11 (세션7): awards.csv v0.3 확정, 01-tournaments.ts Worlds 2017+ 버그 수정.
