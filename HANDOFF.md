# HANDOFF.md — 세션 인수인계 (Claude Code가 갱신)

> 규칙: Phase 완료·세션 종료 시 Claude Code가 갱신. 새 세션은 이 파일의 "진행 중 / 다음 작업"부터 재개.
> 여기에는 **상태만** 기록한다 — 절차·DoD·수치·스키마는 SSOT 3종이 원문 (복제 금지).

## 현재 상태
- 날짜 / Phase: D3 (2026-06-14) / 프론트 언어 토글 전 화면 완료
- 브랜치: ovr-stats-rework (최신 커밋: 80f780b — 한/영 언어 토글 전 화면 적용)
- 빌드 상태: Next.js build ✓ / TypeScript ✓ / 11페이지 정적 생성 ✓
- **복귀 후 재개 시작점**: 아래 "호빈 게이트 대기" 항목 결정 → 다음 Phase(프론트 잔여 or main 머지)

## 완료 (최신)
- **세션18 — OVERRIDE 보정 완료 (83a5e93)**: 커밋 d8c6a0b ~ 83a5e93
  - awards.csv: Faker 2025 WORLDS_MVP 추가 (2014~2024 → 2014~2025)
  - worldsMvp/crown 플래그 자동 수정: Faker 2025 worldsMvp=true ✓
  - 준우승 에이스 4명 과소 보정: Rekkles 2018→95 / TheShy 2023→91 / SofM 2020→90 / Smeb 2015→91
  - Oner 2023 역전 해소: 95→97 (2022=97와 동급, T1 2023: Faker/Zeus/Oner=97·Keria=96·Gumayusi=95)
  - OVR 99=4명 ✓ / 2025 데이터 완전 확인 (100% 매칭, LEC 0명은 데이터 문제 아닌 실제 약함)
  - Faker 2025 OVERRIDE=95 유지 (자동값 92, 국내 준우승 탓)
  - awards.csv 2024/2025 추가 누락 목록: **보류 → v1.2 처리** (마감 위험)
- **세션17 — 연도별 리그 계수 + OVERRIDE 조정 (d6c9dfa)**: 커밋 571e75a~d6c9dfa
  - 04-ratings.ts: LEAGUE_COEFF_TABLE(year×league) 적용 — 국내 플옵 가산에만, 국제전 제외
    LCK 1.00기준 / LPL 0.80~0.98 / LEC 0.82~0.90 / LCS 0.75~0.78 (2013~2025 전 연도)
  - 2016~2018 지표 로드: v11.json(849건, LP-only) → v11-final.json(857건, OE+LP) 수정
  - bonusCap ±7로 전 연도 통일 (±8 버그 해소)
  - OVR_OVERRIDE 조정: Wolf 2015=94, Berserker 22=86·23=88, Faker 2025=95, Bin 2024=96, CoreJJ 2019=93
  - T1 2024 보정: Faker=95, Zeus=91, Gumayusi=90
  - players.json 1709건 재빌드 / OVR 99=4명 ✓
  - 08-anchors.ts: 2/5 통과 (Faker2013=99·Canyon2020=99·Chovy2024=98 OVERRIDE 기지 초과분)
- **v1.1 OVR 전 연도 통합 완료 (c8eb399)**: 2013~2025 전 연도 다지표 cap 통일
  - 04d-oe-stats.ts: 2024~2025 Leaguepedia 수집 611건 → oe-stats-2024-2025.json
  - players.json 1709건 재빌드 / OVR 99=4명(Faker 2013/2016·MaRin 2015·Canyon 2020) ✓
  - **신규**: Bin (Chen Ze-Bin) 2024 LPL TOP=98 (OVERRIDE 없이 stats-driven)
- **Phase 2 실행 완료 (9f6fa15)**: R2 871건 업로드 / photo URL 갱신
- **Phase 1 재빌드 완료 (15bbea9)**: LEC/LCS 국내 플옵, awards.csv 28건 수정

## 완료 (이전)
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

## v1.1 OVR 지표 반영 작업 현황 (브랜치: ovr-stats-rework) — **전체 완료**

### 전 연도 완료 요약
| 연도 | 스크립트 | 데이터 소스 | 지표 | cap | 상태 |
|------|---------|-----------|------|-----|------|
| 2013~2015 | 04e-early-stats.ts | LP stats_agg | KDA+GS+KP 동적 | ±8 | ✅ |
| 2016~2018 | 04e-ovr-final.ts | LP stats_agg | KDA+GS+KP | ±8 | ✅ |
| 2019~2021 | 04b-oe-stats.ts | OE CSV | KDA+GD15+CS15+DPM | ±8 | ✅ |
| 2022~2023 | 04c-oe-stats.ts | LP ScoreboardPlayers | KDA+GS+CS+Dmg | ±8 | ✅ |
| 2024~2025 | 04d-oe-stats.ts | LP ScoreboardPlayers | KDA+GS+CS+Dmg | ±8 | ✅ |

