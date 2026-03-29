/**
 * engine/libraryLoader.js
 *
 * 4개 라이브러리 JSON을 로드하고 lookup 함수를 제공합니다.
 *
 * [CORS 처리 — 방법 B: window 전역 변수 방식]
 * 로컬 file:// 환경에서 fetch가 CORS로 차단될 경우,
 * window 전역 변수(window.LIB_*)에서 데이터를 읽습니다.
 *
 * 사용법:
 *   방법 A(서버 환경): data/*.json 파일 그대로 사용 → fetch가 자동으로 읽음
 *   방법 B(로컬 file://): data/ 폴더의 JSON을 아래 형식의 .js 파일로 감싸서
 *     index.html의 <script> 태그로 먼저 로드하면 됩니다.
 *
 *     // data/신재생에너지계수라이브러리.js
 *     window.LIB_신재생에너지계수 = [ ...JSON 배열... ];
 *
 *     // data/지역계수라이브러리.js
 *     window.LIB_지역계수 = { ...JSON 객체... };
 *
 *     // data/건축물종류별단위에너지사용량라이브러리.js
 *     window.LIB_단위에너지사용량 = [ ...JSON 배열... ];
 *
 *     // data/의무비율라이브러리.js
 *     window.LIB_의무비율 = { ...JSON 객체... };
 */

// 로드된 라이브러리 캐시
let _신재생에너지계수 = null;   // 배열
let _지역계수 = null;           // 객체
let _단위에너지사용량 = null;   // 배열
let _의무비율 = null;           // 객체

// ── Input1 대지위치 옵션 → 라이브러리 키 매핑 ──────────────────────
const 대지위치매핑 = {
  '강원 영동':             '강원영동',
  '강원 영서':             '강원영서',
  '경기도':               '경기',
  '경상남도':             '경남',
  '경상북도':             '경북',
  '광주광역시':           '광주',
  '대구광역시':           '대구',
  '대전광역시':           '대전',
  '부산광역시':           '부산',
  '서울특별시':           '서울',
  '울산광역시':           '울산',
  '인천광역시':           '인천',
  '전라남도':             '전남',
  '전라북도':             '전북',
  '제주특별자치도':       '제주',
  '충청남도·세종특별자치시': '충남',
  '충청북도':             '충북',
};

/**
 * 단일 JSON 파일 fetch — CORS 실패 시 window 전역 변수 fallback
 * @param {string} filePath   fetch 경로 (예: 'data/신재생에너지계수라이브러리.json')
 * @param {string} windowKey  window 전역 변수 이름 (예: 'LIB_신재생에너지계수')
 */
async function loadOne(filePath, windowKey) {
  // 1순위: window 전역 변수 (방법 B — JS 파일로 미리 로드된 경우)
  if (window[windowKey] !== undefined) {
    console.log(`[libraryLoader] 전역변수 사용: window.${windowKey}`);
    return window[windowKey];
  }

  // 2순위: fetch
  try {
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    console.log(`[libraryLoader] fetch 성공: ${filePath} (${Array.isArray(data) ? data.length + '건' : Object.keys(data).length + '개 키'})`);
    return data;
  } catch (err) {
    throw new Error(
      `라이브러리 로드 실패: ${filePath}\n` +
      `원인: ${err.message}\n` +
      `해결: data/ 폴더에 JSON 파일을 복사하거나, ` +
      `window.${windowKey} = {...} 형태의 .js 파일을 index.html에 <script>로 추가하세요.`
    );
  }
}

/**
 * 앱 시작 시 4개 라이브러리를 모두 로드합니다.
 * 성공 시 true, 실패 시 에러를 throw합니다.
 */
export async function loadLibraries() {
  const [신재생, 지역, 단위, 의무] = await Promise.all([
    loadOne('data/신재생에너지계수라이브러리.json',              'LIB_신재생에너지계수'),
    loadOne('data/지역계수라이브러리.json',                     'LIB_지역계수'),
    loadOne('data/건축물종류별단위에너지사용량라이브러리.json',  'LIB_단위에너지사용량'),
    loadOne('data/의무비율라이브러리.json',                     'LIB_의무비율'),
  ]);

  _신재생에너지계수 = 신재생;
  _지역계수        = 지역;
  _단위에너지사용량 = 단위;
  _의무비율        = 의무;

  console.log('[libraryLoader] 모든 라이브러리 로드 완료');
  return true;
}

