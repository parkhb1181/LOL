# HANDOFF.md — 세션 인수인계 (Claude Code가 갱신)

> 규칙: Phase 완료·세션 종료 시 Claude Code가 갱신. 새 세션은 이 파일의 "진행 중 / 다음 작업"부터 재개.
> 여기에는 **상태만** 기록한다 — 절차·DoD·수치·스키마는 SSOT 3종이 원문 (복제 금지).

## 현재 상태
- 날짜 / Phase: D1-D2 (2026-06-11 21:40) / 03-results.ts 백그라운드 실행 중
- 03 진행도: LCK 21건·LPL 27건 캐시 완료, **LEC 14건 진행 중**(마지막 LEC 2019 서머), LCS·MSI 미시작
- 빌드 상태: scaffold 완료, TypeScript noEmit 통과 (빌드 미실행)
- 브랜치: main
- **복귀 후 재개 시작점**: `Test-Path pipeline-cache\results.json` → True이면 아래 "다음 작업 ①" 실행

## 완료
- 스캐폴드: Next.js 15 + TypeScript + Tailwind, src/ 구조
- `public/data/opponents-2026.json` 플레이스홀더 (regular 9팀 / intl 12팀)
- `src/lib/prng.ts` mulberry32 구현
- Phase 0 전체 (A~G + S1~S4 + WHERE 테스트) 완료
- `pipeline-cache/discovery.md` 갱신 완료 (gitignored)
- Phase 1 스크립트 전체 구현 완료 (01~04, 07~10, lib/cargo.ts)
- sim.ts / grade.ts / useDraftMachine / PlayerCard / draft page / i18n 구현 완료
- **awards.csv v0.3** 확정 (WORLDS_MVP 11건·SEASON_MVP·FINALS_MVP·ALLPRO 교정 완료)
- **01-tournaments.ts 버그 수정** (Worlds 2017+ `/Main Event` 필터 버그 — `includes('/')` → `endsWith('/Main Event')` 허용)
- `pipeline-cache/tournaments.json` 재생성: LCK 52 / LPL 64 / LEC 77 / LCS 71 / WORLDS 21 / MSI 17 = 302건
- **LCK 2013~2015 League명 수정** (커밋 b7be083): `getDomesticLeagueValues` 수정 완료
  - 2013/2014: `"LoL The Champions"`, Season 항목 isPlayoffs=true 처리
  - 2015: `"LoL The Champions"`, 실제 Playoffs 항목(IsPlayoffs=1) 존재 — Leaguepedia 값 사용

### Phase 0 검증 결과 요약
| 항목 | 결과 |
|---|---|
| LCK League 값 | `"LoL Champions Korea"` (2016+만) |
| LPL League 값 | `"Tencent LoL Pro League"` |
| EU LCS League 값 | `"Europe League Championship Series"` |
| LEC League 값 | `"LoL EMEA Championship"` |
| LCS (2020) League 값 | `"League of Legends Championship Series"` |
| LTA North (2025) League 값 | `"League of Legends Championship of The Americas North"` |
| Worlds 2016 OverviewPage | `"2016 Season World Championship"` |
| Worlds 2017+ OverviewPage | `"YYYY Season World Championship/Main Event"` |
| MSI 2016 OverviewPage | `"2016 Mid-Season Invitational"` |
| LCK 2016 Summer Playoffs OverviewPage | `"LCK/2016 Season/Summer Playoffs"` |
| TournamentResults | **채택** |

## 진행 중
- **03-results.ts** 백그라운드 실행 중 (PIDs 52936/56836/45960)
  - LEC 레이트 리밋 백오프 중 (마지막 캐시 21:28, 프로세스 생존 확인됨)
  - 완료 후 results.json 저장 — **즉시 04 실행 금지, cleanup 먼저**
- **10-photo-whitelist.ts** 병행 실행됐으나 결과 무효 (2013~2016 Worlds만 기준) — 03 재실행 후 재실행 필요

## 다음 작업 (통합 재실행 — ①+③ 묶음)

### 복귀 후 첫 번째: 03 완료 확인
```powershell
Test-Path pipeline-cache\results.json   # True면 아래 실행
```

