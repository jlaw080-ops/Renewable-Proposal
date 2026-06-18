---
title: "AI 기반 신재생에너지 최적 조합 추천 기능 추가"
tags:
  - 작업기록
  - 신재생에너지
  - AI추천
  - 카카오맵
date: 2026-04-13
updated: 2026-04-14
---

# AI 기반 신재생에너지 최적 조합 추천 기능 추가

> [!info] 기본 정보
> - **대상 앱**: 신재생에너지 의무설치비율 검토 도구
> - **URL**: https://renewable-proposal.vercel.app/
> - **소스코드**: https://github.com/jlaw080-ops/Renewable-Proposal
> - **작업일**: 2026-04-13 ~ 2026-04-14

---

## 1. 배경 및 목적

### 기존 앱 현황

기존 앱은 건축물의 신재생에너지 의무설치비율을 자동 계산하고, Gemini AI 기반 검토 의견을 생성하는 브라우저 단일 페이지 웹앱이다.

- **기술 스택**: Vanilla JS + HTML + CSS, Google Gemini 2.5 Pro (SSE), jsPDF, html-docx-js
- **핵심 기능**: 사업정보 입력 → 예상에너지사용량 산출 → 설치비율 계산 → 의무비율 충족 여부 판정 → AI 검토의견 생성 → 리포트 출력(PDF/Word/HTML)
- **한계**: 사용자가 시나리오별 에너지원/형식/용량을 **수동으로 입력**해야 함

### 추가 요구사항

1. **AI 기반 에너지원 최적 조합 추천** — 에너지원별 장점, 단점, 제약사항에 따라 베스트 조합안 3개 생성 + 최선안 추천
2. **카카오맵 API 통합** — 실제 위치 기반 대지위치 선택
3. **제약조건 입력** — 태양광 설치면적, 지열 면적, 인근 지하철 노선, 연료전지 비용 등

---

## 2. 의사결정: 새로 만들기 vs 기존 앱 확장

### 결론: **기존 앱 확장** (Phase 0 리팩토링 없이)

| 새로 만들기 | 기존 앱 확장 |
|-------------|-------------|
| 70+종 에너지원 계수 데이터 재구축 필요 | 기존 라이브러리 데이터 그대로 활용 |
| 계산 엔진 재작성 | 검증된 계산 엔진 재사용 |
| 보고서 출력 재구현 | PDF/Word/HTML 출력 그대로 유지 |
| Vercel 배포 파이프라인 재구축 | 기존 배포 구조 유지 |

### Phase 0 리팩토링 건너뛴 이유

- `index.html` 1625줄 분해 작업은 사용자에게 보이는 변화 없음
- 새 기능은 `review/`, `report/`와 같은 **별도 .js 파일 패턴**으로 추가 가능
- 리팩토링은 새 기능 안정화 후에 해도 늦지 않음

---

## 3. 기존 앱 구조 분석

### 코드베이스 요약

| 항목 | 상태 |
|------|------|
| 총 코드량 | ~250KB |
| index.html | 72KB, 1625줄, 148개 함수 인라인 |
| 계산 로직 | engine/ 모듈과 index.html에 이중 존재 |
| 빌드 도구 | 없음 (Vanilla JS 직접 배포) |
| 라이브러리 데이터 | 에너지원 70+종, 지역 17개, 의무비율 150+항목 |
| AI 통합 | Gemini 2.5 Pro SSE 스트리밍 (검토의견 생성용) |

### 디렉토리 구조 (기존)

```
index.html              메인 SPA (인라인 스크립트 포함)
style.css               메인 스타일시트
config.js               API 키 설정
assets/logo.png         로고 이미지
data/                   라이브러리 데이터 (.js — window 전역변수 방식)
engine/                 계산 엔진 (ES 모듈)
review/                 AI 검토 기능
report/                 보고서 출력
api/review.js           Vercel Edge Function (Gemini 프록시)
```

### 데이터 흐름 (기존)

```
[사용자 입력] → collectInput1()
    │
    ▼
[Output1] calcOutput1(input1)
    연면적 × 지역계수 × 단위에너지사용량
    │
    ▼
[Output2] calcOutput2(input1, output1)
    시나리오별 생산량/사용량 × 100 = 설치비율
    │
    ▼
[렌더링] renderAll()
    │
    ▼
[AI 검토] generateReview() → Gemini SSE
    │
    ▼
[리포트] reportBuilder → PDF/Word/HTML
```

---

## 4. 구현 계획

### 전체 흐름 (완성 후)

