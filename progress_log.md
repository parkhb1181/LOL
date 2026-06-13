# v1.1 OVR 지표 반영 작업 — 진행 로그

담당 연도: 2019~2021 (별도 담당자) / **2022~2023 (이 세션 담당)**
브랜치: ovr-stats-rework
시작일: 2026-06-13

## 안전장치 (완료)
- [x] backup_v1.0/ 생성 (players.json, awards.csv, 04-ratings.ts 복사)
- [x] ovr-stats-rework 브랜치 생성

---

## [2022~2023 담당] ✅ 완료

### 데이터 소스: Leaguepedia ScoreboardPlayers (OE 대체)
- OE oracleselixir.com 전체 403, S3 oracles-elixir 버킷 us-east-1 403 (API 키 있으나 서명 없음)
- **대안**: Leaguepedia ScoreboardPlayers GROUP BY (Link, Team, IngameRole)
- golddiffat15/xpdiffat15/csdiffat15 없음 → CS per game 대체 (호빈 검토 필요)
- 수집 지표: **KDA 35% + GoldShare 25% + CS 20% + DamageToChampions 20%**
- scale 3.0, 다지표 캡 ±8

| 연도 | 상태 | 건수 | 매칭 | 비고 |
|------|------|------|------|------|
| 2022 | ✅ 완료 | 365건 | 180/180 (100%) | golddiffat15 없음 |
| 2023 | ✅ 완료 | 338건 | 185/185 (100%) | golddiffat15 없음 |

**출력 파일**:
- `pipeline-cache/oe-stats-2022-2023.json` (703건 원시 z-score)
- `pipeline-cache/oe-comparison-2022-2023.json` (365건 OVR 비교표)

### 주요 OVR 변화
| 선수 | 연도 | 역할 | 현재 | 신규 | 변화 | 메모 |
|------|------|------|------|------|------|------|
| Chovy | 2022 | MID | 88 | 94 | +6 | stat 2.015σ — 라인전 지배력 반영 |
| Kanavi | 2023 | JGL | 96 | 99 | +6 | JDG 2023, 합리적 |
| Yike | 2023 | JGL | 97 | 99 | +6 | ⚠️ 루키, 베이스 97이 높음 — 호빈 검토 필요 |
| Inspired | 2022 | JGL | 92 | 97 | +5 | 검토 |
| Oner | 2022 | JGL | 93 | 97 | +4 | ⚠️ Oner 2023 OVERRIDE=94보다 높음 — 검토 필요 |
| Malrang | 2023 | JGL | 76 | 75 | -4 | 클램프(최소 75) |

---

## [2022~2023] 포지션별 정규화 현황

| 연도 | TOP | JGL | MID | ADC | SUP | 상태 |
|------|-----|-----|-----|-----|-----|------|
| 2022 | 81명 | 71명 | 67명 | 70명 | 76명 | ✅ 완료 |
| 2023 | 64명 | 61명 | 73명 | 67명 | 73명 | ✅ 완료 |

---

## [2024~2025 담당] ✅ 완료

### 데이터 소스: Leaguepedia ScoreboardPlayers (2022~2023과 동일 방식)
- OE S3 직접 접근은 이전 시도에서 확인된 403 차단 → LP 경로로 진행
- **수집 지표**: KDA 35% + GoldShare 25% + CS 20% + DamageToChampions 20% (Mode B — at-15 미수집)
- 스크립트: `scripts/04d-oe-stats.ts`

| 연도 | 상태 | 건수 | 상승 | 하락 | 평균보너스 |
|------|------|------|------|------|----------|
| 2024 | ✅ 완료 | 315건 | 130 | 124 | +0.03 |
| 2025 | ✅ 완료 | 296건 | 124 | 117 | +0.01 |

**출력 파일**: `pipeline-cache/oe-stats-2024-2025.json` (611건)