### 03 완료 확인 후: 통합 cleanup + 전체 재실행
```powershell
# ── 1. results/worlds 삭제 ──
Remove-Item pipeline-cache\results.json
Remove-Item pipeline-cache\worlds-results.json
Remove-Item pipeline-cache\photo-whitelist.json -ErrorAction SilentlyContinue

# ── 2. Worlds /Main Event 빈 캐시 9개 삭제 ──
2017,2018,2019,2020,2021,2022,2023,2024,2025 | ForEach-Object {
  Remove-Item "pipeline-cache\cargo\result_$($_)_Season_World_Championship_Main_Event.json" -ErrorAction SilentlyContinue
}

# ── 3. 2025 cargo 캐시 삭제 (스테일 데이터) ──
Remove-Item pipeline-cache\cargo\t_LCK_2025_LoL_Champions_Korea.json -ErrorAction SilentlyContinue
Remove-Item pipeline-cache\cargo\t_LCS_2025_League_of_Legends_Championship_of_The_Americas_North.json -ErrorAction SilentlyContinue
Remove-Item pipeline-cache\cargo\t_LPL_2025_Tencent_LoL_Pro_League.json -ErrorAction SilentlyContinue
Remove-Item pipeline-cache\cargo\t_LEC_2025_LoL_EMEA_Championship.json -ErrorAction SilentlyContinue
Remove-Item pipeline-cache\cargo\t_WORLDS_2025.json -ErrorAction SilentlyContinue
Remove-Item pipeline-cache\cargo\t_MSI_2025.json -ErrorAction SilentlyContinue

# ── 4. tournaments/rosters 삭제 (LCK 2013~2015 신규 수집) ──
Remove-Item pipeline-cache\tournaments.json
Remove-Item pipeline-cache\rosters.json

# ── 5. 순차 재실행 ──
npx tsx scripts/01-tournaments.ts
npx tsx scripts/02-rosters.ts
npx tsx scripts/03-results.ts
npx tsx scripts/04-ratings.ts
npx tsx scripts/07-build.ts
npx tsx scripts/08-anchors.ts
```

### 검증 (08 완료 후)
- worlds-results.json에 Worlds 2017~2025 연도별 실데이터 확인 (IG 2018, DWG 2020, Faker 2023 포함)
- 08-anchors 앵커 6명 OVR 범위 확인
- 2025 LCK 최상위 OVR 99 과밀 여부 확인 (Road to MSI 이중가점)

### 이후 작업
- 10-photo-whitelist.ts 재실행 (03 완료 직후 자동 또는 수동)
- 08 결과 보고 → 호빈 승인 → Phase 2 (이미지) 착수

## 호빈 게이트 대기
- **awards.csv 검수** — v0.3 완료, 호빈 최종 확인 필요 (Appendix 잔여 `# ?` 항목: 2020 서머 ADC 1st, 일부 SEASON_MVP 2023년)
- **photo-whitelist.json 검수** (10 실행 후) — 승인 후 사진 다운로드
- **opponents-2026.json 실값 교체** (D3 — 현재 플레이스홀더)

## 미해결 이슈
- **cargo-failures.json**: rate-limit 최대 재시도 실패 대회 목록 (07 완료 후 결손 확인 필요)
- 앵커 가중치 미확정 (08 결과 후 PRD §6.2 기준 튜닝)
- 네이밍/도메인 (PRD §13 Q1)

## 세션 로그 (최근 5개만 유지)
- 2026-06-11 (세션9): Worlds 2017~2025 TournamentResults 버그 수정(dcf50be). 통합 재실행 계획 수립(①+③ 묶음). 03 LEC 레이트 리밋 대기 중 — 외출 전 HANDOFF 갱신.
- 2026-06-11 (세션8): LCK 2013~2015 League명 실값 확인(2013~2015="LoL The Champions", 2015 Playoffs 항목 별도 존재). 01-tournaments.ts 픽스 커밋(b7be083). worlds-results.json 98건 저장 완료. 03 LPL 처리 중.
- 2026-06-11 (세션7): awards.csv v0.3 확정, 01-tournaments.ts Worlds 2017+ 버그 수정, tournaments.json 재생성(302건), 03 재실행. 레이트 리밋으로 지연 중, 04→07→08 자동 대기 스크립트 기동.
- 2026-06-11 (세션6): awards.csv v0.2(split 컬럼 추가·WORLDS/FINALS MVP 1차 교정) + v0.3(2차 교정) 커밋. worlds-results.json 임시 생성. Worlds 2017+ 수집 버그 발견.
- 2026-06-11 (세션5): 10-photo-whitelist.ts 2025 제외 수정, 11-photo-download.ts 신규 (승인 게이트 포함). 01-tournaments.ts 재실행
- 2026-06-10 (세션4): Phase 1 스크립트 전체 구현 완료 + sim.ts/grade.ts/09-montecarlo.ts (Phase 4) 커밋. useDraftMachine/PlayerCard/draft page/i18n 구현 완료
- 2026-06-10 (세션3): long→main 개명, CURSOR_GUIDE_1.md 삭제, §5 항목1 SortDate 규칙 교체, WHERE 테스트 결과 반영, Phase 1 착수
