# 신재생에너지 의무설치비율 검토 도구

건축물의 신재생에너지 의무설치비율을 계산하고, 설비 조합을 최적화하고, AI 검토의견·보고서를 생성하는 웹앱.
프로덕션: https://renewable-proposal.vercel.app (main 푸시 시 자동 배포)

## 기술 스택

- **프레임워크**: Next.js (App Router, JavaScript — TypeScript 아님)
- **스타일**: Vanilla CSS + 커스텀 프로퍼티. 디자인 토큰 정본은 `styles/tokens.css` (ENERGINNO Theme T)
- **폰트**: NanumSquareNeo 자체 호스팅(`app/fonts/`, next/font/local) + IBM Plex Mono(수치·표)
- **AI**: Google Gemini (검토의견·조합 추천·설명) — 서버 API 라우트 경유 SSE
- **지도·주소**: NCP Maps(지도·지오코딩) + 도로명주소 API + 건축물대장 API
- **보고서**: jsPDF·html2canvas·docx (CDN, SRI 해시 고정)
- **테스트**: `node --test` (tests/*.test.mjs) + Playwright E2E(verify/)

## 명령

| 명령 | 용도 |
|------|------|
| `npm test` | 순수 로직 테스트 (현재 79개) |
| `npm run dev` / `build` | 로컬 개발·빌드 |
| `npm run verify` | 엔진 출력 덤프 (동일성 확인용 — 자체 판정 하니스 아님) |
| `node verify/e2e_redesign.mjs <URL>` | E2E 게이트: 5폭 오버플로·모달 포커스 트랩 |

> **주의**: 이 폴더는 Dropbox 동기화 대상이라 `npm run dev`/`build`가 매우 느리다(수 분).
> UI 검증은 로컬 빌드 대신 **브랜치 푸시 → Vercel Preview + Playwright** 경로를 쓴다.
> `npm run dev`는 `.next` 프로덕션 빌드를 덮어쓴다.

## 디렉토리 구조

```
app/                    Next.js App Router
  page.js               대시보드 (프로젝트 목록·진행상태·판정 요약)
  layout.js             루트 레이아웃 (폰트·ToastProvider)
  fonts/                NanumSquareNeo woff2 (400/700/800)
  project/[id]/         워크스페이스 4단계
    WorkspaceShell.jsx  다크 나브 + 스테퍼 + 다음 단계 CTA
    info/               ① 사업정보 (지도·토지정보·용도별 연면적)
    calc/               ② 검토 계산 (Output1 전폭 → 판정 바 → 2열: 시나리오|Output2)
    optimize/           ③ 최적화·AI (표/카드 뷰·정렬·필터)
    report/             ④ 보고서 (AI 검토의견·PDF/Word/HTML)
  api/                  서버 라우트: geocode·reverse-geocode·landinfo·recommend·review
components/
  ui/                   공통: Button·Card·Field·Select·Modal·Table·Badge·Stepper·Toast
  calc/ map/ optimize/ report/ info/ settings/    화면별 컴포넌트
lib/                    순수 로직·훅 (테스트 대상)
styles/tokens.css       색·타이포·간격 토큰 정본 (유일한 스타일 상수 원천)
engine/                 계산 엔진 (ES 모듈) — 무수정
public/                 엔진이 로드하는 자산 — 무수정
  data/                 10개 라이브러리 (window.LIB_* 전역)
  optimize/ review/ report/ settings/ map/   legacy 계승 스크립트
legacy/                 구버전 단일 HTML 앱 (index.html·config.js·style.css) — 참고용, 무수정
tests/                  node:test 순수 로직 테스트
verify/                 엔진 덤프 스크립트 + E2E
docs/superpowers/       설계(specs)·구현 계획(plans) 이력
```

## 불변 원칙 (반드시 지킬 것)

1. **`legacy/`·`engine/`·`public/` 무수정** — 계산 동일성의 근거. 신규 코드는 이들을 읽기만 한다
2. **`styles/tokens.css`가 유일한 스타일 상수 원천** — 컴포넌트 CSS에 색·크기 리터럴 하드코딩 금지
3. **색 원칙**: 텍스트·버튼 채움은 딥 계열만(`--text-*`, `--accent-primary/action`, `--color-pass/fail`). 밝은 틸 `--accent-graphic`은 포커스 링·게이지 등 **비텍스트 전용**
4. **파생값 미저장** — 계산 결과·판정·뷰 상태는 프로젝트 데이터에 쓰지 않고 매번 계산한다
5. **판정 로직 중복 정의 금지** — 필수값 검사는 `canCalculate`, 규모등급은 `calc규모등급`을 재사용

## 데이터 흐름

```
Input1 (사업정보)  ──→  Output1 (예상에너지사용량)  ──→  Output2 (설치비율·판정)
Input2 (시나리오)  ──────────────────────────────────↗
Input3 (최적화 입력) ──→ Optimizer (조합 탐색) ──→ AI 추천/설명
                                                   ↓
                                        보고서 (검토의견·PDF/Word/HTML)
```

- 저장: `localStorage` 키 `rp.projects.v1` — **`lib/projectStore.js`만이 이 키를 소유**한다
- 프로젝트 데이터: `{ id, name, createdAt, updatedAt, data: { input1, input2, input3, review, coverImage, optMemos, optExplains, aiRecommend, aiConstraints } }`
- 구버전(`projects_v2`)은 `lib/migrateLegacy.js`로 가져오기만 하고 원본은 보존

## 핵심 라이브러리 (`public/data/`, `window.LIB_*` 전역)

| 라이브러리 | 전역변수 | 용도 |
|-----------|---------|------|
| 신재생에너지계수 | `LIB_신재생에너지계수` | 에너지원별 단위생산량·보정계수 |
| 지역계수 | `LIB_지역계수` | 17개 시도 보정계수 |
| 건축물종류별 단위에너지사용량 | `LIB_단위에너지사용량` | 용도별 단위에너지사용량 |
| 의무비율 | `LIB_의무비율` | 사업형태/지역/규모등급/연도별 의무비율 |
| 설비최적화 | `LIB_설비최적화` | 조합 탐색 후보 설비(형식·세부형식·비용·정성등급) |

그 외 건물적합도·요구도·제약가중치·경관계수·전력원단위 라이브러리가 최적화에 쓰인다.
엔진 사용 컴포넌트는 반드시 `useEngineReady()` 훅을 경유한다(스크립트 로드 + 캐시 초기화 포함).

## 환경변수 (서버 — Vercel에 등록)

| 변수 | 용도 |
|------|------|
| `GEMINI_API_KEY` | AI 검토의견·조합 추천 |
| `NCP_CLIENT_ID` / `NCP_CLIENT_SECRET` | 지오코딩·역지오코딩 (서버) |
| `NEXT_PUBLIC_NCP_CLIENT_ID` | 지도 SDK (클라이언트) |
| `JUSO_CONFIRM_KEY` | 도로명주소 검색 — **개발용 승인키는 3개월 만료**, 만료 시 토지정보 조회 실패 |
| `DATA_GO_KR_KEY` | 건축물대장 조회 |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | 프리뷰 보호 우회 (E2E·Lighthouse용, `.env.local`) |

## 변경 시 게이트

1. `npm test` 전부 통과 (`tests/tokensContrast.test.mjs`가 토큰 대비 WCAG AA를 상시 검사)
2. 브랜치 푸시 → Vercel Preview → `node verify/e2e_redesign.mjs <프리뷰URL>` → `PASS`
   - 프리뷰 도메인은 `gh api repos/jlaw080-ops/Renewable-Proposal/commits/<sha>/check-runs --jq '.check_runs[].output.summary'`에서 추출(브랜치명이 길면 해시 별칭)
3. 화면 변경 시 스크린샷 육안 검토(1440·375px 최소)
4. main 머지는 사용자 승인 후 `--no-ff`

## 반복된 함정 (같은 실수 3회 이상)

- **그리드에 select/input을 넣으면 `minmax(0, 1fr)`** — `1fr`만 쓰면 긴 옵션 텍스트가 고유 최소폭을 만들어 옆 칸을 레이아웃 밖으로 밀어낸다 (`.se__row`·`.lp__search`에서 반복 발생)
- **`runCalculation`은 async** (`engine/index.js`) — `await` 없이 쓰면 `output2`가 undefined가 되어 조용히 실패한다
- **React `autoFocus`는 DOM에 `autofocus` 속성을 남기지 않는다** — `[autofocus]` 선택자로 못 잡음
- **`useEffect` 의존성에 인라인 핸들러(`onClose={() => …}`)를 넣으면** 렌더마다 재실행된다 — ref로 최신값을 잡고 의존성에서 제외
- **모바일 column 플렉스에서 `margin-inline: auto`** 는 stretch를 해제해 shrink-to-fit 오버플로를 만든다 — `width: 100%` 병기
- **CDN 스크립트에 SRI를 쓸 땐 버전 고정** — 플로팅 버전(`@latest`)에 SRI를 걸면 해시 불일치로 로드 실패

## 진행 이력

설계·계획 문서는 `docs/superpowers/{specs,plans}/`에 날짜별로 있다.
Next.js 전면 개편(Phase 0~6) → Technical Teal 디자인 개편 → UX 개선 5건 → 실사용 버그 수정 순으로 진행됐다.