### 앵커 검증 (2024~2025)
| 선수 | 연도 | 팀 | bonus | compositeZ | 비고 |
|------|------|---|-------|-----------|------|
| Chovy | 2024 | Gen.G | +7 | 2.224 | kda=2.674, gs=2.021, cs=1.919, dmg=1.998 |
| Faker | 2024 | T1 | 0 | 0.139 | kda=0.582, gs=-0.536 |
| Bin | 2024 | 팀 미표시 | OVR=98 | - | stats-driven, OVERRIDE 없음 ⚠️ |
| Chovy | 2025 | Gen.G | +4 | 1.439 | |
| Faker | 2025 | T1 | -1 | -0.252 | |

### 04-ratings.ts 통합 (2024~2025)
- 로딩: `pipeline-cache/oe-stats-2024-2025.json` → `newStatsByKey` Map
- 키: `${playerId.lower()}|${year}|${team.lower()}`
- bonusCap 단일화: `const bonusCap = 8` (전 연도 통일)

### 지표 일관성 통일 (전 연도)
| 항목 | 통일 결과 |
|------|---------|
| 다지표 cap | **전 연도 ±7** (04b/04c/04d/04e 공통 — ±8→±7 통일) |
| 라인전 지표 | 2019~2021: XP+CS 블렌드 (04d 2024~2025와 동일) / 연도별 가용성 차이는 z-score 내 상대 비교로 공정 |
| 결측치 | 04b: z=0 폴백 / 04e-early: 동적 재분배 / 04c/04d: z=0 |
| 포지션별 정규화 | 전 연도 ✓ |

---

## [2019~2021 담당] ✅ 완료

### 데이터 소스: Oracle's Elixir (Google Drive 공개 폴더)
- oracleselixir.com/S3 직접 접근 실패 → JS 번들 역분석 → Google Drive 폴더 ID 발견
- 다운로드 URL: `drive.usercontent.google.com/download?id={fileId}&export=download&confirm=t`

| 연도 | 상태 | 파일명 | 크기 | 선수-팀 유니크 | 5게임+ | 비고 |
|------|------|--------|------|----------------|--------|------|
| 2019 | ✅ 완료 | pipeline-cache/oe/2019.csv | 69.8 MB | 461건 | 389건 | |
| 2020 | ✅ 완료 | pipeline-cache/oe/2020.csv | 84.9 MB | 403건 | 369건 | |
| 2021 | ✅ 완료 | pipeline-cache/oe/2021.csv | 104.7 MB | 357건 | 318건 | |

**지표 구성 (4종, 사전 승인)**:
| 지표 | 컬럼 | 가중치 |
|------|------|--------|
| KDA | (kills+assists)/max(1,deaths) | 35% |
| 골드차 | golddiffat15 | 25% |
| 라인전 | (xpdiffat15/100 + csdiffat15)/2 블렌드 | 20% |
| 데미지 | dpm | 20% |

- 정규화: 포지션 × 연도별 z-score (OE 전체 선수 기준 — 우리 DB 미한정)
- 결측치(null): 0 처리 (포지션 평균 대체 아님 — 호빈 확인 필요)
- 매칭 커버리지: **93.1% (715/768)** — 미매칭 6.9%는 보조 로스터(OVR 보너스 0)

**출력 파일**:
- `pipeline-cache/oe/stats_2019.json` (389건)
- `pipeline-cache/oe/stats_2020.json` (369건)
- `pipeline-cache/oe/stats_2021.json` (318건)
- `scripts/04b-oe-stats.ts` — 집계·정규화 스크립트

**04-ratings.ts 통합**:
- OE 보너스 로딩: `oeBonusByKey` Map (normName|year|league 키)
- 2019~2021: OE composite bonus 적용 (캡 ±7 — 전 연도 통일)
- 2013~2018: KDA z-score ±3 클램프 유지
- compressOvr 상한: 99 → **98** (99는 OVR_OVERRIDES로만)
- OVR 99 확정 4명: Faker 2013, MaRin 2015, Faker 2016, Canyon 2020

**최종 빌드 결과** (07-build.ts zod 통과):
- players.json: 1,709건
- OVR 분포: 75~79: 857건, 80~84: 442건, 85~89: 233건, 90~94: 109건, 95~99: 68건