```
① 사업정보 입력 (기존)
     │
② 카카오맵에서 위치 선택 (신규)
   → 시도 자동 매핑 + 좌표 저장
     │
③ 제약조건 입력 (신규)
   → 태양광면적, 지열면적, 지하철, 예산 등
     │
④ [AI 추천 실행] 클릭
   → Gemini가 3개 조합안 생성
   → 장점/단점/제약 분석 포함
     │
⑤ 추천 결과 비교 → 최선안 확인
   → "시나리오에 적용" 클릭
     │
⑥ 기존 계산 엔진 자동 실행 (기존)
   → 정확한 설치비율 산출
     │
⑦ AI 검토의견 + 보고서 출력 (기존)
```

### 핵심 설계 원칙

- AI 추천은 **초안 생성** 역할, 최종 계산은 기존 검증된 엔진이 담당
- 기존 코드 변경 최소화 — 새 기능은 별도 .js 파일로 분리
- 추천 결과를 기존 시나리오 입력 폼에 자동 입력하는 **브릿지 방식**

---

## 5. 구현 상세

### 5.1 추가된 파일 (4개)

#### `map/kakaoMap.js` (193줄)

카카오맵 통합 모듈.

**기능:**
- 지도 표시 (서울 시청 기본 중심)
- 클릭으로 위치 선택 → 마커 표시
- 주소 검색 (addressSearch + keywordSearch 폴백)
- 좌표 → 주소 변환 (reverseGeocode)
- 주소 → 17개 시도 자동 매핑 (강원 영동/영서 구분 포함)
- 사업정보 `sel-대지위치` 드롭다운 자동 동기화

**핵심 구현 포인트:**
- `autoload=false` 옵션으로 SDK 로딩 후 `kakao.maps.load()` 호출
- `waitForSDK()` — SDK 로딩 완료 대기 (200ms 간격, 최대 10초)
- 탭 클릭 시 지연 초기화 (컨테이너가 visible 상태에서만 지도 생성)
- `getBoundingClientRect()` 체크 → 크기 0이면 300ms 후 재시도
- `relayout()` 호출로 탭 재진입 시 지도 크기 보정

**시도 매핑 테이블:**

```javascript
var 시도매핑 = {
  "서울": "서울특별시",
  "경기": "경기도",
  "강원": "강원 영서",  // 기본값
  "세종": "충청남도·세종특별자치시",
  // ... 총 35개 매핑
};

// 강원도 영동 지역 시/군
var 강원영동 = ["강릉시","동해시","삼척시","속초시","양양군","고성군","태백시"];
```

**전역 인터페이스:**

```javascript
window.KakaoMapModule = {
  init: initMap,           // 지도 초기화
  search: searchAddress,   // 주소/키워드 검색
  getLocation: getSelectedLocation,  // 선택된 위치 반환
  syncToForm: syncToMainForm         // 사업정보 폼 동기화
};
```

---

#### `recommend/recommendPrompt.js` (124줄)

AI 추천용 프롬프트 빌더.

**시스템 프롬프트 핵심 규칙:**
1. JSON 형식으로만 응답 (설명 텍스트 없이)
2. 라이브러리에 존재하는 에너지원/형식만 사용
3. 설치비율이 의무비율을 충족하도록 설계
4. 태양광 고정식: 약 5㎡당 1kW
5. 지열 수직밀폐형: 약 50㎡당 1RT (≈3.517kW)
6. rank 1이 최선안, 각 안은 서로 다른 전략
7. 제약조건 반드시 준수

**사용자 메시지 구성:**

```
## 사업 정보
(사업형태, 사업연도, 대지위치, 면적 등)

## 용도별 연면적
(각 용도 + 연면적)

## 에너지 사용량
(총예상에너지사용량 kWh/yr)

## 의무비율
(주거구분, 의무비율 %)

## 위치 정보
(카카오맵 주소, 좌표 — 선택된 경우)

## 제약조건
(태양광 면적, 지열 면적, 지하철, 예산, 우선순위, 제외에너지원, 기타)

## 사용 가능한 에너지원 라이브러리
(70+종 전체 목록, 제외/제한 태그 포함)
```

**AI 응답 JSON 스키마:**

```json
{
  "recommendations": [
    {
      "rank": 1,
      "name": "조합안 이름",
      "strategy": "핵심 전략 설명",
      "systems": [
        { "에너지원": "태양광", "형식": "태양광-고정식", "적용용량": 50 }
      ],
      "estimated_ratio": 12.5,
      "pros": ["장점1", "장점2"],
      "cons": ["단점1"],
      "constraints_analysis": "제약조건 충족 여부 분석"
    }
  ],
  "best_pick": 1,
  "reasoning": "최선안 선정 이유"
}
```

