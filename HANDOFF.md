# HANDOFF — 네이버 지도 Geocoding API 주소 검색 교체

**작성일:** 2026-04-14  
**브랜치:** main  
**최신 커밋:** `8bc1b7e` fix: 네이버 Geocoding CORS 문제 해결 — 서버 프록시 방식으로 복원

---

## 현재 상태: 네이버 Geocoding API 401 에러 (미해결)

### 증상
- 주소 검색 시 `/api/geocode` 프록시가 네이버 API 호출 → **401 Permission Denied** 반환
- 에러 메시지: `"A subscription to the API is required."`
- curl 직접 호출로도 동일 에러 → Vercel 문제가 아닌 **NCP 인증 문제**

### 이미 확인한 것 (모두 정상)
- NCP Application **RenewableEnergy** 생성 완료
  - Client ID: `d87fjve0g5`
  - Client Secret: `NlAn2ZDbmlmqmXR0UXudDVqEzoHiRKPw0Kn0v0Oa`
- API 선택: **Dynamic Map ✓, Static Map ✓, Geocoding ✓** 모두 체크됨
- Web 서비스 URL: `https://renewable-proposal.vercel.app` 등록됨
- Vercel 환경변수 `NCP_CLIENT_ID`, `NCP_CLIENT_SECRET` 등록 완료
- Geocoding 서비스 구독 완료 (NCP 콘솔에서 확인)

### 시도해볼 것
1. **NCP 설정 반영 대기** — 신규 등록 후 시간이 필요할 수 있음 (몇 시간~하루)
2. **Client Secret 재발급** — NCP 콘솔 → Application → 인증 정보 → 재발급 후 Vercel 환경변수도 업데이트
3. **NCP 고객센터 문의** — 구독/Application 연결이 정상인데 401이면 계정 레벨 이슈 가능
4. **대안: Nominatim 복원** — 네이버가 해결 안 되면 이전 OpenStreetMap Nominatim으로 롤백 (커밋 `f3870de` 참조)

---

## 현재 아키텍처

```
브라우저 → /api/geocode?query=서울 → Vercel Edge Function → 네이버 Geocoding API
                                        (NCP_CLIENT_ID, NCP_CLIENT_SECRET 헤더 추가)
```

### 변경된 파일 (커밋 완료)

| 파일 | 내용 |
|------|------|
| `api/geocode.js` | 네이버 Geocoding API 서버 프록시 (Edge Runtime) |
| `map/kakaoMap.js` | `/api/geocode` fetch 호출, 네이버 응답 파싱, 지역 매핑 |
| `index.html` | SDK 스크립트 태그 제거 (서버 프록시 방식이므로 불필요) |

### map/kakaoMap.js 주요 로직
- `searchAddress()` → `fetch('/api/geocode?query=...')` 호출
- 네이버 응답의 `addresses[0]`에서:
  - `roadAddress` / `jibunAddress` → 주소 표시
  - `addressElements` → `SIDO`, `SIGUGUN` 타입 파싱 → 지역 매핑
- 강원 영동/영서, 세종·충남 구분 로직 유지
- `window.KakaoMapModule` 인터페이스 유지 (`init`, `search`, `getLocation`, `syncToForm`)

### api/geocode.js 동작
- GET `/api/geocode?query=검색어`
- `process.env.NCP_CLIENT_ID` / `NCP_CLIENT_SECRET` 읽어서 네이버 API에 헤더로 전달
- 네이버 응답을 그대로 JSON 반환 (CORS 헤더 추가)

---

## Vercel 환경변수

| Key | 용도 |
|-----|------|
| `GEMINI_API_KEY` | Google Gemini API (AI 검토) |
| `NCP_CLIENT_ID` | 네이버 클라우드 플랫폼 Client ID |
| `NCP_CLIENT_SECRET` | 네이버 클라우드 플랫폼 Client Secret |

---

## 롤백 방법 (Nominatim으로 복원 시)

```bash
git revert HEAD~2..HEAD   # 네이버 관련 커밋 2개 되돌리기
# 또는 f3870de 시점의 파일로 수동 복원:
git checkout f3870de -- map/kakaoMap.js index.html
git rm api/geocode.js
git commit -m "revert: 네이버 API → Nominatim 복원"
git push origin main
```

---

## 커밋 히스토리

| 커밋 | 내용 |
|------|------|
| `8bc1b7e` | fix: 네이버 Geocoding CORS 문제 해결 — 서버 프록시 방식으로 복원 |
| `d493da7` | feat: 네이버 Dynamic Map SDK로 주소 검색 교체 (CORS 문제로 롤백됨) |
| `3303de6` | feat: OpenStreetMap Nominatim → 네이버 지도 Geocoding API로 주소 검색 교체 |
| `f3870de` | feat: 카카오맵 SDK 제거, OpenStreetMap Nominatim 주소 검색으로 교체 |
