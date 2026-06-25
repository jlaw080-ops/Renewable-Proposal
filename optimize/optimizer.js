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
//        연속 LP 변수로 근사(설치 시 반올림). PV는 옥상형(수평) × 외피형(BAPV·BIPV) 조합
//        — 옥상 PV와 외피 BIPV는 설치공간이 달라 동시 설치 가능(예: 옥상 PV + 외피 BIPV).
//   C2 — 내부 LP는 초기비용 최소화(min Σⓓ·C)로 용량 결정. 정성·순익 trade-off는 조합 평가에서.
//   H3 — 가중치: 요구도(높음3/보통2/낮음1) → 합=1 정규화.
//   H4 — min-max 정규화 분모 0 가드(전 조합 동일값이면 중립 1.0).
(function () {
  "use strict";

  var BIG면적 = 1e12;         // 면적 제약 미입력 시 사실상 무제한
  // 설정값(window.OPT_CONFIG, settings/settingsStore.js)을 호출 시점에 읽는다. 미로드 시 기본값.
  function cfg() { return (typeof window !== "undefined" && window.OPT_CONFIG) || {}; }
  function MAX_연료전지기수() { var v = cfg().연료전지최대기수; return (v > 0) ? v : 2; }

  // 의무근접 요구도 등급 → 최종 의무설치비율의 기준 대비 허용 상한(%p). null/미설정 = 무제한(Infinity).
  //   '매우높음'이면 0.5%p 이내로 밀착(기준 ≤ 실제 ≤ 기준+0.5). 하위 등급은 점증 완화.
  //   하한은 법적 의무라 항상 기준 이상(별도 게이트)이므로 상한 밴드만 적용한다.
  var 기본근접밴드 = { "매우높음": 0.5, "높음": 1.5, "보통": 3.0, "낮음": 6.0, "매우낮음": null };
  function 의무근접상한(ctx) {
    var 등급 = (ctx && ctx.요구도 && ctx.요구도.의무근접) || "보통";
    var 맵 = cfg().의무근접허용오차 || 기본근접밴드;
    var v = 맵.hasOwnProperty(등급) ? 맵[등급] : (맵["보통"] != null ? 맵["보통"] : 3.0);
    return (v == null) ? Infinity : v;
  }

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

  // 건물유형 적합성이 「매우낮음」인 에너지원은 추천 조합에서 완전 배제한다(후보 풀에서 제거).
  //   OPT_CONFIG.적합매우낮음제외=false 또는 건물적합도사용=false 또는 건물유형 미선택 시 비활성(배제 안 함).
  function 적합제외(세부형식, ctx) {
    if (cfg().적합매우낮음제외 === false) return false;
    if (cfg().건물적합도사용 === false) return false;
    if (!ctx || !ctx.건물유형) return false;
    var TC = getTC();
    if (!TC || !TC.건물적합등급_설비) return false;
    return TC.건물적합등급_설비(ctx.건물유형, 세부형식) === "매우낮음";
  }

  // ── 조합 생성 (§6.2[1]) ─────────────────────────────────────────
  // 반환: [{ label, 연속설비:[설비...], 고정설비:[{설비, 기수, 용량}...] }]
  //
  // 정책:
  //  · 발전용 포함 게이트 — 전력목표(전력생산비율 기준+예상소비량)가 있거나,
  //    건물적합도(LIB_건물적합도)에서 해당 건물유형의 발전용 적합 등급이 「높음」 이상이면 포함.
  //  · 연료전지 1계열만 — 한 조합에 발전용 FC와 건물용 FC를 함께 넣지 않는다.
  //    발전용 분기에는 건물용 FC를 빼고 지열만 연속 후보로 둔다(태양광은 PV옵션에서 별도 결합).
  //  · 발전용 기수는 의무 기준 — 의무를 1기 단위로 딱 못 맞추면(잔여 < 1기)
  //    n_ceil(라운드업: 발전용 단독으로 의무 초과 충족)과 n_floor(≥1, 부족분을 태양광·지열로
  //    충당하는 조합용) 두 후보를 만든다. 의무 미상이면 1~최대기수 폴백.
  function generateCombinations(전력목표, ctx) {
    ctx = ctx || {};
    // PV는 옥상형(수평) × 외피형(BAPV·BIPV) 직교 조합. 설치공간이 옥상/외피로 달라
    // 옥상 PV와 외피 BIPV를 동시 설치 가능(둘 다 「없음」이면 PV無).
    // 외피형 2종(BAPV·BIPV)은 동일 외피공간 경합이므로 동시 설치하지 않고 택1.
    // 건물유형 적합성 「매우낮음」 에너지원은 후보에서 배제(적합제외).
    var notExcl = function (n) { return !적합제외(n, ctx); };
    var PV옥상옵션 = [null, "고정식(수평)PV"].filter(function (n) { return !n || notExcl(n); });
    var PV외피옵션 = [null, "고정식(수직)BAPV", "BIPV"].filter(function (n) { return !n || notExcl(n); });
    var PV조합 = [];
    PV옥상옵션.forEach(function (옥상) {
      PV외피옵션.forEach(function (외피) {
        var names = [];
        if (옥상) names.push(옥상);
        if (외피) names.push(외피);
        PV조합.push(names);   // [] = PV無
      });
    });
    var 지열 = notExcl("수직밀폐형") ? find설비("수직밀폐형") : null;
    var PEMFC = notExcl("PEMFC(건물용)") ? find설비("PEMFC(건물용)") : null;
    var SOFC건물 = notExcl("SOFC(건물용)") ? find설비("SOFC(건물용)") : null;

    var TC = getTC();
    var 적합포함기준 = (TC && TC.등급점수) ? TC.등급점수("높음") : 4;
    var 발전용이름 = ["PAFC(발전용)", "SOFC(발전용)"].filter(function (name) {
      if (적합제외(name, ctx)) return false;   // 「매우낮음」 적합성 발전용도 배제
      if (전력목표) return true;
      if (cfg().건물적합도사용 === false) return false;
      if (!ctx.건물유형 || !TC || !TC.건물적합점수_설비) return false;
      var sc = TC.건물적합점수_설비(ctx.건물유형, name);
      return sc != null && sc >= 적합포함기준;
    });

    // 의무(에너지·전력) 총량 — 발전용 기수후보(floor/ceil) 산정용
    var 의무에너지 = (ctx.연간단위에너지소요량 > 0 && ctx.의무설치비율기준 > 0)
      ? ctx.연간단위에너지소요량 * ctx.의무설치비율기준 / 100 : 0;
    var 의무전력 = (전력목표 && ctx.연간예상전력소비량 > 0 && ctx.전력생산비율기준 > 0)
      ? ctx.연간예상전력소비량 * ctx.전력생산비율기준 / 100 : 0;
    var 기수하드캡 = 30;  // 발전용 기수 안전 상한(조합 폭증 방지)

    // 발전용 분기: 없음 + (각 종류별 기수후보). 1종 배타(한 분기에 한 종류).
    var 연료전지분기 = [{ label: "발전용無", 고정: [] }];
    발전용이름.forEach(function (name) {
      var s = find설비(name);
      if (!s) return;
      var 기당에너지 = s.c_연간단위에너지생산량 * s.단위용량;
      var 기당전력 = s.발전가능 ? s.f_연간발전량 * s.단위용량 : 0;
      var need = Math.max(
        기당에너지 > 0 ? 의무에너지 / 기당에너지 : 0,
        기당전력 > 0 ? 의무전력 / 기당전력 : 0
      );
      var 기수후보 = {};
      if (need > 0) {
        var nCeil = Math.min(기수하드캡, Math.max(1, Math.ceil(need - 1e-9)));  // 라운드업
        var nFloor = Math.floor(need + 1e-9);                                  // 잔여를 태양광·지열로 충당
        기수후보[nCeil] = true;
        if (nFloor >= 1 && nFloor < nCeil) 기수후보[nFloor] = true;
      } else {
        var maxK = MAX_연료전지기수();   // 의무 미상 → 기존 1~최대기수 폴백
        for (var k = 1; k <= maxK; k++) 기수후보[k] = true;
      }
      Object.keys(기수후보).forEach(function (kStr) {
        var kv = parseInt(kStr, 10);
        연료전지분기.push({
          label: name + "×" + kv + "기",
          고정: [{ 설비: s, 기수: kv, 용량: s.단위용량 * kv }]
        });
      });
    });

    // 연속 건물설비 후보 — 1계열 정책:
    //   발전용無 분기 → [지열, PEMFC, SOFC건물] 부분집합(건물용 FC 허용)
    //   발전용  분기 → [지열] 부분집합만(건물용 FC 제외; 태양광은 PV옵션에서 결합)
    // 부분집합 열거로 "지열-only/PV+지열/PEMFC-only" 등 구조적으로 다른 후보를 확보한다.
    var 건물설비전체 = [];
    if (지열) 건물설비전체.push(지열);
    if (PEMFC) 건물설비전체.push(PEMFC);
    if (SOFC건물) 건물설비전체.push(SOFC건물);
    var sub_건물용 = subsets(건물설비전체);
    var sub_발전용 = subsets(지열 ? [지열] : []);

    var combos = [];
    PV조합.forEach(function (pvNames) {
      var pvList = pvNames.map(function (n) { return find설비(n); }).filter(Boolean);
      연료전지분기.forEach(function (fc) {
        var 부분집합 = (fc.고정.length > 0) ? sub_발전용 : sub_건물용;   // 1계열 분리
        부분집합.forEach(function (sub) {
          var 연속 = [];
          pvList.forEach(function (pv) { 연속.push(pv); });
          sub.forEach(function (sx) { 연속.push(sx); });
          // 소스가 전혀 없으면(연속·고정 모두 비어있음) 무효
          if (연속.length === 0 && fc.고정.length === 0) return;
          var pvLabel = pvList.length ? pvList.map(function (pv) { return pv.세부형식; }).join("+") : "PV無";
          var subLabel = sub.length ? sub.map(function (sx) { return sx.세부형식; }).join("+") : "건물설비無";
          combos.push({
            label: pvLabel + " + " + subLabel + " + " + fc.label,
            연속설비: 연속,
            고정설비: fc.고정
          });
        });
      });
    });
    return combos;
  }

  // 배열의 모든 부분집합(공집합 포함)
  function subsets(arr) {
    var out = [[]];
    arr.forEach(function (x) {
      var add = out.map(function (s) { return s.concat([x]); });
      out = out.concat(add);
    });
    return out;
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

  // 목적함수별 변수 계수 — 최소비용(cost) 또는 최대화(benefit·incentive·design)
  // 차원별로 다른 용량배분을 유도해 "각 요구도를 우선 만족시키는" 다양한 조합을 생성한다.
  var OVER설치 = 1.2;  // 최대화 목적: 의무 대비 과설치 허용 상한(20%) — 무한 설치 방지
  function objCoeff(s, obj, ctx) {
    var TC = getTC();
    if (obj === "benefit") return s.l_순익;                                    // 운영순익 최대
    if (obj === "incentive") return TC ? TC.등급점수(s.n_ZEB기여도) : 3;        // ZEB(인센티브) 최대
    if (obj === "design") return TC                                           // 디자인 보존 최대
      ? (TC.좋음점수_역방향(s.o_디자인훼손도) + TC.좋음점수_역방향(s.p_외부공간차지도)) / 2 : 3;
    if (obj === "constraint") {                                                // 법적심의 제약 최소(=적합도 최대)
      var adeq = (TC && TC.제약적합_설비) ? TC.제약적합_설비(s.세부형식) : null;
      return (adeq == null) ? 0.5 : Math.max(1e-4, adeq);                      // 9요인 평균 적합도 최대화
    }
    if (obj === "suitability") {                                               // 건물유형별 에너지원 적합도 최대
      var su = (TC && TC.건물적합_설비 && ctx && ctx.건물유형) ? TC.건물적합_설비(ctx.건물유형, s.세부형식) : null;
      return (su == null) ? 0.5 : Math.max(1e-4, su);
    }
    return s.d_장비비;                                                         // 초기비용 최소(기본)
  }

  // ── 용량 LP (§6.2[2]) ───────────────────────────────────────────
  // 고정설비(연료전지 기수) 기여를 제약 우변에서 차감한 잔여 제약으로 연속설비 용량을 푼다.
  // obj: 'cost'(최소비용·기본) | 'benefit' | 'incentive' | 'design' (최대화)
  // ctx: { 연간단위에너지소요량, 의무설치비율기준, 연간예상전력소비량, 전력생산비율기준, 면적{} }
  function solveCapacity(combo, ctx, obj) {
    var solver = getSolver();
    if (!solver) throw new Error("LP 솔버(window.solver) 미로드");
    var isMax = (obj && obj !== "cost");

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
        목적: objCoeff(s, obj, ctx),
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

    // 최대화 목적은 의무를 만족하되 과설치 상한(OVER설치)을 둬 무한 설치를 막는다.
    // 의무근접 요구도가 높을수록 상한을 (기준+허용밴드%p)로 좁혀 최종 의무비율을 기준에 밀착시킨다.
    // → 비용 외 목적(순익·디자인 등)도 밴드 안에서 최적해를 찾아 '밴드 내 다양성'을 확보.
    var 근접밴드 = 의무근접상한(ctx);   // %p, Infinity=무제한
    var 잔여에너지상한 = Infinity;
    if (근접밴드 < Infinity && ctx.의무설치비율기준 > 0) {
      var 총량상한 = 의무에너지총량 * (ctx.의무설치비율기준 + 근접밴드) / ctx.의무설치비율기준;
      잔여에너지상한 = Math.max(잔여에너지, 총량상한 - 고정에너지);   // 음수 방어(고정이 이미 초과 시 잔여=0)
    }
    var emax = isMax ? 잔여에너지 * OVER설치 : Infinity;
    if (잔여에너지상한 < Infinity) emax = Math.min(emax, 잔여에너지상한);
    var e_energy제약 = { min: 잔여에너지 };
    if (emax < Infinity) e_energy제약.max = emax + 1e-6;
    var constraints = { e_energy: e_energy제약 };
    if (의무전력총량 > 0) constraints.e_power = { min: 잔여전력 };
    if (지열생산하한 > 0) constraints.geo = { min: 지열생산하한 };       // 지열 의무 옵션2(생산량)
    if (지열면적하한 > 0) constraints.geoArea = { min: 지열면적하한 };   // 지열 의무 옵션1(면적)
    // 공간별 잔여 면적 제약
    ["옥상", "외피", "대지", "기계실"].forEach(function (sp) {
      var cap = (면적[sp] != null ? 면적[sp] : BIG면적) - (고정면적[sp] || 0);
      constraints["a_" + sp] = { max: Math.max(0, cap) };
    });

    var model = {
      optimize: "목적", opType: isMax ? "max" : "min",
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
  // 건물적합(건물유형 적합성)은 다른 인자보다 우선순위가 높아 별도 배수(OPT_CONFIG.건물적합가중배수,
  //   기본 2.0)를 곱해 가중치 비중을 상향한다 → 건물유형에 맞는 에너지원 조합이 상위로 올라옴.
  function deriveWeights(요구도) {
    요구도 = 요구도 || {};
    var map = cfg().요구도점수 || { "높음": 3, "보통": 2, "낮음": 1 };
    var 건물적합배수 = cfg().건물적합가중배수 > 0 ? cfg().건물적합가중배수 : 2;
    var keys = ["초기비용", "운영비", "인센티브", "디자인", "시공성", "의무근접", "법규제약", "건물적합"];
    var raw = {}, sum = 0;
    keys.forEach(function (k) {
      var 보통 = map["보통"] != null ? map["보통"] : 2;
      var v = map[요구도[k]] != null ? map[요구도[k]] : 보통; // 미지정은 보통
      if (k === "건물적합") v *= 건물적합배수;                 // 건물유형 적합성 우선순위 상향
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

  // ── 인센티브 확보 「매우높음」 전용 고정 조합 ────────────────────
  // 옥상 PV·외피 BIPV를 가용면적 최대까지 채워 ZEB(인센티브) 기여를 극대화하고,
  // 부족한 의무비율은 건물유형 적합도가 가장 높은 에너지원으로 충당한다.
  //   · PV·BIPV는 연속용량 → 면적÷ⓜ가 면적기준 최대용량(스냅 없음).
  //   · 면적 미입력(무제한) 공간은 '최대'가 무의미 → 해당 PV로 의무를 균등 충족하는 결정적 조합으로 폴백.
  //   · 적합성 「매우낮음」으로 배제된 에너지원은 사용하지 않는다(적합제외와 일관).
  // 반환: feasible 항목 { label, items, targets, 고정조합 } 또는 null(구성 불가).
  function build인센티브챔피언(ctx) {
    var TC = getTC();
    if (!TC) return null;
    var 면적 = ctx.면적 || {};
    var 의무에너지총량 = (ctx.연간단위에너지소요량 || 0) * (ctx.의무설치비율기준 || 0) / 100;
    if (!(의무에너지총량 > 0)) return null;

    var pv = 적합제외("고정식(수평)PV", ctx) ? null : find설비("고정식(수평)PV");
    var bipv = 적합제외("BIPV", ctx) ? null : find설비("BIPV");
    if (!pv && !bipv) return null;

    var items = [], 누적생산 = 0, 면적채움가능 = true;
    [[pv, "옥상"], [bipv, "외피"]].forEach(function (pair) {
      var s = pair[0]; if (!s) return;
      var cap면적 = 면적[pair[1]];
      if (cap면적 != null && cap면적 > 0) {
        var c = cap면적 / s.m_설치면적;                 // 면적기준 최대용량(연속)
        누적생산 += s.c_연간단위에너지생산량 * c;
        items.push({ 설비: s, 용량: c, 단위: null, 단위기수: null, 고정: false });
      } else {
        면적채움가능 = false;                            // 무제한 면적 → 폴백
      }
    });

    // 폴백: 일부 PV 면적이 무제한이면 '최대'가 무의미 → PV·BIPV로 의무를 균등 충족(과설치 없이 결정적)
    if (!면적채움가능) {
      var pvList = [pv, bipv].filter(Boolean);
      items = []; 누적생산 = 0;
      var share = 의무에너지총량 / pvList.length;
      pvList.forEach(function (s) {
        var c = share / s.c_연간단위에너지생산량;
        누적생산 += s.c_연간단위에너지생산량 * c;
        items.push({ 설비: s, 용량: c, 단위: null, 단위기수: null, 고정: false });
      });
    }

    // 잔여 의무 → 건물유형 적합도 최고 에너지원으로 충당
    var 잔여 = 의무에너지총량 - 누적생산;
    if (잔여 > 1e-6) {
      var topup = pick최적합탑업(ctx);
      if (topup) {
        var snap = snapToUnit(잔여 / topup.c_연간단위에너지생산량, topup.스냅단위);
        items.push({ 설비: topup, 용량: snap.용량, 단위: snap.단위, 단위기수: snap.기수, 고정: false });
      }
    }
    if (items.length === 0) return null;

    var targets = TC.평가조합(items, ctx);
    // 의무 미충족(적합源 부재 등)이면 고정조합 보장 불가 → 폐기
    if (ctx.의무설치비율기준 != null
      && targets.법적규제.의무설치비율 < ctx.의무설치비율기준 - 1e-6) return null;
    // 면적 초과(탑업이 가용공간 초과)면 물리적 불가 → 폐기
    var 면적ok = ["옥상", "외피", "대지", "기계실"].every(function (sp) {
      return 면적[sp] == null || targets.설치면적[sp] <= 면적[sp] + 1e-6;
    });
    if (!면적ok) return null;

    var label = items.map(function (it) {
      return it.설비.세부형식 + " " + Math.round(it.용량) + "kW";
    }).join(" + ");
    return { label: label, items: items, targets: targets, 고정조합: "인센티브" };
  }

  // PV·BIPV 외의 에너지원 중 건물유형 적합도가 가장 높은 설비(탑업용). 적합성 「매우낮음」은 제외.
  function pick최적합탑업(ctx) {
    var TC = getTC();
    var 후보 = ["수직밀폐형", "PEMFC(건물용)", "SOFC(건물용)"];
    if (ctx.연간예상전력소비량 > 0 && ctx.전력생산비율기준 != null) {
      후보 = 후보.concat(["PAFC(발전용)", "SOFC(발전용)"]);
    }
    var 중립 = (TC && TC.등급점수) ? TC.등급점수("보통") : 3;
    var best = null, bestSc = -Infinity;
    후보.forEach(function (name) {
      if (적합제외(name, ctx)) return;
      var s = find설비(name); if (!s) return;
      var sc = (TC && TC.건물적합점수_설비 && ctx.건물유형)
        ? TC.건물적합점수_설비(ctx.건물유형, name) : null;
      if (sc == null) sc = 중립;                          // 미설정/미선택 → 중립
      if (sc > bestSc) { bestSc = sc; best = s; }          // 동점은 후보 순서(첫 항목) 우선
    });
    return best;
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
    var combos = generateCombinations(전력목표, ctx);
    var feasible = [];
    var 근접밴드 = 의무근접상한(ctx);   // 의무근접 요구도별 최종 의무비율 허용 상한(%p, Infinity=무제한)

    // 각 구조 조합을 5개 목적함수(최소비용·최대순익·최대인센티브·최대디자인·최소법규제약)로 풀어
    // 가중치 낮은 요구도까지 우선 만족시키는 다양한 후보를 생성한다(중복은 이후 제거).
    var 목적들 = ["cost", "benefit", "incentive", "design", "constraint", "suitability"];
    var 평가수 = 0;
    combos.forEach(function (combo) {
      목적들.forEach(function (obj) {
        평가수++;
        var cap = solveCapacity(combo, ctx, obj);     // [2] 용량 LP (목적별)
        if (!cap) return;                              // [3] 필터링(infeasible 제거)
        var targets = TC.평가조합(cap.items, ctx);     // §5 목표값
        // 법적규제 재검증. LP는 잔여기준으로 충족시키지만 부동소수 오차로 경계해(예 9.9999%)가
        // 탈락하지 않도록 허용오차(eps)를 둔다 — LP 제약을 만족한 해는 정당하다.
        var reg = targets.법적규제;
        var eps = 1e-6;
        if (ctx.의무설치비율기준 != null && reg.의무설치비율 < ctx.의무설치비율기준 - eps) return;
        // 의무근접 요구도 상한 밴드 — 스냅·정수기수 과설치로 (기준+허용밴드%p)를 넘으면 제외.
        //   '매우높음'이면 기준 대비 +0.5%p 초과 조합을 걸러 최종 의무비율을 ±0.5%p로 밀착시킨다.
        if (ctx.의무설치비율기준 != null && 근접밴드 < Infinity
          && reg.의무설치비율 > ctx.의무설치비율기준 + 근접밴드 + eps) return;
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
    });

    // 인센티브 확보 「매우높음」 → PV·BIPV 면적최대 + 적합도 최고 에너지원 고정 조합을 항상 주입.
    // (목적별 LP·의무근접 밴드와 무관하게 결정적으로 생성 — 의도적 인센티브 극대화 조합)
    if (ctx.요구도 && ctx.요구도.인센티브 === "매우높음") {
      var champ = build인센티브챔피언(ctx);
      if (champ) feasible.push(champ);
    }

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
      return { ranked: [], 평가건수: 평가수, 실행가능건수: 0 };
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
    // 정성 지표(ⓝ~ⓡ 등급점수)는 등급척도 범위로 고정척도 정규화한다(기본 1~5 → (v−1)/4).
    // min-max를 쓰면 미미한 raw 차이(예: 3.06 vs 5.00)가 0↔1로 양극화되어 의미가 왜곡됨.
    // 척도 최솟·최댓값은 설정값(OPT_CONFIG.등급점수)에서 유도해 척도 변경 시에도 정합 유지.
    var 등급표 = cfg().등급점수 || { "매우높음": 5, "높음": 4, "보통": 3, "낮음": 2, "매우낮음": 1 };
    var 등급값 = Object.keys(등급표).map(function (k) { return 등급표[k]; });
    var gmin = Math.min.apply(null, 등급값), gspan = (Math.max.apply(null, 등급값) - gmin) || 1;
    var 고정척도 = function (v) { return (v - gmin) / gspan; };
    var n인센 = 인센티브.map(고정척도);
    var n디자 = 디자인.map(고정척도);
    var n시공 = 시공성.map(고정척도);
    // 의무비율 근접도 = 의무기준 / 실제비율 (딱 맞으면 1.0, 과충족일수록 0에 근접). 고정척도(0~1).
    var n근접 = feasible.map(function (f) {
      var 실제 = f.targets.법적규제.의무설치비율;
      if (ctx.의무설치비율기준 == null || !(실제 > 0)) return 1;
      return Math.min(1, ctx.의무설치비율기준 / 실제);
    });
    // 법적심의 적합도 = 9요인 제약 프로파일의 요인가중 적합도(0~1, targetCalculator.계산제약에서 산출).
    // 평균 1개 숫자로 붕괴시키지 않고 요인별 점수를 합산한 값 → 미미한 차이의 과장 없이 고정척도(0~1).
    var n법규 = feasible.map(function (f) {
      return (f.targets.제약 && f.targets.제약.적합도 != null) ? f.targets.제약.적합도 : 1;
    });
    // 건물유형별 에너지원 적합도 — 고정척도(0~1, targetCalculator.계산건물적합). 미선택/미사용 시 전 조합 0.5(중립).
    var n건물 = feasible.map(function (f) {
      return (f.targets.건물적합 && f.targets.건물적합.적합도 != null) ? f.targets.건물적합.적합도 : 0.5;
    });

    feasible.forEach(function (f, i) {
      f.정규화 = { 초기비용: n초기[i], 운영순익: n운영[i], 인센티브: n인센[i], 디자인: n디자[i], 시공성: n시공[i], 의무근접: n근접[i], 법규제약: n법규[i], 건물적합: n건물[i] };
      f.score = w.초기비용 * n초기[i] + w.운영비 * n운영[i] + w.인센티브 * n인센[i]
        + w.디자인 * n디자[i] + w.시공성 * n시공[i] + w.의무근접 * n근접[i] + w.법규제약 * n법규[i] + w.건물적합 * n건물[i];
      f.태그 = []; f.챔피언 = [];
    });

    // 차원별 강점 태그 — 가중치와 무관하게 "어떤 요구도를 높게 만족하는지" 표시.
    // 각 요구도 차원에서 (정규화값-min)/(max-min) ≥ 0.85 인 조합에 태그, 최댓값 조합은 챔피언.
    // 차별성이 없는(span<0.05) 차원은 생략. → 가중치 낮은 항목의 대표 조합도 챔피언으로 노출됨.
    tagDimensions(feasible);

    // [5] 순위화
    var ranked = feasible.slice().sort(function (a, b) { return b.score - a.score; });
    ranked.forEach(function (f, i) { f.rank = i + 1; });

    return {
      ranked: ranked,
      평가건수: 평가수,
      실행가능건수: feasible.length,
      가중치: w
    };
  }

  // 요구도 차원별 강점 태그·챔피언 부여 (정규화값 기준, 척도 무관 상대평가)
  var TAG차원 = [
    ["초기비용", "초기비용"], ["운영순익", "운영비"], ["인센티브", "인센티브"],
    ["디자인", "디자인"], ["시공성", "시공성"], ["의무근접", "의무근접"], ["법규제약", "법규제약"], ["건물적합", "건물적합"]
  ];
  function tagDimensions(feasible) {
    TAG차원.forEach(function (d) {
      var key = d[0], label = d[1];
      var vals = feasible.map(function (f) { return f.정규화[key]; });
      var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
      if (max - min < 0.05) return;                  // 차별성 없음 → 태그 생략
      feasible.forEach(function (f) {
        var rel = (f.정규화[key] - min) / (max - min);
        if (rel >= 0.85) {
          f.태그.push(label);
          if (f.정규화[key] >= max - 1e-9) f.챔피언.push(label);
        }
      });
    });
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
