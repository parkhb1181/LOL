# HANDOFF.md — 세션 인수인계 (Claude Code가 갱신)

> 규칙: Phase 완료·세션 종료 시 Claude Code가 갱신. 새 세션은 이 파일의 "진행 중 / 다음 작업"부터 재개.
> 여기에는 **상태만** 기록한다 — 절차·DoD·수치·스키마는 SSOT 3종이 원문 (복제 금지).

## 현재 상태
- 날짜 / Phase: D3 (2026-06-13) / v1.1 OVR 통합 **전체 완료** (2013~2025)
- 브랜치: ovr-stats-rework (최신 커밋: c8eb399)
- 빌드 상태: Next.js build ✓ / players.json 1709건 / OVR 99=4명 ✓
- **복귀 후 재개 시작점**: 아래 "호빈 게이트 대기" 항목 결정 → 다음 Phase(프론트 잔여 or main 머지)

## 완료 (최신)
- **v1.1 OVR 전 연도 통합 완료 (c8eb399)**: 2013~2025 전 연도 다지표 cap ±8 통일
  - 04d-oe-stats.ts: 2024~2025 Leaguepedia 수집 611건 → oe-stats-2024-2025.json
  - 04-ratings.ts: 2024~2025 섹션 추가 + bonusCap 단일화(8)
  - players.json 1709건 재빌드 / OVR 99=4명(Faker 2013/2016·MaRin 2015·Canyon 2020) ✓
  - OVR 98(16명): Chovy 2024·Wolf 2015·Bang 2016·Smeb 2016·Nuguri 2020·ShowMaker 2020·BeryL/Canyon/ShowMaker 2021·Keria 2022·Tian 2019·Kanavi/knight 2020·Wunder 2019·Yike 2023·Bin 2024
  - **신규**: Bin (Chen Ze-Bin) 2024 LPL TOP=98 (OVERRIDE 없이 stats-driven)
- **지표 일관성 통일 (c8eb399)**: 04e ±7→±8, 2019~2021 재계산(z×4.0)
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

### 호빈 검토 필요 (v1.1 결과)
1. **Bin 2024 LPL TOP = 98**: OVERRIDE 없이 stats-driven. 수용 여부 (OVR_OVERRIDE 추가로 하향 또는 현재 유지)
2. **T1 2023 잔여 역전**: Oner(JGL 95) < Kanavi(96), Gumayusi(ADC 95) < Ruler(96) 1점 차
3. **Wolf 2015 LCK SUP = 98**: SKT 2015 Worlds 우승팀 — 수용 여부
4. **Rekkles 2018 LEC ADC = 98**: Fnatic (non-Worlds winner) — 하향 검토
5. **Yike 2023 LEC JGL = 98**: G2 LEC 3-split + FMVP + ALLPRO1ST — 수용 여부
6. **Oner 2022 = 97 vs Oner 2023 OVERRIDE=95**: 역전 구조 — 2022 OVERRIDE 추가 고려
7. **Apple|2014|LCS +7** (78→85): kda_z=4.38 극단값 — 제외 검토

## 다음 작업

### ① v1.1 검토 항목 결정 (호빈 결정 후)
- Bin 2024=98 수용 여부 / T1 2023 역전 / Wolf·Rekkles·Yike 98 수용 여부
- Canyon/Chovy 앵커 조정 필요 시: awards.csv EDITORIAL 마이너스 추가(Canyon -3, Chovy -5 전후)

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
- **리그 계수 적용 여부**: LCS 과대평가 확인(Doublelift 2019=94 > Faker 2019=90). 제안: 국내 플옵 가산에 계수 LCK/LPL×1.0, LEC×0.9, LCS×0.85 적용. 승인 시 즉시 구현 가능 (§9 外 변경이므로 명시 승인 필요)
- **Canyon/Chovy 앵커 조정 방향 결정** — 현재 Canyon 97(목표 96), Chovy 99(목표 96). 위 3가지 선택지 중 결정 필요
- **Vercel NEXT_PUBLIC_R2_PUBLIC_BASE_URL 설정 확인** — 미설정 시 사진 미표시
- **opponents-2026.json 실값 교체** (D3 — 현재 플레이스홀더)
- **DESIGN_GUIDE v1.0 승격** (D4 전) — CSS 토큰 확정 후 프론트 적용

## 미해결 이슈
- 앵커 가중치 미확정 (08 결과 후 PRD §6.2 기준 튜닝)
- LEC/LCS v1.1 (파이프라인 국내 결과 수집 후 추가)
- 네이밍/도메인 (PRD §13 Q1)

## 세션 로그 (최근 5개만 유지)
- 2026-06-13 (세션16): v1.1 최종 검증·정리 (0c9d0ec). XP+CS 블렌드·cap±7·T1 역전 해소 확인. OVR 99=4명 ✓, T1 Faker/Zeus 97 > JDG 96 ✓. progress_log 최종 상태 반영.
- 2026-06-13 (세션15): v1.1 OVR 전 연도 통합 완료 (c8eb399). 2024~2025 LP 수집 611건. 전 연도 cap ±7 통일. players.json 1709건 / OVR 99=4명 ✓. 신규 Bin 2024=98 (stats-driven).
- 2026-06-13 (세션14): awards.csv playerId 28건 수정+Xiaohu 활성화+LEC/LCS 국내결과+07-build 필터 수정. players.json 2223건. Bjergsen 89, G2 2019 93-97.
- 2026-06-12 (세션13): 3개 버그 수정 완료 (78384d5). Worlds frame 정확(13팀·연도), KT2015 5명(dedup), G2/FNC/C9/TL 포함 확인. players.json 1593건.
- 2026-06-12 (세션12): 5가지 묶음 적용 완료 (18896bd). OVR 압축 78~99, 99→2명, 카드 풀 2999→1714명.
- 2026-06-12 (세션11): OG 이미지 강화 (/api/og) + /r generateMetadata 완료 (67ffd0a). build 통과.