// ── 대지위치 정규화 ────────────────────────────────────────────────
/**
 * Input1 대지위치 옵션 텍스트 → 라이브러리 키로 변환
 * @param {string} input  예) "서울특별시"
 * @returns {string}      예) "서울"
 */
export function normalize대지위치(input) {
  return 대지위치매핑[input] ?? input;
}

// ── 지역계수 ──────────────────────────────────────────────────────
/**
 * @param {string} 대지위치  Input1 대지위치 옵션 텍스트
 * @returns {number}  지역계수 value (없으면 1.0)
 */
export function get지역계수(대지위치) {
  if (!_지역계수) return 1.0;
  const key = normalize대지위치(대지위치);
  return _지역계수[key]?.value ?? 1.0;
}

// ── 단위에너지사용량 ──────────────────────────────────────────────
/**
 * @param {string} 용도  예) "판매 및 영업시설"
 * @returns {number|null}
 */
export function get단위에너지사용량(용도) {
  if (!_단위에너지사용량) return null;
  const item = _단위에너지사용량.find(x => x['건축물 종류'] === 용도);
  return item ? item['단위에너지사용량'] : null;
}

// ── 신재생에너지 계수 ─────────────────────────────────────────────
/**
 * @param {string} 에너지원  예) "태양광"
 * @param {string} 형식      예) "태양광-고정식"
 * @returns {{ 단위에너지생산량: number, 원별보정계수: number } | null}
 */
export function get신재생에너지계수(에너지원, 형식) {
  if (!_신재생에너지계수) return null;
  const item = _신재생에너지계수.find(
    x => x['에너지원'] === 에너지원 && x['형식'] === 형식
  );
  if (!item) return null;
  return {
    단위에너지생산량: item['단위에너지생산량'],
    원별보정계수:     item['원별보정계수'],
  };
}

// ── 에너지원 목록 ─────────────────────────────────────────────────
/**
 * 라이브러리에서 고유 에너지원 목록을 추출합니다.
 * @returns {string[]}
 */
export function get에너지원목록() {
  if (!_신재생에너지계수) return [];
  return [...new Set(_신재생에너지계수.map(x => x['에너지원']))];
}

// ── 형식 목록 ─────────────────────────────────────────────────────
/**
 * 특정 에너지원의 형식 목록을 반환합니다.
 * @param {string} 에너지원
 * @returns {string[]}
 */
export function get형식목록(에너지원) {
  if (!_신재생에너지계수) return [];
  return _신재생에너지계수
    .filter(x => x['에너지원'] === 에너지원)
    .map(x => x['형식']);
}

// ── 주거구분 ──────────────────────────────────────────────────────
/**
 * '공동주택'만 '주거', 나머지는 '비주거'
 * @param {string} 용도
 * @returns {'주거'|'비주거'}
 */
export function get주거구분(용도) {
  return 용도 === '공동주택' ? '주거' : '비주거';
}

// ── 의무비율 ──────────────────────────────────────────────────────
/**
 * 의무비율을 라이브러리에서 조회합니다.
 * - 사업형태 '공공' → 키 "공공" 사용
 * - 사업형태 '민간' → "{지역}{주거구분}{카테고리}" 키 사용
 * @returns {number|null}  숫자가 아닌 값("자율", "")이거나 키 없으면 null
 */
export function get의무비율(사업형태, 대지위치, 주거구분, 카테고리, 사업연도) {
  if (!_의무비율) return null;

  let entry;
  if (사업형태 === '공공') {
    entry = _의무비율['공공'];
  } else {
    const 지역키 = normalize대지위치(대지위치);
    const 복합키 = `${지역키}${주거구분}${카테고리}`;
    entry = _의무비율[복합키];
  }

  if (!entry) return null;

  const value = entry[String(사업연도)];
  if (value === undefined || value === '' || value === '자율') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

// ── 건물용도 목록 (select 옵션용) ─────────────────────────────────
export function get용도목록() {
  if (!_단위에너지사용량) return [];
  return _단위에너지사용량.map(x => x['건축물 종류']);
}
