# 신재생에너지 의무설치비율 검토 도구

건축물의 신재생에너지 의무설치비율을 계산하고, AI 기반 검토 의견을 생성하는 브라우저 단일 페이지 웹앱.

## 기술 스택

- **프론트엔드**: Vanilla JS + HTML + CSS (프레임워크 없음)
- **AI 검토**: Google Gemini 2.5 Pro (SSE 스트리밍)
- **PDF 생성**: jsPDF + html2canvas (CDN)
- **Word 다운로드**: html-docx-js (CDN)
- **실행 환경**: `file://` 직접 열기 또는 VS Code Live Server

## 디렉토리 구조

```
index.html              메인 SPA (인라인 스크립트 포함, 전체 로직 내장)
style.css               메인 스타일시트
config.js               API 키 설정 (Gemini)
assets/logo.png         로고 이미지
data/                   라이브러리 데이터 (.js — window 전역변수 방식)
  ├── 신재생에너지계수라이브러리.js
  ├── 지역계수라이브러리.js
  ├── 건축물종류별단위에너지사용량라이브러리.js
  └── 의무비율라이브러리.js
engine/                 계산 엔진 (ES 모듈 — 서버 환경용)
  ├── index.js          진입점: runCalculation(input1, input2, 카테고리)
  ├── libraryLoader.js  4개 라이브러리 로드 + lookup 함수
  ├── output1Calculator.js  예상에너지사용량 계산
  └── output2Calculator.js  신재생에너지 설치비율 계산
review/                 AI 검토 기능
  ├── reviewGenerator.js    Gemini API SSE 스트리밍 검토결과 생성
  └── reviewPromptManager.js  검토 프롬프트 CRUD (localStorage)
report/                 보고서 출력
  ├── reportBuilder.js   리포트 HTML 문자열 생성
  ├── reportViewer.js    리포트 미리보기 모달
  ├── reportPdf.js       PDF 다운로드
  └── reportStyle.css    리포트 전용 스타일
```

## 데이터 흐름

```
Input1 (사업정보)  ──→  Output1 (예상에너지사용량)  ──→  Output2 (설치비율 계산)
Input2 (시나리오)  ──────────────────────────────────↗
                                                        ↓
                                            AI 검토의견 생성 (Gemini)
                                            리포트 출력 (PDF/Word/HTML)
```

### Input1 — 사업정보
사업형태, 사업연도, 대지위치, 연면적, 용도별 연면적 목록

### Input2 — 시나리오 정보
복수 ALT 시나리오, 각각 신재생에너지 시스템 구성 (에너지원, 형식, 적용용량)

### Output1 — 예상에너지사용량
`연면적 × 지역계수 × 단위에너지사용량` 으로 용도별 산출

### Output2 — 신재생에너지 설치비율
시나리오별 `생산량합계 / 총에너지사용량 × 100` 산출 → 의무비율 대비 만족 여부 판정

## 4개 라이브러리

| 라이브러리 | 전역변수 키 | 용도 |
|-----------|------------|------|
| 신재생에너지계수 | `LIB_신재생에너지계수` | 에너지원별 단위에너지생산량, 원별보정계수 |
| 지역계수 | `LIB_지역계수` | 17개 시도별 지역보정계수 |
| 건축물종류별 단위에너지사용량 | `LIB_단위에너지사용량` | 건물용도별 단위에너지사용량 |
| 의무비율 | `LIB_의무비율` | 사업형태/지역/주거구분/카테고리/연도별 의무비율 |

## 주요 기능

1. **사업정보 입력** — 사업형태, 연도, 대지위치, 용도별 연면적 (동적 행 추가)
2. **시나리오 설정** — 복수 ALT, 에너지원/형식 선택 시 계수 자동 반영
3. **자동 계산** — Output1 → Output2 순서 보장, 의무비율 충족 여부 판정
4. **AI 검토** — Gemini SSE 스트리밍으로 전문가 수준 검토 의견 생성
5. **프롬프트 관리** — 검토 프롬프트 커스터마이징 (localStorage CRUD)
6. **리포트 출력** — A4 보고서 미리보기 + PDF/Word/HTML 다운로드
7. **프로젝트 저장/불러오기** — localStorage 기반

## 코드 구조 참고

- `index.html`에 전체 로직이 인라인으로 내장됨 (file:// CORS 우회)
- `engine/`, `review/`, `report/` 모듈은 서버 환경(Live Server) ES 모듈 import용
- 라이브러리 데이터는 `data/*.js` → `window.LIB_*` 전역변수로 주입
- JSON 원본 파일(루트 `*.json`)은 참조/백업용

## 유의사항

- `config.js`에 Gemini API 키가 하드코딩되어 있음 — `.gitignore`에 추가 권장
- file:// 환경에서는 fetch 대신 window 전역변수 방식으로 라이브러리 로드
- 수정 시 `index.html` 인라인 코드와 모듈 파일 양쪽 동기화 필요
