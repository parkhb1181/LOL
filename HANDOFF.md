# HANDOFF.md — 세션 인수인계 (Claude Code가 갱신)

> 규칙: Phase 완료·세션 종료 시 Claude Code가 갱신. 새 세션은 이 파일의 "진행 중 / 다음 작업"부터 재개.
> 여기에는 **상태만** 기록한다 — 절차·DoD·수치·스키마는 SSOT 3종이 원문 (복제 금지).

## 현재 상태
- 날짜 / Phase: D2 (2026-06-12) / 파이프라인 대기 중, 프론트 GAME_SPEC 구현 완료
- 브랜치: main
- 빌드 상태: TypeScript noEmit 통과, dev 서버 정상 (localhost:3000)
- **복귀 후 재개 시작점**: 파이프라인 재실행 (아래 ① 참조)

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
- **GAME_SPEC §1-2-4-7 구현 완료** (커밋 16227be):
  - §1 자동 스핀: 데이터 로드 완료 즉시 start() 자동 호출
  - §2 fullReroll: 팀/연도 2개 리롤 → 전체 재스핀 단일 버튼 (rerollLeft=1)
  - §4 S=20: S=40 → S=20 (OVR 80 vs 92 = 20% 승률 기준점 충족)
  - §7 타임라인: RESULT 화면 스프링/MSI/서머/Worlds 4단계 타임라인 + 색상
- **더미 데이터** 생성 (5팀 LCK — SKT16, T123, GenG24, KT18, DRX22)
  - 파이프라인 완료 후 실데이터로 덮어쓸 예정

### Phase 0 검증 결과 요약
| 항목 | 결과 |
|---|---|
| LCK League 값 | 2013~2015: `"LoL The Champions"`, 2016+: `"LoL Champions Korea"` |
| LPL League 값 | `"Tencent LoL Pro League"` |
| LEC League 값 | `"LoL EMEA Championship"` |
| LCS (2025) League 값 | `"League of Legends Championship of The Americas North"` |
| TournamentResults | **채택** |

## 진행 중
- **파이프라인 미완료**: rosters.json/results.json 없음 (03 프로세스 종료됨)
  - 재실행 필요 (아래 ① 참조)

## 다음 작업

### ① 파이프라인 재실행 (통합 재실행)
```powershell
# 이전 캐시 삭제 후 순차 실행
Remove-Item pipeline-cache\tournaments.json -ErrorAction SilentlyContinue
Remove-Item pipeline-cache\rosters.json -ErrorAction SilentlyContinue
Remove-Item pipeline-cache\results.json -ErrorAction SilentlyContinue
Remove-Item pipeline-cache\worlds-results.json -ErrorAction SilentlyContinue
Remove-Item pipeline-cache\photo-whitelist.json -ErrorAction SilentlyContinue
# Worlds /Main Event 빈 캐시 삭제
2017,2018,2019,2020,2021,2022,2023,2024,2025 | ForEach-Object {
  Remove-Item "pipeline-cache\cargo\result_$($_)_Season_World_Championship_Main_Event.json" -ErrorAction SilentlyContinue
}
# 순차 실행
npx tsx scripts/01-tournaments.ts
npx tsx scripts/02-rosters.ts
npx tsx scripts/03-results.ts
npx tsx scripts/04-ratings.ts
npx tsx scripts/07-build.ts
npx tsx scripts/08-anchors.ts
```

### ② 파이프라인 완료 후
- worlds-results.json에 Worlds 2017~2025 실데이터 확인 (IG 2018, DWG 2020, Faker 2023)
- 08-anchors 앵커 6명 OVR 확인 → 호빈 승인
- 10-photo-whitelist.ts 실행 → 호빈 검수
- 더미 players.json / teams.json / spin-index.json → 실데이터로 교체

### ③ 프론트 잔여 작업 (GAME_SPEC 기반)
- DESIGN_GUIDE v1.0 승격 후 CSS 변수/토큰 적용 (현재 임시 하드코딩)
- PlayerCard: WORLDS 프레임 시머 애니메이션, crown 오버레이 (에셋 수령 후)
- lab/page.tsx: 카드 디자인 랩 구현
- 09-montecarlo.ts: 더미→실데이터 교체 후 밸런스 검증

## 호빈 게이트 대기
- **awards.csv 검수** — v0.3 완료, 잔여 `# ?` 항목 확인 필요
- **opponents-2026.json 실값 교체** (D3 — 현재 플레이스홀더)
- **DESIGN_GUIDE v1.0 승격** (D4 전) — CSS 토큰 확정 후 프론트 적용

## 미해결 이슈
- 앵커 가중치 미확정 (08 결과 후 PRD §6.2 기준 튜닝)
- LEC/LCS v1.1 (파이프라인 국내 결과 수집 후 추가)
- 네이밍/도메인 (PRD §13 Q1)

## 세션 로그 (최근 5개만 유지)
- 2026-06-12 (세션10): GAME_SPEC v1 구현 — 자동스핀(§1)·fullReroll(§2)·S=20(§4)·타임라인(§7). 더미 5팀 생성. TypeScript noEmit 통과, dev 서버 확인.
- 2026-06-11 (세션9): Worlds 2017~2025 TournamentResults 버그 수정(dcf50be). 통합 재실행 계획 수립. 03 LEC 레이트 리밋 대기 중 외출 전 HANDOFF 갱신.
- 2026-06-11 (세션8): LCK 2013~2015 League명 실값 확인. 01-tournaments.ts 픽스 커밋(b7be083). 03 LPL 처리 중.
- 2026-06-11 (세션7): awards.csv v0.3 확정, 01-tournaments.ts Worlds 2017+ 버그 수정, tournaments.json 재생성(302건), 03 재실행.
- 2026-06-10 (세션4): Phase 1 스크립트 전체 구현 완료 + sim.ts/grade.ts/09-montecarlo.ts (Phase 4) 커밋.
