# HANDOFF.md — 세션 인수인계 (Claude Code가 갱신)

> 규칙: Phase 완료·세션 종료 시 Claude Code가 갱신. 새 세션은 이 파일의 "진행 중 / 다음 작업"부터 재개.
> 여기에는 **상태만** 기록한다 — 절차·DoD·수치·스키마는 SSOT 3종이 원문 (복제 금지).

## 현재 상태
- 날짜 / Phase: D1-D2 (2026-06-11) / 03-results.ts 백그라운드 실행 중 (Leaguepedia 레이트 리밋)
- 빌드 상태: scaffold 완료, TypeScript noEmit 통과 (빌드 미실행)
- 브랜치: main

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
- **03-results.ts** 백그라운드 실행 중 (신 03 — PIDs 52936/56836/45960, 8:06 PM 기동)
  - WORLDS 2021 레이트 리밋 백오프 (60s) 대기 중 (`pipeline-cache/03-log.txt`)
  - 캐시 현황: WORLDS 8건(2013~2020) / MSI 14건 / LCK 21건 / LPL 27건 / LEC 2건(Season3~2014) / LCS 0건
  - 완료 후 worlds-results.json → results.json 순서로 자동 저장
- **04→07→08 자동 실행 대기 스크립트** 동작 중 (`pipeline-cache/ratings-build-log.txt`)
  - results.json 감지(30s 폴링) → 04-ratings → 07-build → 08-anchors 자동 실행

## 다음 작업
1. 03 완료 → 04→07→08 자동 실행 (대기 스크립트가 처리)
2. **08-anchors 결과 확인** (앵커 5개 기준):
   - Faker 2016, Canyon 2020, Chovy 2024, Ruler 2017: 데이터 있음
   - Faker 2013: **데이터 없음** (LCK 2013-2015 갭 문제 → 아래 미해결 이슈)
3. 10-photo-whitelist.ts 실행 (03 완료 후, worlds-results.json 의존)
4. LCK 2013-2015 갭 해결 후 01→02→03 재실행 (호빈 게이트)

## 호빈 게이트 대기
- **awards.csv 검수** — v0.3 완료, 호빈 최종 확인 필요 (Appendix 잔여 `# ?` 항목: 2020 서머 ADC 1st, 일부 SEASON_MVP 2023년)
- **LCK 2013-2015 데이터 갭 결정**:
  - `getDomesticLeagueValues("LCK", 2013)` = `"LoL Champions Korea"` → Leaguepedia에 데이터 없음 (리그명 불일치)
  - 실제 리그명 확인 필요 (`"Champions Korea"` 또는 `"OGN Champions"` 추정 — 레이트 리밋 해소 후 쿼리)
  - 확인 후: 01-tournaments.ts `getDomesticLeagueValues` 수정 → 02-rosters 재실행 → 03 재실행 (2013-2015 LCK 추가)
  - **이번 사이클에 포함할지 다음 사이클로 분리할지 호빈 결정 필요**
- **photo-whitelist.json 검수** (10 실행 후) — 승인 후 사진 다운로드
- **opponents-2026.json 실값 교체** (D3 — 현재 플레이스홀더)

## 미해결 이슈
- **LCK 2013-2015 리그명 미확인** — `"LoL Champions Korea"` 쿼리 결과 0행, 실 리그명 미확인. Faker 2013~2015 포함 전체 초기 LCK 선수 누락. 레이트 리밋 해소 후 쿼리로 확인 가능.
- **cargo-failures.json**: rate-limit 최대 재시도 실패 대회 목록 (07 완료 후 결손 확인 필요)
- 앵커 가중치 미확정 (08 결과 후 PRD §6.2 기준 튜닝)
- 네이밍/도메인 (PRD §13 Q1)

## 세션 로그 (최근 5개만 유지)
- 2026-06-11 (세션7): awards.csv v0.3 확정, 01-tournaments.ts Worlds 2017+ 버그 수정, tournaments.json 재생성(302건), 03 재실행. 레이트 리밋으로 지연 중, 04→07→08 자동 대기 스크립트 기동.
- 2026-06-11 (세션6): awards.csv v0.2(split 컬럼 추가·WORLDS/FINALS MVP 1차 교정) + v0.3(2차 교정) 커밋. worlds-results.json 임시 생성. Worlds 2017+ 수집 버그 발견.
- 2026-06-11 (세션5): 10-photo-whitelist.ts 2025 제외 수정, 11-photo-download.ts 신규 (승인 게이트 포함). 01-tournaments.ts 재실행
- 2026-06-10 (세션4): Phase 1 스크립트 전체 구현 완료 + sim.ts/grade.ts/09-montecarlo.ts (Phase 4) 커밋. useDraftMachine/PlayerCard/draft page/i18n 구현 완료
- 2026-06-10 (세션3): long→main 개명, CURSOR_GUIDE_1.md 삭제, §5 항목1 SortDate 규칙 교체, WHERE 테스트 결과 반영, Phase 1 착수