### OVR 99 검증 ✅
```
Faker 2013 LCK MID = 99
MaRin 2015 LCK TOP = 99
Faker 2016 LCK MID = 99
Canyon 2020 LCK JGL = 99
합계: 정확히 4명
```

### 주요 OVR 변화 (2019~2021)
| 선수 | 연도 | v1.0 | v1.1 | 변화 | 메모 |
|------|------|------|------|------|------|
| Chovy | 2020 | 78 | 85 | +7 | Griffin 부진에도 개인 지표 우수 |
| Deft | 2020 | 77 | 84 | +7 | 개인 지표 강세 |
| TheShy | 2019 | 86 | 92 | +6 | IG 우승팀 주전 |
| Blaber | 2020 | 92 | 96 | +4 | LCS 최강 정글 |
| Mata | 2019 | 90 | 87 | -3 | SUP 포지션 구조 특성 |

### 판단 목록 (확정)
1. **라인전: XP+CS 블렌드** (`(xpdiffat15/100 + csdiffat15)/2`): 2024~2025(04d)와 통일 — 확정
2. **결측치 → z=0 폴백**: golddiffat15/라인전 null 시 해당 지표 z=0 처리, nMetrics 기반 동적 cap — 확정
3. **미매칭 6.9%**: OVR 85+ 미매칭 = 0건 (최고 Sword 2019 LCK = 82) — 무명 보조 로스터만 → 보너스 0 유지

### T1 2023 역전 해소 ✅
- 수정 전: JDG 97 ≥ T1 Faker 94 (역전)
- 수정 후: T1 Faker/Zeus 97, Keria 96, Oner/Gumayusi 95 > JDG knight/Kanavi/Ruler 96

---

## [2016~2018 담당] Oracle's Elixir 데이터 수집 현황

### ⚠️ OE 자동 다운로드 실패 — Leaguepedia 대체 (2022~2023 담당자와 동일)
- oracleselixir.com 전체 403 차단 (Cloudflare WAF)
- S3 직접 URL 404 (버킷 이전/삭제)
- **대안 채택**: Leaguepedia ScoreboardPlayers Cargo API (기존 stats_agg_*.json 활용)

### 2016~2018 특수 사항
- **DamageToChampions**: Leaguepedia에 수록되어 있으나 2016~2018 실제 데이터 **전부 공란(0%)**
- **golddiffat15/xpdiffat15/csdiffat15**: Leaguepedia에 없음 (OE 전용 지표)
- **사용 가능 지표 (stats_agg에서 직접 파생)**:
  - KDA = (AvgK+AvgA)/max(AvgD,0.5)
  - GoldShare = AvgG/AvgTG  
  - KillParticipation = (AvgK+AvgA)/max(AvgTK,1)

### 2016~2018 v1.1 지표 구성 결정
| 지표 | 가중치 | 원본 요청 대비 비고 |
|---|---|---|
| KDA z-score | 40% | 35%→40% 상향 (damage 탈락 보정) |
| GoldShare z-score | 35% | 골드차 at-15 대체 (전 게임 금획득 비율) |
| KP z-score | 25% | 라인전 at-15 대체 (킬관여율) |
- OVR 기여폭: ±7점 (기존 ±3 확대)
- CS 추가 쿼리: rate limit 해제 후 v1.2로 연기

| 연도 | 상태 | 데이터 소스 | Dmg | KDA | GS | KP |
|------|------|------------|-----|-----|----|----|
| 2016 | 스크립트 완료 | Leaguepedia stats_agg | ✗ | ✓ | ✓ | ✓ |
| 2017 | 스크립트 완료 | Leaguepedia stats_agg | ✗ | ✓ | ✓ | ✓ |
| 2018 | 스크립트 완료 | Leaguepedia stats_agg | ✗ | ✓ | ✓ | ✓ |

---

## [2016~2018] 포지션별 정규화 현황