---

#### `recommend/recommendEngine.js` (176줄)

AI 추천 실행 + 결과 렌더링 + 시나리오 적용.

**주요 함수:**

| 함수 | 역할 |
|------|------|
| `collectConstraints()` | 제약조건 폼에서 값 수집 |
| `runRecommendation()` | 사업정보+제약조건 → Gemini API 호출 → 결과 파싱 |
| `renderRecommendations()` | 3개 추천 카드 HTML 생성 |
| `applyRecommendation(rank)` | 선택한 안을 기존 시나리오에 자동 입력 |

**시나리오 적용 로직:**

```javascript
// 새 시나리오 생성 (id: "AI-1", "AI-2", "AI-3")
var newScenario = {
  id: "AI-" + rank,
  systems: rec.systems.map(function(sys) {
    var coeff = get신재생에너지계수(sys.에너지원, sys.형식);
    return {
      에너지원: sys.에너지원,
      형식: sys.형식,
      단위에너지생산량: coeff.단위에너지생산량,
      원별보정계수: coeff.원별보정계수,
      적용용량: sys.적용용량
    };
  })
};
// 기존 scenarios 배열에 추가 → renderAltTabs() → renderAll()
```

**SSE 스트림 파싱:**
- Gemini API SSE 응답에서 `data: {...}` 라인 추출
- `candidates[0].content.parts[0].text` 텍스트 누적
- 전체 누적 후 JSON.parse() — `{` ~ `}` 범위 추출로 안전 파싱

---

#### `api/recommend.js` (79줄)

Vercel Serverless Function — Gemini API 프록시.

**Edge → Node.js 런타임 전환 이유:**

| Edge Runtime | Node.js Runtime |
|-------------|----------------|
| 최대 25초 타임아웃 | 최대 60초 (maxDuration) |
| 504 FUNCTION_INVOCATION_TIMEOUT 발생 | 충분한 시간 확보 |

**설정:**

```javascript
export const config = {
  maxDuration: 60,
  supportsResponseStreaming: true,
};
```

**기본 모델:** `gemini-2.0-flash` (2.5-pro 대비 응답 속도 대폭 개선)

---

### 5.2 수정된 파일 (2개)

#### `index.html` (+167줄, 1625 → 1792)

**`<head>`에 추가:**

```html
<!-- 카카오맵 SDK -->
<script type="text/javascript"
  src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=b18abed707b223b8986ff979a8cb8517&libraries=services&autoload=false">
</script>
```

**좌측 패널 탭에 추가:**

```html
<button class="left-tab" role="tab" id="tab-recommend" data-panel="panel-recommend">
  <span class="left-tab-dot" style="background:var(--accent-yellow)"></span>
  AI 추천
</button>
```

**새 탭 패널 (panel-recommend) 내용:**
- 카카오맵 컨테이너 + 주소 검색 입력
- 위치 정보 표시 (주소, 좌표, 지역 매핑)
- 제약조건 입력 폼:
  - 태양광: 옥상 가용면적, 부지 가용면적
  - 지열: 부지 가용면적, 인근 지하철 노선 (라디오)
  - 연료전지: 안내 메시지 (높은 보정계수/비용)
  - 예산: 최소~최대 (만원)
  - 우선순위: 비용절감 / 효율극대화 / 균형 (라디오)
  - 제외할 에너지원 (체크박스, 동적 생성)
  - 기타 제약사항 (텍스트 자유입력)
- AI 추천 실행 버튼
- 추천 결과 표시 영역

**스크립트 태그 추가:**

```html
<script src="map/kakaoMap.js"></script>
<script src="recommend/recommendPrompt.js"></script>
<script src="recommend/recommendEngine.js"></script>
```

**`initRecommendTab()` 함수 추가:**
- 카카오맵 탭 클릭 시 지연 초기화
- 주소 검색 버튼/엔터 이벤트
- 제외 에너지원 체크박스 동적 생성 (`get에너지원목록()` 활용)
- AI 추천 실행 버튼 이벤트

---

#### `style.css` (+339줄, 1368 → 1707)

**추가된 스타일 컴포넌트:**

