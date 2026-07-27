// 시도/시군구 → 의무비율 지역 판정 — legacy map/addressSearch.js의 검증된 매핑 이식 (순수 함수)
export const REGION_OPTIONS = [
  "강원 영동", "강원 영서", "경기도", "경상남도", "경상북도",
  "광주광역시", "대구광역시", "대전광역시", "부산광역시", "서울특별시",
  "울산광역시", "인천광역시", "전라남도", "전라북도", "제주특별자치도",
  "충청남도·세종특별자치시", "충청북도",
];

const 시도매핑 = {
  "서울": "서울특별시", "서울특별시": "서울특별시", "서울시": "서울특별시",
  "부산": "부산광역시", "부산광역시": "부산광역시",
  "대구": "대구광역시", "대구광역시": "대구광역시",
  "인천": "인천광역시", "인천광역시": "인천광역시",
  "광주": "광주광역시", "광주광역시": "광주광역시",
  "대전": "대전광역시", "대전광역시": "대전광역시",
  "울산": "울산광역시", "울산광역시": "울산광역시",
  "세종": "충청남도·세종특별자치시", "세종특별자치시": "충청남도·세종특별자치시",
  "경기": "경기도", "경기도": "경기도",
  "강원": "강원 영서", "강원도": "강원 영서", "강원특별자치도": "강원 영서",
  "충북": "충청북도", "충청북도": "충청북도",
  "충남": "충청남도·세종특별자치시", "충청남도": "충청남도·세종특별자치시",
  "전북": "전라북도", "전라북도": "전라북도", "전북특별자치도": "전라북도",
  "전남": "전라남도", "전라남도": "전라남도",
  "경북": "경상북도", "경상북도": "경상북도",
  "경남": "경상남도", "경상남도": "경상남도",
  "제주": "제주특별자치도", "제주특별자치도": "제주특별자치도", "제주도": "제주특별자치도",
};

const 강원영동_시군 = ["강릉시", "동해시", "삼척시", "속초시", "양양군", "고성군", "태백시"];

export function resolveRegion(sido, sigungu = "") {
  if (!sido) return null;
  if (sido.includes("강원")) {
    return 강원영동_시군.some(s => sigungu.includes(s)) ? "강원 영동" : "강원 영서";
  }
  if (sido.includes("세종")) return "충청남도·세종특별자치시";
  return 시도매핑[sido] ?? null;
}

export function regionFromNaverElements(addressElements = []) {
  let sido = "", sigungu = "";
  for (const el of addressElements) {
    const types = el.types ?? [];
    if (types.includes("SIDO")) sido = el.longName;
    if (types.includes("SIGUGUN")) sigungu = el.longName;
  }
  return resolveRegion(sido, sigungu);
}

export function regionFromReverseGeocode(results = []) {
  const r = results[0];
  if (!r?.region) return { region: null, address: "" };
  const parts = [r.region.area1?.name, r.region.area2?.name, r.region.area3?.name, r.region.area4?.name]
    .filter(Boolean).filter(s => s.trim() !== "");
  return {
    region: resolveRegion(r.region.area1?.name ?? "", r.region.area2?.name ?? ""),
    address: parts.join(" "),
  };
}