### [2016~2018] 포지션별 정규화 현황 — 04e-ovr-final 결과
TOP 2016: OE=33 LP=39 평균bonus=-0.14
JGL 2016: OE=35 LP=38 평균bonus=-0.18
MID 2016: OE=33 LP=40 평균bonus=-0.18
ADC 2016: OE=25 LP=48 평균bonus=-0.05
SUP 2016: OE=23 LP=50 평균bonus=-0.14
TOP 2017: OE=31 LP=31 평균bonus=0.05
JGL 2017: OE=30 LP=33 평균bonus=-0.10
MID 2017: OE=35 LP=28 평균bonus=0.03
ADC 2017: OE=33 LP=30 평균bonus=-0.03
SUP 2017: OE=27 LP=36 평균bonus=0.11
TOP 2018: OE=32 LP=21 평균bonus=0.00
JGL 2018: OE=30 LP=24 평균bonus=0.04
MID 2018: OE=30 LP=24 평균bonus=-0.15
ADC 2018: OE=31 LP=23 평균bonus=-0.11
SUP 2018: OE=28 LP=26 평균bonus=0.15

### [2016~2018] 포지션별 정규화 현황 — 04e-ovr-final 결과
TOP 2016: OE=33 LP=39 평균bonus=-0.14
JGL 2016: OE=35 LP=38 평균bonus=-0.18
MID 2016: OE=33 LP=40 평균bonus=-0.18
ADC 2016: OE=25 LP=48 평균bonus=-0.05
SUP 2016: OE=23 LP=50 평균bonus=-0.14
TOP 2017: OE=31 LP=31 평균bonus=0.05
JGL 2017: OE=30 LP=33 평균bonus=-0.10
MID 2017: OE=35 LP=28 평균bonus=0.03
ADC 2017: OE=33 LP=30 평균bonus=-0.03
SUP 2017: OE=27 LP=36 평균bonus=0.11
TOP 2018: OE=32 LP=21 평균bonus=0.00
JGL 2018: OE=30 LP=24 평균bonus=0.04
MID 2018: OE=30 LP=24 평균bonus=-0.15
ADC 2018: OE=31 LP=23 평균bonus=-0.11
SUP 2018: OE=28 LP=26 평균bonus=0.15

### [2016~2018] 포지션별 정규화 현황 — 04e-ovr-final 결과
TOP 2016: OE=33 LP=39 평균bonus=-0.14
JGL 2016: OE=35 LP=38 평균bonus=-0.18
MID 2016: OE=33 LP=40 평균bonus=-0.18
ADC 2016: OE=25 LP=48 평균bonus=-0.05
SUP 2016: OE=23 LP=50 평균bonus=-0.14
TOP 2017: OE=31 LP=31 평균bonus=0.05
JGL 2017: OE=30 LP=33 평균bonus=-0.10
MID 2017: OE=35 LP=28 평균bonus=0.03
ADC 2017: OE=33 LP=30 평균bonus=-0.03
SUP 2017: OE=27 LP=36 평균bonus=0.11
TOP 2018: OE=32 LP=21 평균bonus=0.00
JGL 2018: OE=30 LP=24 평균bonus=0.04
MID 2018: OE=30 LP=24 평균bonus=-0.15
ADC 2018: OE=31 LP=23 평균bonus=-0.11
SUP 2018: OE=28 LP=26 평균bonus=0.15

### [2016~2018] 포지션별 정규화 현황 — 04e-ovr-final 결과
TOP 2016: OE=33 LP=39 평균bonus=-0.14
JGL 2016: OE=35 LP=38 평균bonus=-0.19
MID 2016: OE=33 LP=40 평균bonus=-0.19
ADC 2016: OE=25 LP=48 평균bonus=-0.07
SUP 2016: OE=23 LP=50 평균bonus=-0.12
TOP 2017: OE=31 LP=31 평균bonus=0.03
JGL 2017: OE=30 LP=33 평균bonus=-0.10
MID 2017: OE=35 LP=28 평균bonus=0.05
ADC 2017: OE=33 LP=30 평균bonus=-0.03
SUP 2017: OE=27 LP=36 평균bonus=0.11
TOP 2018: OE=32 LP=21 평균bonus=0.00
JGL 2018: OE=30 LP=24 평균bonus=0.04
MID 2018: OE=30 LP=24 평균bonus=-0.15
ADC 2018: OE=31 LP=23 평균bonus=-0.13
SUP 2018: OE=28 LP=26 평균bonus=0.15

