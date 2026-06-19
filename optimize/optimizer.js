// optimize/optimizer.js
// 신재생에너지 설비조합 최적화 엔진 — 개발기획서 §6
// 2단계 분해: 조합 생성(외부) + 용량 LP(내부) + 필터링 + 가중합 순위화
//
// 의존성: vendor/javascript-lp-solver.js (window.solver), data/설비최적화라이브러리.js
//        (window.LIB_설비최적화), optimize/targetCalculator.js (window.TargetCalculator)
// IIFE 전역 패턴. window.Optimizer 노출.
//
// 설계 결정(개발기획서 검토 반영):
//   C1 — 연료전지 정수용량 외부화: 대용량 연료전지(PAFC 440·SOFC발전 300 kW/기)는
//        "기수(0/1/2기)"를 조합 후보로 전개, 1종 배타. 소용량(PEMFC 10)·모듈러(SOFC건물)는
//        연속 LP 변수로 근사(설치 시 반올림). PV는 3종 중 택1(+없음).
//   C2 — 내부 LP는 초기비용 최소화(min Σⓓ·C)로 용량 결정. 정성·순익 trade-off는 조합 평가에서.
//   H3 — 가중치: 요구도(높음3/보통2/낮음1) → 합=1 정규화.
//   H4 — min-max 정규화 분모 0 가드(전 조합 동일값이면 중립 1.0).
(function () {
  "use strict";

  var MAX_연료전지기수 = 2;   // C1: 대용량 연료전지 최대 기수
  var BIG면적 = 1e12;         // 면적 제약 미입력 시 사실상 무제한

  function getSolver() {
    if (typeof window !== "undefined" && window.solver) return window.solver;
    return null;
  }
  function getLib() {
    return (typeof window !== "undefined" && window.LIB_설비최적화) || [];
  }
  function getTC() {
    return (typeof window !== "undefined" && window.TargetCalculator) || null;
  }

  function find설비(세부형식) {
    return getLib().filter(function (s) { return s.세부형식 === 세부형식; })[0] || null;
  }

  // ── 조합 생성 (§6.2[1]) ─────────────────────────────────────────
  // 반환: [{ label, 연속설비:[설비...], 고정설비:[{설비, 기수, 용량}...] }]
  // 전력목표=false(전력생산비율 기준·예상소비량 미설정)이면 발전용 연료전지를 제외한다.
  // 발전용(PAFC·SOFC발전)은 전력 생산이 주 용도이므로 전력 목표가 없으면 불필요하며,
  // 이를 제외해야 지열 등 비발전 설비가 공정하게 검토된다.
  function generateCombinations(전력목표) {
    var lib = getLib();
    var PV옵션 = [null, "고정식(수평)PV", "고정식(수직)BAPV", "BIPV"];
    var 지열 = find설비("수직밀폐형");
    var PEMFC = find설비("PEMFC(건물용)");
    var SOFC건물 = find설비("SOFC(건물용)");
    var 대용량연료전지 = 전력목표 ? ["PAFC(발전용)", "SOFC(발전용)"] : []; // 기수 전개·배타

    // 대용량 연료전지 분기: 없음 + (각 종류 × 1~MAX기)
    var 연료전지분기 = [{ label: "연료전지無", 고정: [] }];
    대용량연료전지.forEach(function (name) {
      var s = find설비(name);
      if (!s) return;
      for (var k = 1; k <= MAX_연료전지기수; k++) {
        연료전지분기.push({
          label: name + "×" + k + "기",
          고정: [{ 설비: s, 기수: k, 용량: s.단위용량 * k }]
        });
      }
    });

    var combos = [];
    PV옵션.forEach(function (pvName) {
      var pv = pvName ? find설비(pvName) : null;
      연료전지분기.forEach(function (fc) {
        // 연속설비: 선택된 PV + 지열 + PEMFC + SOFC건물용 (항상 LP 후보, LP가 0이면 미채택)
        var 연속 = [];
        if (pv) 연속.push(pv);
        if (지열) 연속.push(지열);
        if (PEMFC) 연속.push(PEMFC);
        if (SOFC건물) 연속.push(SOFC건물);
        combos.push({
          label: (pvName || "PV無") + " + " + fc.label,
          연속설비: 연속,
          고정설비: fc.고정
        });
      });
    });
    return combos;
  }

  // 연속 LP 결과를 단위용량(스냅단위)의 정수배수로 스냅한다.
  // 의무 충족 유지를 위해 결과 이상의 최소 배수(올림)를, 단위 중 최소 초과가 되는 것으로 선택.
  function snapToUnit(c, units) {
    if (!units || !units.length) return { 용량: c, 단위: null, 기수: null };
    var best = null;
    units.forEach(function (u) {
      var k = Math.max(1, Math.ceil(c / u - 1e-9));
      var v = k * u;
      if (!best || v < best.용량) best = { 용량: v, 단위: u, 기수: k };
    });
    return best;
  }

  // ── 용량 LP (§6.2[2]) ───────────────────────────────────────────
  // 고정설비(연료전지 기수) 기여를 제약 우변에서 차감한 잔여 제약으로 연속설비 용량을 푼다.
  // ctx: { 연간단위에너지소요량, 의무설치비율기준, 연간예상전력소비량, 전력생산비율기준, 면적{} }
  function solveCapacity(combo, ctx) {
    var solver = getSolver();
    if (!solver) throw new Error("LP 솔버(window.solver) 미로드");

    var 면적 = ctx.면적 || {};
    var 의무에너지총량 = (ctx.연간단위에너지소요량 || 0) * (ctx.의무설치비율기준 || 0) / 100;
    var 의무전력총량 = (ctx.연간예상전력소비량 > 0 && ctx.전력생산비율기준 != null)
      ? ctx.연간예상전력소비량 * ctx.전력생산비율기준 / 100 : 0;

    // 고정설비 기여 차감
    var 고정에너지 = 0, 고정전력 = 0, 고정면적 = { 옥상: 0, 외피: 0, 대지: 0, 기계실: 0 };
    combo.고정설비.forEach(function (f) {
      고정에너지 += f.설비.c_연간단위에너지생산량 * f.용량;
      if (f.설비.발전가능) 고정전력 += f.설비.f_연간발전량 * f.용량;
      고정면적[f.설비.설치공간] += f.설비.m_설치면적 * f.용량;
    });

    var 잔여에너지 = Math.max(0, 의무에너지총량 - 고정에너지);
    var 잔여전력 = Math.max(0, 의무전력총량 - 고정전력);

    // LP 모델 구성 (비용최소). 서울 지열 의무 적용 시 지열 최소 설치량 제약을 추가한다.
    //   옵션1(면적):   지열 설치면적 ≥ 건축면적(지하개발면적 가정) × 비율%
    //   옵션2(생산량): 지열 생산량 ≥ 신재생 의무생산량 × 비율%
    var 지열제약 = ctx.지열제약 || null;
    var 지열생산하한 = 0, 지열면적하한 = 0;
    if (지열제약) {
      if (지열제약.모드 === "생산량") 지열생산하한 = 의무에너지총량 * (지열제약.비율 || 0) / 100;
      else if (지열제약.모드 === "면적") 지열면적하한 = (지열제약.건축면적 || 0) * (지열제약.비율 || 0) / 100;
    }
    var variables = {};
    combo.연속설비.forEach(function (s, idx) {
      var v = {
        cost: s.d_장비비,
        e_energy: s.c_연간단위에너지생산량,
        e_power: s.발전가능 ? s.f_연간발전량 : 0
      };
      v["a_" + s.설치공간] = s.m_설치면적;
      if (s.형식 === "지열") {
        if (지열생산하한 > 0) v.geo = s.c_연간단위에너지생산량;
        if (지열면적하한 > 0) v.geoArea = s.m_설치면적;
      }
      variables["v" + idx] = v;
    });

    var constraints = { e_energy: { min: 잔여에너지 } };
    if (의무전력총량 > 0) constraints.e_power = { min: 잔여전력 };
    if (지열생산하한 > 0) constraints.geo = { min: 지열생산하한 };       // 지열 의무 옵션2(생산량)
    if (지열면적하한 > 0) constraints.geoArea = { min: 지열면적하한 };   // 지열 의무 옵션1(면적)
    // 공간별 잔여 면적 제약
    ["옥상", "외피", "대지", "기계실"].forEach(function (sp) {
      var cap = (면적[sp] != null ? 면적[sp] : BIG면적) - (고정면적[sp] || 0);
      constraints["a_" + sp] = { max: Math.max(0, cap) };
    });

    var model = {
      optimize: "cost", opType: "min",
      constraints: constraints, variables: variables
    };

    var res = solver.Solve(model);
    if (!res || !res.feasible) return null;

    // 결과 → items (연속 + 고정)
    var items = [];
    combo.연속설비.forEach(function (s, idx) {
      var c = res["v" + idx] || 0;
      if (c > 1e-6) {
        var snap = snapToUnit(c, s.스냅단위);
        items.push({ 설비: s, 용량: snap.용량, 단위: snap.단위, 단위기수: snap.기수, 고정: false });
      }
    });
    combo.고정설비.forEach(function (f) {
      items.push({ 설비: f.설비, 용량: f.용량, 고정: true, 기수: f.기수 });
    });
    if (items.length === 0) return null;
    return { items: items, 초기비용_LP: res.result };
  }

  // ── 가중치 도출 (H3) ────────────────────────────────────────────
  // 요구도: { 초기비용, 운영비, 인센티브, 디자인, 시공성, 의무근접 } 각 "높음"|"보통"|"낮음"
  // → 점수 3/2/1, 합=1 정규화
  function deriveWeights(요구도) {
    요구도 = 요구도 || {};
    var map = { "높음": 3, "보통": 2, "낮음": 1 };
    var keys = ["초기비용", "운영비", "인센티브", "디자인", "시공성", "의무근접"];
    var raw = {}, sum = 0;
    keys.forEach(function (k) {
      var v = map[요구도[k]] != null ? map[요구도[k]] : 2; // 미지정은 보통
      raw[k] = v; sum += v;
    });
    var w = {};
    keys.forEach(function (k) { w[k] = sum > 0 ? raw[k] / sum : 1 / keys.length; });
    return w;
  }

  // min-max 정규화 (H4 가드). 방향: 'max'=클수록좋음, 'min'=작을수록좋음
  function normalize(values, dir) {
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = max - min;
    return values.map(function (v) {
      if (span === 0) return 1.0;                 // 전 조합 동일 → 중립
      var n = (v - min) / span;
      return dir === "min" ? 1 - n : n;
    });
  }

  function _assign(base, extra) {
    var o = {};
    for (var k in base) if (base.hasOwnProperty(k)) o[k] = base[k];
    for (var k2 in extra) if (extra.hasOwnProperty(k2)) o[k2] = extra[k2];
    return o;
  }

  // ── 메인 최적화 (§6.2 전체) ─────────────────────────────────────
  // 지열 의무(비율>0)가 있으면 옵션1(면적: 건축면적×비율)·옵션2(생산량: 의무×비율)를
  // 각각 산출하고, 사용자 요구도 점수(rank1.score)가 높은 쪽을 추천한다 (서울 의무 "또는" 관계).
  function optimize(ctx) {
    ctx = ctx || {};
    if (ctx.지열의무 && ctx.지열의무.비율 > 0) {
      var rA = optimizeCore(_assign(ctx, { 지열제약: { 모드: "면적", 비율: ctx.지열의무.비율, 건축면적: ctx.지열의무.건축면적 } }));
      var rB = optimizeCore(_assign(ctx, { 지열제약: { 모드: "생산량", 비율: ctx.지열의무.비율 } }));
      var a1 = rA.ranked[0], b1 = rB.ranked[0];
      var 추천 = (!a1 && !b1) ? null : (!a1) ? "옵션2" : (!b1) ? "옵션1" : (a1.score >= b1.score ? "옵션1" : "옵션2");
      var main = (추천 === "옵션2") ? rB : rA;
      return _assign(main, { 지열옵션비교: { 추천: 추천, 옵션1: rA, 옵션2: rB } });
    }
    return optimizeCore(ctx);
  }

  // 반환: { ranked: [{label, items, targets, score, ...}], 평가건수, 실행가능건수 }
  function optimizeCore(ctx) {
    var TC = getTC();
    if (!TC) throw new Error("TargetCalculator 미로드");
    ctx = ctx || {};

    // 전력 목표(전력생산비율 기준 + 예상소비량)가 있을 때만 발전용 연료전지를 후보에 포함
    var 전력목표 = (ctx.연간예상전력소비량 > 0 && ctx.전력생산비율기준 != null);
    var combos = generateCombinations(전력목표);
    var feasible = [];

    combos.forEach(function (combo) {
      var cap = solveCapacity(combo, ctx);          // [2] 용량 LP
      if (!cap) return;                              // [3] 필터링(infeasible 제거)
      var targets = TC.평가조합(cap.items, ctx);     // §5 목표값
      // 법적규제 재검증(LP는 잔여 기준이므로 전체 재확인)
      // 법적규제 재검증. LP는 잔여기준으로 충족시키지만 부동소수 오차로 경계해(예 9.9999%)가
      // 탈락하지 않도록 허용오차(eps)를 둔다 — LP 제약을 만족한 해는 정당하다.
      var reg = targets.법적규제;
      var eps = 1e-6;
      if (ctx.의무설치비율기준 != null && reg.의무설치비율 < ctx.의무설치비율기준 - eps) return;
      if (reg.전력생산비율 != null && ctx.전력생산비율기준 != null
        && reg.전력생산비율 < ctx.전력생산비율기준 - eps) return;
      // 단위배수 스냅으로 면적이 늘어 제약을 초과할 수 있으므로 재검증
      var 면적c = ctx.면적 || {};
      var 면적ok = ["옥상", "외피", "대지", "기계실"].every(function (sp) {
        return 면적c[sp] == null || targets.설치면적[sp] <= 면적c[sp] + 1e-6;
      });
      if (!면적ok) return;
      // label을 실제 채택 items 기준으로 재생성 (LP가 0으로 둔 설비는 제외됨)
      var label = cap.items.map(function (it) {
        return it.설비.세부형식 + (it.고정 ? "×" + it.기수 + "기" : " " + Math.round(it.용량) + "kW");
      }).join(" + ");
      feasible.push({ label: label, items: cap.items, targets: targets });
    });

    // 중복 해 제거: LP가 연속변수를 0으로 만들어 실질적으로 동일해진 조합 통합
    var seen = {}, deduped = [];
    feasible.forEach(function (f) {
      var key = f.items.map(function (it) {
        return it.설비.세부형식 + ":" + Math.round(it.용량);
      }).sort().join("|");
      if (!seen[key]) { seen[key] = true; deduped.push(f); }
    });
    feasible = deduped;

    if (feasible.length === 0) {
      return { ranked: [], 평가건수: combos.length, 실행가능건수: 0 };
    }

    // [4] 목적함수 정규화 + 가중합 (§6.2[4])
    var w = deriveWeights(ctx.요구도);
    var 초기비용 = feasible.map(function (f) { return f.targets.초기비용; });
    var 운영순익 = feasible.map(function (f) { return f.targets.운영순익; });
    var 인센티브 = feasible.map(function (f) { return f.targets.정성.인센티브; });
    var 디자인 = feasible.map(function (f) { return f.targets.정성.디자인; });
    var 시공성 = feasible.map(function (f) { return f.targets.정성.시공성; });

    // 비용·순익은 절대범위가 가변 → 조합집합 min-max 정규화
    var n초기 = normalize(초기비용, "min");
    var n운영 = normalize(운영순익, "max");
    // 정성 지표(ⓝ~ⓡ 등급점수, 1~5 고정범위)는 고정척도 (점수−1)/4 로 정규화한다.
    // min-max를 쓰면 미미한 raw 차이(예: 3.06 vs 5.00)가 0↔1로 양극화되어 의미가 왜곡됨.
    var 고정척도 = function (v) { return (v - 1) / 4; };
    var n인센 = 인센티브.map(고정척도);
    var n디자 = 디자인.map(고정척도);
    var n시공 = 시공성.map(고정척도);
    // 의무비율 근접도 = 의무기준 / 실제비율 (딱 맞으면 1.0, 과충족일수록 0에 근접). 고정척도(0~1).
    var n근접 = feasible.map(function (f) {
      var 실제 = f.targets.법적규제.의무설치비율;
      if (ctx.의무설치비율기준 == null || !(실제 > 0)) return 1;
      return Math.min(1, ctx.의무설치비율기준 / 실제);
    });

    feasible.forEach(function (f, i) {
      f.정규화 = { 초기비용: n초기[i], 운영순익: n운영[i], 인센티브: n인센[i], 디자인: n디자[i], 시공성: n시공[i], 의무근접: n근접[i] };
      f.score = w.초기비용 * n초기[i] + w.운영비 * n운영[i] + w.인센티브 * n인센[i]
        + w.디자인 * n디자[i] + w.시공성 * n시공[i] + w.의무근접 * n근접[i];
    });

    // [5] 순위화
    var ranked = feasible.slice().sort(function (a, b) { return b.score - a.score; });
    ranked.forEach(function (f, i) { f.rank = i + 1; });

    return {
      ranked: ranked,
      평가건수: combos.length,
      실행가능건수: feasible.length,
      가중치: w
    };
  }

  window.Optimizer = {
    generateCombinations: generateCombinations,
    solveCapacity: solveCapacity,
    snapToUnit: snapToUnit,
    deriveWeights: deriveWeights,
    normalize: normalize,
    optimize: optimize
  };
})();