| 컴포넌트 | 설명 |
|----------|------|
| `.map-search-row` | 지도 검색 입력 + 버튼 레이아웃 |
| `.map-location-info` | 선택 위치 정보 표시 |
| `.section-subtitle` | 제약조건 섹션 부제목 |
| `.constraint-group` | 제약조건 그룹 컨테이너 |
| `.constraint-group-title` | 에너지원별 그룹 제목 (teal 색상) |
| `.constraint-note` | 연료전지 안내 메시지 (amber 배경) |
| `.constraint-warn` | 지하철 경고 텍스트 (red) |
| `.radio-row` / `.checkbox-row` | 라디오/체크박스 레이아웃 |
| `.btn-recommend-run` | AI 추천 실행 버튼 (그라디언트) |
| `.recommend-loading` | 로딩 스피너 |
| `.recommend-error` | 오류 메시지 |
| `.recommend-reasoning` | 최선안 선정 이유 배너 |
| `.recommend-cards` | 추천 카드 그리드 |
| `.recommend-card` | 개별 추천 카드 |
| `.recommend-card.best` | 최선안 카드 (teal 테두리 + 그림자) |
| `.recommend-badge` | "최선안" 배지 |
| `.recommend-systems` | 시스템 구성 목록 |
| `.recommend-ratio` | 예상 설치비율 표시 |
| `.recommend-pros` / `.recommend-cons` | 장점(green) / 단점(red) |
| `.recommend-constraint-analysis` | 제약 분석 텍스트 |
| `.btn-apply-recommend` | "이 안으로 시나리오 적용" 버튼 |

---

## 6. 트러블슈팅

### 6.1 카카오맵 주소 검색 안 됨

**원인:**
1. 지도가 숨겨진 탭(display:none)에서 초기화 → 컨테이너 크기 0 → 렌더링 실패
2. SDK `autoload=false` 설정에서 `kakao.maps.load()` 호출 타이밍 문제
3. 프로토콜 상대 URL (`//dapi.kakao.com`) 문제 가능성

**해결:**
- SDK 로딩 완료 대기 `waitForSDK()` 추가 (200ms 폴링, 최대 10초)
- 탭 클릭 시 지연 초기화 (150ms 딜레이 후 initMap 호출)
- `getBoundingClientRect()` 체크 → 크기 0이면 300ms 후 재시도
- SDK URL을 `https://` 명시적 사용
- 검색 결과 없을 시 alert 피드백 추가

> [!warning] 카카오 개발자 콘솔 설정 필요
> https://developers.kakao.com → 내 애플리케이션 → 플랫폼 → Web → 사이트 도메인에 `https://renewable-proposal.vercel.app` 추가 필요

### 6.2 AI 추천 API 504 타임아웃

**원인:** Vercel Edge Runtime 25초 제한 < Gemini 2.5 Pro 응답 시간

**해결:**

| 변경 | 이전 | 이후 |
|------|------|------|
| 런타임 | Edge (25초 제한) | Node.js (`maxDuration: 60`) |
| 모델 | gemini-2.5-pro | gemini-2.0-flash (빠름) |
| 스트리밍 | Edge ReadableStream | Node.js `res.write()` |

---

## 7. 커밋 이력

| 커밋 | 내용 |
|------|------|
| `2db1f8d` | feat: AI 기반 신재생에너지 최적 조합 추천 기능 추가 (4개 파일 신규, 2개 파일 수정) |
| `fb41b11` | fix: 카카오맵 초기화 타이밍 수정 (SDK 대기, 탭 클릭 지연 초기화, HTTPS) |
| `3220599` | fix: 추천 API 타임아웃 해결 (Edge→Node.js, gemini-2.0-flash) |

---

## 8. 최종 파일 구조

```
index.html              메인 SPA (+167줄)
style.css               메인 스타일시트 (+339줄)
api/
  ├── review.js          기존 Gemini 프록시 (검토의견)
  └── recommend.js       ★ 신규: AI 추천 프록시 (Node.js, 60s)
map/
  └── kakaoMap.js        ★ 신규: 카카오맵 통합
recommend/
  ├── recommendPrompt.js ★ 신규: AI 추천 프롬프트 빌더
  └── recommendEngine.js ★ 신규: AI 추천 실행/렌더링/적용
data/                    기존 라이브러리 (변경 없음)
engine/                  기존 계산 엔진 (변경 없음)
review/                  기존 AI 검토 (변경 없음)
report/                  기존 보고서 출력 (변경 없음)
```

---

## 9. 향후 개선 사항

- [ ] Phase 0 리팩토링 (index.html 모듈 분리, Vite 빌드 도입)
- [ ] 기상자원지도 API 연동 (위치별 실제 일사량 데이터)
- [ ] 추천 결과를 보고서에 포함 (reportBuilder.js 확장)
- [ ] 카카오맵 API 키 환경변수 이동 (현재 index.html 하드코딩)
- [ ] 추천 프롬프트 커스터마이징 UI (기존 검토의견 프롬프트 관리와 동일 패턴)
- [ ] 추천 이력 localStorage 저장
