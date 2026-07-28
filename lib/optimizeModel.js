// 최적화 입력 모델 — legacy public/optimize/optimizeUI.js 검증 로직의 순수 함수 이식 (엔진 ctx 계약 유지)

export const LEVELS = ["매우높음", "높음", "보통", "낮음", "매우낮음"];

export const 요구도항목 = [
  { key: "초기비용", label: "초기비용 절감" },
  { key: "운영비", label: "운영비 절감" },
  { key: "인센티브", label: "인센티브 확보" },
  { key: "디자인", label: "디자인 보존" },
  { key: "시공성", label: "시공 용이성" },
  { key: "의무근접", label: "의무비율 근접", default: "높음" },
  { key: "법규제약", label: "법적심의 적합성" },
  { key: "건물적합", label: "건물유형 적합성" },
];

const 기본요구도 = () => Object.fromEntries(요구도항목.map(i => [i.key, i.default ?? "보통"]));

export const EMPTY_INPUT3 = {
  건물유형: "", 지열의무비율: "", 전력생산비율기준: "",
  면적비율: {
    옥상: { min: "", max: "" }, 외피: { min: "", max: "" },
    대지: { min: "", max: "" }, 기계실: { pct: "" },
  },
  요구도: 기본요구도(),
};

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = v => (v === "" || v === null || v === undefined ? null : Number(v));

// 예상 외피(입면) 면적 = 4·√건축면적 × (연면적/건축면적) × 층고 (정사각형 평면 가정)
export function 외피면적(건축, 연면적, 층고 = 3.5) {
  if (!(건축 > 0) || !(연면적 > 0)) return 0;
  return 4 * Math.sqrt(건축) * (연면적 / 건축) * 층고;
}

export function getBaseAreas(input1 = {}, 층고 = 3.5) {
  const 건축 = num(input1.건축면적), 연 = num(input1.연면적), 대지 = num(input1.대지면적);
  return { 건축면적: 건축, 연면적: 연, 대지면적: 대지, 외피면적: 외피면적(건축, 연, 층고) };
}

export const AREA_RANGE_DEFAULT = { 옥상: { min: 20, max: 70 }, 대지: { min: 0, max: 50 } };
export const FACADE_RANGE_BY_TYPE = {
  "공동주택": { min: 10, max: 25 }, "주상복합": { min: 10, max: 25 },
  "사무실·업무시설": { min: 20, max: 60 }, "데이터센터": { min: 20, max: 60 },
  "상가": { min: 15, max: 30 },
};
export const FACADE_RANGE_FALLBACK = { min: 15, max: 30 };

export function facadeDefaultFor(건물유형) {
  return FACADE_RANGE_BY_TYPE[건물유형] ?? FACADE_RANGE_FALLBACK;
}

const fillIfEmpty = (r, d) => ({
  min: r.min === "" ? d.min : r.min,
  max: r.max === "" ? d.max : r.max,
});

export function withAreaDefaults(면적비율, 건물유형) {
  return {
    옥상: fillIfEmpty(면적비율.옥상, AREA_RANGE_DEFAULT.옥상),
    외피: fillIfEmpty(면적비율.외피, facadeDefaultFor(건물유형)),
    대지: fillIfEmpty(면적비율.대지, AREA_RANGE_DEFAULT.대지),
    기계실: { ...면적비율.기계실 },
  };
}

// 비율 → 가용면적. 옥상·외피·대지는 {min,max}(㎡), 기계실은 단일 cap. 미입력/기준0 → null(무제한)
export function collectAreaData(면적비율, base) {
  const baseOf = { 옥상: base.건축면적, 외피: base.외피면적, 대지: base.대지면적, 기계실: base.건축면적 };
  const 면적 = {}, 면적범위 = {};
  for (const sp of ["옥상", "외피", "대지"]) {
    const b = baseOf[sp], r = 면적비율[sp];
    const pmin0 = pct(r.min), pmax0 = pct(r.max);
    if (b > 0 && (pmin0 !== null || pmax0 !== null)) {
      const pmin = pmin0 !== null ? pmin0 : pmax0;   // 한쪽만 입력 시 점
      const pmax = pmax0 !== null ? pmax0 : pmin0;
      const lo = b * Math.min(pmin, pmax) / 100;
      const hi = b * Math.max(pmin, pmax) / 100;
      면적범위[sp] = { min: lo, max: hi };
      면적[sp] = hi;
    } else { 면적범위[sp] = null; 면적[sp] = null; }
  }
  const mp = pct(면적비율.기계실.pct);
  if (baseOf.기계실 > 0 && mp !== null) {
    const cap = baseOf.기계실 * mp / 100;
    면적["기계실"] = cap; 면적범위["기계실"] = { min: cap, max: cap };
  } else { 면적["기계실"] = null; 면적범위["기계실"] = null; }
  return { 면적, 면적범위 };
}

export function buildOptimizeCtx({ input1, input3, 총예상에너지사용량, 의무비율, 연간예상전력소비량, 지자체 }) {
  const base = getBaseAreas(input1);
  const ad = collectAreaData(input3.면적비율, base);
  const 지열비율 = pct(input3.지열의무비율);
  return {
    건물유형: input3.건물유형 || null,
    지자체: 지자체 || null,
    연간단위에너지소요량: 총예상에너지사용량 > 0 ? Math.round(총예상에너지사용량) : null,
    의무설치비율기준: 의무비율 ?? null,
    지열의무: 지열비율 > 0 ? { 비율: 지열비율, 건축면적: base.건축면적 } : null,
    연간예상전력소비량: 연간예상전력소비량 || 0,
    전력생산비율기준: pct(input3.전력생산비율기준),
    면적: ad.면적,
    면적범위: ad.면적범위,
    요구도: { ...input3.요구도 },
  };
}

// 건물유형별 표준 요구도 (LIB_요구도) — 시공성은 하위 4항목 평균 점수의 최근접 등급 (legacy 탐색 순서 유지)
export function autoRequirements(lib요구도, 사업형태, 건물유형,
  요구도점수 = { "매우높음": 5, "높음": 4, "보통": 3, "낮음": 2, "매우낮음": 1 }) {
  if (!Array.isArray(lib요구도) || !사업형태 || !건물유형) return null;
  const row = lib요구도.find(r => r.사업형태 === 사업형태 && r.건물유형 === 건물유형);
  if (!row) return null;
  const 가까운등급 = s => {
    let best = "보통", bd = Infinity;
    for (const lv of Object.keys(요구도점수)) {
      const d = Math.abs(요구도점수[lv] - s);
      if (d < bd) { bd = d; best = lv; }
    }
    return best;
  };
  const 하위 = [row.토지개발, row.기계실, row.공사기간, row.공사난이도]
    .map(g => 요구도점수[g]).filter(v => v != null);
  const 시공성 = 하위.length ? 가까운등급(하위.reduce((a, b) => a + b, 0) / 하위.length) : "보통";
  return { 초기비용: row.초기비용, 운영비: row.운영비, 인센티브: row.인센티브, 디자인: row.디자인, 시공성 };
}
