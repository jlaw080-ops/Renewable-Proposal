// lib/comboView.js — 최적화 조합 표/카드 뷰의 정렬·필터·요약 (순수 함수, 엔진 출력 읽기 전용)

export const SORT_KEYS = [
  { key: "score", label: "종합점수", dir: "desc", get: c => c.score },
  { key: "초기비용", label: "초기비용", dir: "asc", get: c => c.targets?.초기비용 },
  { key: "운영순익", label: "연간순익", dir: "desc", get: c => c.targets?.운영순익 },
  { key: "의무비율", label: "의무비율", dir: "desc", get: c => c.targets?.법적규제?.의무설치비율 },
  { key: "면적이용", label: "면적이용", dir: "desc", get: c => c.면적이용률 },
];

const getter = key => (SORT_KEYS.find(s => s.key === key) ?? SORT_KEYS[0]).get;

// 정렬 — 새 배열 반환. null/undefined는 방향과 무관하게 뒤로 보낸다(빈 값이 상단을 차지하지 않도록)
export function sortCombos(list = [], key = "score", dir = "desc") {
  const get = getter(key);
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const va = get(a), vb = get(b);
    const na = va === null || va === undefined || Number.isNaN(va);
    const nb = vb === null || vb === undefined || Number.isNaN(vb);
    if (na && nb) return 0;
    if (na) return 1;
    if (nb) return -1;
    return (va - vb) * sign;
  });
}

// 결과에 등장하는 에너지원 대분류(설비.형식) — 등장 순서 유지·중복 제거
export function energySources(list = []) {
  const seen = [];
  for (const c of list) {
    for (const it of c.items ?? []) {
      const f = it.설비?.형식;
      if (f && !seen.includes(f)) seen.push(f);
    }
  }
  return seen;
}

// 필터 — 의무충족만(불리언) AND 에너지원 포함(체크 항목 간 OR). 새 배열 반환
export function filterCombos(list = [], { 의무충족만 = false, sources = [] } = {}) {
  return list.filter(c => {
    if (의무충족만 && c.targets?.법적규제?.의무설치비율_충족 !== true) return false;
    if (sources.length > 0) {
      const has = (c.items ?? []).some(it => sources.includes(it.설비?.형식));
      if (!has) return false;
    }
    return true;
  });
}

// 설비 구성 요약 — 2개까지 나열, 초과는 "외 N개"
export function comboSummary(combo) {
  const items = combo?.items ?? [];
  if (items.length === 0) return "-";
  const part = items.slice(0, 2)
    .map(it => `${it.설비?.세부형식 ?? "-"} ${Math.round(it.용량 ?? 0)}kW`)
    .join(" · ");
  return items.length > 2 ? `${part} 외 ${items.length - 2}개` : part;
}