### 호빈 검토 완료 (세션18)
1. ~~Rekkles 2018 하향~~ → **반대: 89→95 과소 보정 완료** ✅
2. ~~Oner 2022 역전~~ → **Oner 2023 97로 상향 완료** ✅
3. **Wolf 2015 = 94**: OVERRIDE 94 적용됨 — 수용 확인
4. **Yike 2023 = 94**: OVERRIDE 94 적용됨 — 수용 확인
5. **Apple|2014|LCS +7** (kda_z=4.38 극단값) — 아직 미결

## 다음 작업

### ① awards.csv 2024/2025 누락 수상 (v1.2 예정)
- 2025 LCK SEASON_MVP·FINALS_MVP·ALLPRO 전체 미수집
- 2025 LPL·LEC·LCS 수상 전체 미수집
- 2024 LCK FINALS_MVP 스프링 미수집 (서머 Zeka만 있음)
- 2024 LEC ALLPRO_1ST 서머 미수집
- **v1.1 배포 후 v1.2에서 처리** (지금 추가 금지 — OVR 재검증 필요)

### ② opponents-2026.json 실값 교체 (D3 게이트)
현재 플레이스홀더 유지 — 호빈이 실명·레이팅 확정 후 교체

### ③ 프론트 잔여 작업
- DESIGN_GUIDE v1.0 승격 후 CSS 변수/토큰 적용
- PlayerCard: WORLDS 프레임 시머 애니메이션, crown 오버레이 (에셋 수령 후)
- lab/page.tsx: 카드 디자인 랩 구현
- **[배포 전 필수] /lab 접근 차단**: 내부 개발 페이지 — 일반 유저 노출 금지
  방법 후보: ① middleware.ts 로그인 게이트 ② `robots.txt Disallow: /lab` + noindex 메타 ③ 라우트 삭제(대신 로컬 URL 직접 접근)
  지금은 `noindex` 최소 처리 후 배포, 이후 삭제 검토
- 09-montecarlo.ts: 실데이터 교체 후 밸런스 검증

## 호빈 게이트 대기
- **opponents-2026.json 실값 교체** (D3 — 현재 플레이스홀더)
- **DESIGN_GUIDE v1.0 승격** (D4 전) — CSS 토큰 확정 후 프론트 적용
- **Apple|2014|LCS** kda_z=4.38 극단값 → 제외 여부 (미결)

## 미해결 이슈
- 앵커 가중치 미확정 (08 결과 후 PRD §6.2 기준 튜닝)
- awards.csv 2024/2025 추가 누락 수상 — v1.2 처리 예정
- 네이밍/도메인 (PRD §13 Q1)

## 세션 로그 (최근 5개만 유지)
- 2026-06-14 (세션20): 한/영 언어 토글 전 화면 완료 (80f780b). draft/page.tsx 전체 번역 (RevealScreen/ResultScreen/PickButtons/DraftPage). 빌드 ✓.
- 2026-06-14 (세션19): KO/EN 언어 토글 완료 (b140cb7). i18n LangProvider+en/ko 구조 통일. SiteHeader KO|EN 버튼. draft 결과 라벨 번역. 빌드 ✓.
- 2026-06-13 (세션18): OVERRIDE 보정 (83a5e93). Faker 2025 WORLDS_MVP 추가. 준우승 에이스 4명 과소 보정. Oner 2023 97로 역전 해소. OVR 99=4명 ✓.
- 2026-06-13 (세션17): 연도별 리그 계수+v11-final 경로 수정+OVERRIDE 정리 (d6c9dfa). 08-anchors 2/5. bonusCap ±7 통일. T1 2024 보정.
- 2026-06-13 (세션16): v1.1 최종 검증·정리 (0c9d0ec). XP+CS 블렌드·cap±7·T1 역전 해소 확인. OVR 99=4명 ✓, T1 Faker/Zeus 97 > JDG 96 ✓. progress_log 최종 상태 반영.
- 2026-06-13 (세션15): v1.1 OVR 전 연도 통합 완료 (c8eb399). 2024~2025 LP 수집 611건. 전 연도 cap ±7 통일. players.json 1709건 / OVR 99=4명 ✓. 신규 Bin 2024=98 (stats-driven).