### [2016~2018] 포지션별 정규화 현황 — 04e-ovr-final 결과
TOP 2016: OE=33 LP=39 평균bonus=-0.17
JGL 2016: OE=35 LP=38 평균bonus=-0.19
MID 2016: OE=33 LP=40 평균bonus=-0.16
ADC 2016: OE=25 LP=48 평균bonus=-0.07
SUP 2016: OE=23 LP=50 평균bonus=-0.08
TOP 2017: OE=31 LP=31 평균bonus=0.02
JGL 2017: OE=30 LP=33 평균bonus=-0.06
MID 2017: OE=35 LP=28 평균bonus=0.02
ADC 2017: OE=33 LP=30 평균bonus=0.03
SUP 2017: OE=27 LP=36 평균bonus=0.11
TOP 2018: OE=32 LP=21 평균bonus=-0.08
JGL 2018: OE=30 LP=24 평균bonus=0.02
MID 2018: OE=30 LP=24 평균bonus=-0.09
ADC 2018: OE=31 LP=23 평균bonus=-0.07
SUP 2018: OE=28 LP=26 평균bonus=0.11

### [2016~2018] 포지션별 정규화 현황 — 04e-ovr-final 결과
TOP 2016: OE=33 LP=39 평균bonus=-0.17
JGL 2016: OE=35 LP=38 평균bonus=-0.19
MID 2016: OE=0 LP=73 평균bonus=-0.03
ADC 2016: OE=25 LP=48 평균bonus=-0.07
SUP 2016: OE=23 LP=50 평균bonus=-0.08
TOP 2017: OE=31 LP=31 평균bonus=0.02
JGL 2017: OE=30 LP=33 평균bonus=-0.06
MID 2017: OE=2 LP=61 평균bonus=0.03
ADC 2017: OE=33 LP=30 평균bonus=0.02
SUP 2017: OE=27 LP=36 평균bonus=0.11
TOP 2018: OE=32 LP=21 평균bonus=-0.08
JGL 2018: OE=30 LP=24 평균bonus=0.04
MID 2018: OE=3 LP=51 평균bonus=0.02
ADC 2018: OE=31 LP=23 평균bonus=-0.17
SUP 2018: OE=28 LP=26 평균bonus=0.11

---

## 이슈 로그

| 날짜 | 연도 | 내용 |
|------|------|------|
| 2026-06-13 | 2022~2023 | OE oracleselixir.com 403, S3 버킷 403 확정 — API 키 있으나 서명 없어 직접 접근 불가 |
| 2026-06-13 | 2022~2023 | golddiffat15 Leaguepedia 미제공 — CS per game 대체 (호빈 검토 필요) |
| 2026-06-13 | 2022~2023 | ✅ Leaguepedia 수집 완료: 703건, 매칭 365/365 (100%), 최대 변화 +6/-4 |
| 2026-06-13 | 전체 | 新규칙: 다지표 시즌 ±8, KDA 단일/부족 시즌 ±3 (04-ratings.ts 통합 시 적용) |
| 2026-06-13 | 2022~2023 | ⚠️ Yike 2023 베이스 97 → +6 = 99 (루키 과대평가 가능성), Oner 2022→97 vs 2023 OVERRIDE=94 역전 — 호빈 검토 필요 |
| 2026-06-13 | - | 2019~2021 담당자 작업 대기 중 |
| 2026-06-13 | 2016~2018 | OE 403/404 차단 (동일) — Leaguepedia stats_agg 활용 |
| 2026-06-13 | 2016~2018 | DamageToChampions 2016~2018 전부 공란 — 제외 (KDA+GS+KP 3지표) |
| 2026-06-13 | 2016~2018 | CS 추가 쿼리 Leaguepedia rate limit으로 연기 |
| 2026-06-13 | 2016~2018 | 표본 이슈: 2016 이전(2013~2015) stats_agg 전체 리그 기준 — z-score 모집단 공정함. 단 2013은 표본 소규모(n<50/role) 가능 — 호빈 검토 필요 |

---

## [2013~2015 담당] v1.1 작업 완료

### 작업 개요
- 스크립트: `scripts/04e-early-stats.ts`
- 출력: `pipeline-cache/ovr-stats-early.json` (1012건) / `pipeline-cache/ovr-comparison-early.csv` (1165행)
- 데이터 소스: Leaguepedia ScoreboardPlayers `stats_agg_{LEAGUE}_{YEAR}.json` (Oracle's Elixir 2013~2015 미제공)

### 지표 구성 (동적 가중치 재분배)

| 조합 | 적용 연도·리그 | 가중치 |
|------|--------------|--------|
| KDA+GS+KP | 2013 전리그(LCK 제외), 2015 전리그 | KDA 40%+GS 35%+KP 25% |
| KDA+KP | 2014 전리그, 2013 LCK | KDA 62%+KP 38% |
| KDA only | 2013~2014 LCK (GS+KP 모두 없음) | KDA 100% |

### 포지션×연도 버킷 통계 (KDA mu±sd, GS/KP 유효 여부)

| 연도 | 역할 | n | KDA평균 | KDA표준편차 | GS | KP |
|------|------|---|---------|------------|----|----|
| 2013 | TOP | 72 | 3.21 | 1.33 | ✅ | ✅ |
| 2013 | JGL | 71 | 3.57 | 2.30 | ✅ | ✅ |
| 2013 | MID | 72 | 3.34 | 1.35 | ✅ | ✅ |
| 2013 | ADC | 72 | 4.17 | 2.48 | ✅ | ✅ |
| 2013 | SUP | 71 | 3.50 | 1.53 | ✅ | ✅ |
| 2014 | TOP | 83 | 3.06 | 1.40 | ❌ | ✅ |
| 2014 | JGL | 83 | 2.96 | 1.18 | ❌ | ✅ |
| 2014 | MID | 83 | 3.62 | 1.57 | ❌ | ✅ |
| 2014 | ADC | 86 | 3.69 | 1.73 | ❌ | ✅ |
| 2014 | SUP | 86 | 2.82 | 1.34 | ❌ | ✅ |
| 2015 | TOP | 75 | 2.93 | 1.00 | ✅ | ✅ |
| 2015 | JGL | 73 | 3.44 | 1.31 | ✅ | ✅ |
| 2015 | MID | 75 | 3.59 | 1.37 | ✅ | ✅ |
| 2015 | ADC | 75 | 4.09 | 1.70 | ✅ | ✅ |
| 2015 | SUP | 73 | 3.33 | 1.44 | ✅ | ✅ |

> 2014 GS 제외 이유: LCK 2014 AvgTG 공란(112건/431건 → 비율 26% < 임계 30%), 전리그 버킷으로 구성해도 비율 미달.

### 연도별 처리 결과

| 연도 | 총 | LCK | LPL | LEC | LCS |
|------|-----|-----|-----|-----|-----|
| 2013 | 358 | 143 | 55 | 85 | 75 |
| 2014 | 431 | 112 | 54 | 127 | 138 |
| 2015 | 376 | 77 | 94 | 101 | 104 |
| **합계** | **1165** | | | | |

### 포지션별 보너스 분포 (2013~2015 합산)

| 포지션 | n | 상승 | 하락 | 유지 | 평균 보너스 |
|--------|---|------|------|------|------------|
| TOP | 234 | 125 | 67 | 42 | +0.61 |
| JGL | 231 | 112 | 80 | 39 | +0.54 |
| MID | 234 | 129 | 66 | 39 | +0.72 |
| ADC | 235 | 120 | 79 | 36 | +0.51 |
| SUP | 231 | 125 | 76 | 30 | +0.52 |

### 주요 앵커 결과

| 선수 | 연도 | 리그 | 현재OVR | 보너스 | 예상OVR | kda_z | composite_z |
|------|------|------|---------|--------|---------|-------|-------------|
| Faker | 2015 | LCK | 99 | +3 | 99 | 1.26 | 0.76 |
| MaRin | 2015 | LCK | 99 | +3 | 99 | 1.96 | 0.97 |
| Bang | 2015 | LCK | 98 | +3 | 99 | 1.45 | 0.71 |
| Wolf (Lee Jae-wan) | 2015 | LCK | 98 | +3 | 99 | 2.04 | 0.98 |
| Faker | 2013 | LCK | 95 | +3 | 98 | 0.91 | 0.91 |
| Mata | 2014 | LCK | 94 | +2 | 96 | 0.67 | 0.67 |
| DanDy | 2014 | LCK | 89 | +4 | 93 | 1.22 | 1.22 |
| Looper | 2014 | LCK | 89 | +7 | 96 | 1.87 | 1.87 |
| imp | 2014 | LCK | 87 | +2 | 89 | 0.44 | 0.44 |
| Clearlove | 2015 | LPL | 88 | +7 | 95 | 3.58 | 1.97 |
| YellOwStaR | 2015 | LEC | 95 | +6 | 99 | 3.81 | 1.78 |
| YellOwStaR | 2014 | LEC | 86 | +5 | 91 | 1.40 | 1.38 |
| Bjergsen | 2014 | LCS | 90 | +5 | 95 | 1.33 | 1.36 |
| Bjergsen | 2015 | LCS | 89 | +3 | 92 | 1.31 | 0.94 |
| Uzi (Jian Zi-Hao) | 2013 | LPL | 82 | +0 | 82 | 0.42 | 0.14 |
| Uzi (Jian Zi-Hao) | 2015 | LPL | 76 | +1 | 77 | -0.15 | 0.31 |
| RooKie | 2015 | LPL | 78 | +1 | 79 | 0.11 | 0.30 |

### 큰 변화 선수 (|보너스|≥5) — 호빈 검토 권장

| 선수 | 연도 | 리그 | 현재OVR→예상 | 특이사항 |
|------|------|------|------------|---------|
| Meteos | 2013 | LCS | 78→85 (+7) | C9 2013 지배적 시즌 (n=33), kda_z=4.10 |
| Apple | 2014 | LCS | 78→85 (+7) | KDA-only 15경기, kda_z=4.38 — **극단값 의심** |
| Clearlove | 2015 | LPL | 88→95 (+7) | kda_z=3.58 극단, LPL EDG 지배 시즌 |
| Looper | 2014 | LCK | 89→96 (+7) | Samsung White TOP, KDA-only |
| Rekkles | 2014 | LEC | 86→93 (+7) | GS-없음, kda_z=3.04 |
| U | 2014 | LPL | 90→97 (+7) | LPL MID, composite=1.91 |
| YellOwStaR | 2015 | LEC | 95→99 (+6) | kda_z=3.81, Fnatic 2015 지배 |
| Santorin | 2015 | LCS | 85→90 (+5) | kda_z=2.60, 결과적 과평가 가능성 |
| Spirit | 2014 | LCK | 90→95 (+5) | Samsung Blue JGL, KDA-only |

### 알고리즘 결정 사항

1. **GS 버킷 유효 임계**: 버킷 내 GS>0 비율 30% 미만 시 GS 제외 (2014 전리그 영향)
2. **동적 가중치**: 개인 플래그(hasGs/hasKp) + 버킷 분산 모두 확인 — LCK 2013 선수가 타리그 GS 데이터로 페널티받는 문제 수정
3. **표본 소규모 패널티**: n<10 → 보너스 ±3 클램프 (n=10~33 구간은 통계 불안정 가능 — 개선 여지)
4. **중복 처리**: 같은 선수 동일 연도·리그 두 팀 엔트리 → 경기 수 더 많은 쪽 사용

---

## 완료 연도

- [x] **2013~2015** — `scripts/04e-early-stats.ts` 완료, 출력 파일 생성 완료 (2026-06-13)
