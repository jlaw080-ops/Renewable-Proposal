// optimize/optimizeUI.js
// 설비조합 최적화 — UI 바인딩 (입력 수집 → optimize 호출 → 순위 카드 렌더링)
// 개발기획서 §7·§8. IIFE 전역. window.OptimizeUI 노출.
// 의존: window.Optimizer, window.PowerEstimator, window.LAST_OUTPUT1/2(기존 계산결과)
(function () {
  "use strict";

  // 사용자 요구도 5등급 — 건물유형별 요구도·요구도점수/가중치 환산과 동일 척도
  var LEVELS = ["매우높음", "높음", "보통", "낮음", "매우낮음"];

  var 요구도항목 = [
    { key: "초기비용", label: "초기비용 절감" },
    { key: "운영비", label: "운영비 절감" },
    { key: "인센티브", label: "인센티브 확보" },
    { key: "디자인", label: "디자인 보존" },
    { key: "시공성", label: "시공 용이성" },
    { key: "의무근접", label: "의무비율 근접", default: "높음" },
    { key: "법규제약", label: "법적심의 적합성" },
    { key: "건물적합", label: "건물유형 적합성" }
  ];

  function $(id) { return document.getElementById(id); }
  function num(id) { var v = parseFloat($(id).value); return isNaN(v) ? null : v; }
  // 설정값(window.OPT_CONFIG, settings/settingsStore.js)을 호출 시점에 읽는다.
  function cfg() { return (typeof window !== "undefined" && window.OPT_CONFIG) || {}; }

  function init() {
    // 건물유형 select
    var sel = $("opt-building-type");
    if (sel && window.PowerEstimator) {
      sel.innerHTML = '<option value="">선택 안함</option>';
      window.PowerEstimator.유형목록().forEach(function (t) {
        var o = document.createElement("option");
        o.value = t; o.textContent = t; sel.appendChild(o);
      });
    }
    // 요구도 라디오
    var box = $("opt-priority-rows");
    if (box) {
      box.innerHTML = 요구도항목.map(function (it) {
        var def = it.default || "보통";
        var radios = LEVELS.map(function (lv) {
          return '<label><input type="radio" name="opt-pri-' + it.key + '" value="' + lv + '"'
            + (lv === def ? " checked" : "") + ">" + lv + "</label>";
        }).join("");
        return '<div class="opt-priority-row"><span class="opt-priority-name">' + it.label
          + '</span><span class="opt-radio-group">' + radios + "</span></div>";
      }).join("");
    }
    // 전력소비량 실시간 갱신
    ["opt-building-type", "opt-building-area"].forEach(function (id) {
      var el = $(id);
      if (el) { el.addEventListener("change", updatePowerDemand); el.addEventListener("input", updatePowerDemand); }
    });
    // 가용면적 비율 → 실시간 계산 (옥상·외피·대지=최소~최대, 기계실=단일)
    ["roof", "facade", "land"].forEach(function (k) {
      ["min", "max"].forEach(function (b) {
        var el = $("opt-area-" + k + "-" + b);
        if (el) el.addEventListener("input", updateAreaCalc);
      });
    });
    var mEl = $("opt-area-machine-pct");
    if (mEl) mEl.addEventListener("input", updateAreaCalc);
    // 건물유형·사업형태 → 표준 요구도 자동 반영 + 외피 가용비율 기본값 갱신
    var bt = $("opt-building-type");
    if (bt) {
      bt.addEventListener("change", autoLoadRequirements);
      bt.addEventListener("change", onBuildingTypeArea);
    }
    var sf = document.getElementById("sel-사업형태");
    if (sf) sf.addEventListener("change", autoLoadRequirements);
    // 탭 진입 시 기존 계산결과 연동
    var tab = $("tab-optimize");
    if (tab) tab.addEventListener("click", prefillFromCalc);
    // 실행
    var btn = $("btn-run-optimize");
    if (btn) btn.addEventListener("click", run);
    // 결과 영역 이벤트 위임 (보고서 출력 + AI 설명)
    var resultBox = $("optimize-result");
    if (resultBox) resultBox.addEventListener("click", onResultClick);
    // 가용면적 비율 기본값 자동 입력(빈 칸만)
    loadAreaDefaultsIfEmpty();
  }

  // 기존 사업정보 계산 결과(Output1/2)에서 에너지소요량·의무비율 자동 채움(빈 칸만)
  function prefillFromCalc() {
    var ed = $("opt-energy-demand");
    if (ed && !ed.value && window.LAST_OUTPUT1 && window.LAST_OUTPUT1.총예상에너지사용량) {
      ed.value = Math.round(window.LAST_OUTPUT1.총예상에너지사용량);
    }
    var rr = $("opt-req-ratio");
    if (rr && !rr.value && window.LAST_OUTPUT2 && window.LAST_OUTPUT2[0] && window.LAST_OUTPUT2[0].의무비율 != null) {
      rr.value = window.LAST_OUTPUT2[0].의무비율;
    }
    loadAreaDefaultsIfEmpty();   // 가용면적 비율 기본값(빈 칸만)
    updateAreaCalc(); // 사업정보 기준면적 반영
  }

  function updatePowerDemand() {
    var type = $("opt-building-type").value;
    var area = parseFloat($("opt-building-area").value) || 0;
    var out = $("opt-power-demand");
    if (type && area > 0 && window.PowerEstimator) {
      var e = window.PowerEstimator.estimate([{ 건물유형: type, 연면적: area }]);
      out.textContent = e.연간예상전력소비량.toLocaleString() + " kWh/yr";
      out.dataset.value = e.연간예상전력소비량;
    } else {
      out.textContent = "—"; out.dataset.value = "";
    }
  }

  // ── 가용면적: 사업정보 기준면적 대비 비율 ───────────────────────
  // 기준: 옥상·기계실=건축면적, 대지=대지면적, 외피=예상외피면적(계산)
  function 사업면적(id) {
    var el = document.getElementById(id);
    return el ? (parseFloat(el.value) || 0) : 0;
  }
  // 예상 외피(입면) 면적 = 4·√건축면적 × (연면적/건축면적) × 층고(기본 3.5m, 설정값)
  //   정사각형 평면 가정 → 둘레 = 4·√건축면적, 높이 = 층수(연면적/건축면적) × 층고
  function 외피면적(건축, 연면적) {
    if (!(건축 > 0) || !(연면적 > 0)) return 0;
    var 층고 = cfg().외피층고 > 0 ? cfg().외피층고 : 3.5;
    return 4 * Math.sqrt(건축) * (연면적 / 건축) * 층고;
  }
  function getBaseAreas() {
    var 건축 = 사업면적("inp-건축면적");
    var 연면적 = 사업면적("inp-연면적");
    var 대지 = 사업면적("inp-대지면적");
    return { 건축면적: 건축, 연면적: 연면적, 대지면적: 대지, 외피면적: 외피면적(건축, 연면적) };
  }
  // 각 행 = [key, 기준면적, 라벨]
  function areaSpecs() {
    var b = getBaseAreas();
    return [
      ["roof", b.건축면적, "건축"],
      ["facade", b.외피면적, "외피"],
      ["land", b.대지면적, "대지"],
      ["machine", b.건축면적, "건축"]
    ];
  }
  function 면적표시(v) { return v > 0 ? Math.round(v).toLocaleString() + "㎡" : "—"; }

  // ── 가용면적 비율 기본값 (문서: 태양광·지열 가용면적 적용 방식 변경, 2026-06-26) ──
  //   PV(옥상)·지열(대지)은 건물유형 무관, 외피(BAPV·BIPV)는 건물유형별. 자동 입력 후 수정 가능.
  var AREA_RANGE_DEFAULT = { roof: { min: 20, max: 70 }, land: { min: 0, max: 50 } };
  var FACADE_RANGE_BY_TYPE = {
    "공동주택": { min: 10, max: 25 }, "주상복합": { min: 10, max: 25 },
    "사무실·업무시설": { min: 20, max: 60 }, "데이터센터": { min: 20, max: 60 },
    "상가": { min: 15, max: 30 }
  };
  var FACADE_RANGE_FALLBACK = { min: 15, max: 30 };   // 미매핑 유형 폴백
  function facadeDefault() {
    var bt = $("opt-building-type"); var t = bt ? bt.value : "";
    return FACADE_RANGE_BY_TYPE[t] || FACADE_RANGE_FALLBACK;
  }
  function setRange(key, r) {
    var lo = $("opt-area-" + key + "-min"), hi = $("opt-area-" + key + "-max");
    if (lo) lo.value = r.min; if (hi) hi.value = r.max;
  }
  function fillRangeIfEmpty(key, r) {
    var lo = $("opt-area-" + key + "-min"), hi = $("opt-area-" + key + "-max");
    if (lo && lo.value === "") lo.value = r.min;
    if (hi && hi.value === "") hi.value = r.max;
  }
  // 건물유형 변경 시: 외피는 유형 의존이므로 갱신, 옥상·대지는 빈 칸만 채움.
  function onBuildingTypeArea() {
    setRange("facade", facadeDefault());
    fillRangeIfEmpty("roof", AREA_RANGE_DEFAULT.roof);
    fillRangeIfEmpty("land", AREA_RANGE_DEFAULT.land);
    updateAreaCalc();
  }
  function loadAreaDefaultsIfEmpty() {
    fillRangeIfEmpty("roof", AREA_RANGE_DEFAULT.roof);
    fillRangeIfEmpty("land", AREA_RANGE_DEFAULT.land);
    fillRangeIfEmpty("facade", facadeDefault());
    updateAreaCalc();
  }
  // 행별 입력 비율(최소·최대). machine은 단일 pct.
  function rangePct(key) {
    return { min: num("opt-area-" + key + "-min"), max: num("opt-area-" + key + "-max") };
  }

  // 기준면적·계산결과 실시간 갱신
  function updateAreaCalc() {
    areaSpecs().forEach(function (s) {
      var key = s[0], base = s[1], label = s[2];
      var baseEl = $("opt-base-" + key);
      if (baseEl) baseEl.textContent = label + " " + 면적표시(base);
      var calcEl = $("opt-area-" + key + "-calc");
      if (!calcEl) return;
      if (key === "machine") {                       // 단일 비율
        var p = num("opt-area-machine-pct");
        calcEl.textContent = (p != null && base > 0)
          ? "= " + Math.round(base * p / 100).toLocaleString() + "㎡" : "= —";
        return;
      }
      var r = rangePct(key);                          // 최소~최대 비율
      if (base > 0 && (r.min != null || r.max != null)) {
        var lo = (r.min != null) ? Math.round(base * r.min / 100) : null;
        var hi = (r.max != null) ? Math.round(base * r.max / 100) : null;
        calcEl.textContent = "= " + (lo != null ? lo.toLocaleString() + "㎡" : "—")
          + " ~ " + (hi != null ? hi.toLocaleString() + "㎡" : "—");
      } else {
        calcEl.textContent = "= —";
      }
    });
    // 외피: 정사각형 평면 가정 → 4개 방위 면이 균등(각 = 전체/4). 전체 면적과 함께 방위별 예상 표시.
    var 외피 = getBaseAreas().외피면적;
    var orientEl = $("opt-facade-orient");
    if (orientEl) {
      orientEl.textContent = 외피 > 0
        ? "방위별 예상(각 면) — 동 " + 면적표시(외피 / 4) + " · 서 " + 면적표시(외피 / 4)
          + " · 남 " + 면적표시(외피 / 4) + " · 북 " + 면적표시(외피 / 4)
        : "방위별 예상: —";
    }
  }

  // 비율 → 가용면적. 옥상·외피·대지는 {min,max}(㎡) 범위, 기계실은 단일 cap.
  //   반환: { 면적: {sp: 상한㎡|null}, 면적범위: {sp: {min,max}|null} }
  //   면적(상한)은 인센티브 챔피언·지열의무 등 기존 로직 호환용. 미입력/기준0 → null(무제한).
  function collectAreaData() {
    var keymap = { roof: "옥상", facade: "외피", land: "대지", machine: "기계실" };
    var b = getBaseAreas();
    var baseOf = { roof: b.건축면적, facade: b.외피면적, land: b.대지면적, machine: b.건축면적 };
    var 면적 = {}, 면적범위 = {};
    ["roof", "facade", "land"].forEach(function (key) {
      var base = baseOf[key], sp = keymap[key], r = rangePct(key);
      if (base > 0 && (r.min != null || r.max != null)) {
        var pmin = (r.min != null) ? r.min : r.max;   // 한쪽만 입력 시 동일값(점)
        var pmax = (r.max != null) ? r.max : r.min;
        var lo = base * Math.min(pmin, pmax) / 100;
        var hi = base * Math.max(pmin, pmax) / 100;
        면적범위[sp] = { min: lo, max: hi };
        면적[sp] = hi;                                 // 상한
      } else {
        면적범위[sp] = null; 면적[sp] = null;          // 무제한
      }
    });
    var mp = num("opt-area-machine-pct");
    if (baseOf.machine > 0 && mp != null) {
      var cap = baseOf.machine * mp / 100;
      면적["기계실"] = cap; 면적범위["기계실"] = { min: cap, max: cap };
    } else { 면적["기계실"] = null; 면적범위["기계실"] = null; }
    return { 면적: 면적, 면적범위: 면적범위 };
  }

  // ── 건물유형별 표준 요구도 자동 반영 (LIB_요구도) ───────────────
  // 키: 사업형태(sel-사업형태) + 건물유형(opt-building-type)
  // 시공성 = 토지개발·기계실·공사기간·공사난이도 4개의 평균 등급으로 환산 (§4.5·H3)
  function autoLoadRequirements() {
    if (!window.LIB_요구도) return;
    var sf = document.getElementById("sel-사업형태");
    var 사업형태 = sf ? sf.value : "";
    var bt = $("opt-building-type");
    var 건물유형 = bt ? bt.value : "";
    if (!사업형태 || !건물유형) return;
    var row = window.LIB_요구도.filter(function (r) {
      return r.사업형태 === 사업형태 && r.건물유형 === 건물유형;
    })[0];
    if (!row) return;
    // 시공성 = 4개 하위등급(토지개발·기계실·공사기간·공사난이도)의 평균 점수를 다시 등급으로 환산.
    // 요구도점수(5등급) 척도를 사용하고, 평균 점수에 가장 가까운 등급으로 역매핑(척도 변경에도 안전).
    var 점수 = cfg().요구도점수 || { "매우높음": 5, "높음": 4, "보통": 3, "낮음": 2, "매우낮음": 1 };
    function 가까운등급(s) {
      var best = "보통", bd = Infinity;
      Object.keys(점수).forEach(function (lv) {
        var d = Math.abs(점수[lv] - s);
        if (d < bd) { bd = d; best = lv; }
      });
      return best;
    }
    var 하위 = [row.토지개발, row.기계실, row.공사기간, row.공사난이도]
      .map(function (g) { return 점수[g]; })
      .filter(function (v) { return v != null; });
    var 시공성등급 = 하위.length
      ? 가까운등급(하위.reduce(function (a, b) { return a + b; }, 0) / 하위.length) : "보통";
    var map = { 초기비용: row.초기비용, 운영비: row.운영비, 인센티브: row.인센티브, 디자인: row.디자인, 시공성: 시공성등급 };
    요구도항목.forEach(function (it) {
      var v = map[it.key];
      var radio = document.querySelector('input[name=opt-pri-' + it.key + '][value="' + v + '"]');
      if (radio) radio.checked = true;
    });
  }

  function collectCtx() {
    var ad = collectAreaData();
    var 요구도 = {};
    요구도항목.forEach(function (it) {
      var sel = document.querySelector("input[name=opt-pri-" + it.key + "]:checked");
      요구도[it.key] = sel ? sel.value : "보통";
    });
    var pd = $("opt-power-demand").dataset.value;
    // 경관계수용 지자체 — 사업정보 대지위치를 지역키로 정규화 (지역계수/경관민감도 키와 동일)
    var 대지 = document.getElementById("sel-대지위치");
    var 지자체 = (대지 && typeof window.normalize대지위치 === "function")
      ? window.normalize대지위치(대지.value) : (대지 ? 대지.value : "");
    return {
      건물유형: $("opt-building-type").value || null,
      지자체: 지자체 || null,
      연간단위에너지소요량: num("opt-energy-demand"),
      의무설치비율기준: num("opt-req-ratio"),
      지열의무: (num("opt-geo-ratio") > 0)
        ? { 비율: num("opt-geo-ratio"), 건축면적: 사업면적("inp-건축면적") } : null,
      연간예상전력소비량: pd ? parseFloat(pd) : 0,
      전력생산비율기준: num("opt-power-ratio"),
      면적: ad.면적,
      면적범위: ad.면적범위,
      요구도: 요구도
    };
  }

  function run() {
    var box = $("optimize-result");
    var ctx = collectCtx();
    if (!ctx.연간단위에너지소요량 || ctx.연간단위에너지소요량 <= 0) {
      box.innerHTML = '<div class="opt-error">연간 에너지소요량을 입력하세요. (사업정보 입력 시 자동 연동)</div>'; return;
    }
    if (ctx.의무설치비율기준 == null) {
      box.innerHTML = '<div class="opt-error">의무설치비율(%)을 입력하세요.</div>'; return;
    }
    if (!window.Optimizer) { box.innerHTML = '<div class="opt-error">최적화 엔진 미로드</div>'; return; }
    box.innerHTML = '<div class="recommend-loading">최적 조합 탐색 중…</div>';
    setTimeout(function () {
      try {
        var r = window.Optimizer.optimize(ctx);
        render(r, box, ctx);
        window.LAST_OPTIMIZE = r;   // P5 AI 설명용
        window._optCtx = ctx;       // 설명 생성 맥락
        window._optExplains = {};   // 생성된 AI 설명(보고서용)
      } catch (e) {
        box.innerHTML = '<div class="opt-error">오류: ' + e.message + "</div>";
      }
    }, 30);
  }

  function gradeBar(점수) {
    var pct = ((점수 - 1) / 4 * 100).toFixed(0);
    return '<span class="opt-grade-bar"><span style="width:' + pct + '%"></span></span>';
  }

  // 법적심의 제약 9요인 프로파일 (확장형) — 9요인 등급을 평균 없이 그대로 표시
  var 제약요인표시 = [
    ["경관디자인", "경관·디자인"], ["빛반사빛공해", "빛반사·빛공해"], ["일조장해", "일조장해"],
    ["소음진동", "소음·진동"], ["생태면적률", "생태면적률"], ["지형지질", "지형·지질"],
    ["수환경", "수환경"], ["동식물상", "동식물상"], ["구조안전", "구조·안전"]
  ];
  function constraintProfileHTML(f) {
    var p = f.targets && f.targets.제약 && f.targets.제약.프로파일;
    if (!p) return "";
    var rows = 제약요인표시.filter(function (d) { return p[d[0]]; }).map(function (d) {
      var it = p[d[0]];
      var pct = Math.max(0, Math.min(100, (it.점수 - 1) / 4 * 100)).toFixed(0);  // 등급점수 1~5 → 0~100%(높을수록 제약↑)
      return '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;font-size:11px">'
        + '<span style="flex:0 0 78px;color:#555">' + d[1] + '</span>'
        + '<span style="flex:0 0 52px;color:#333">' + it.등급 + '</span>'
        + '<span style="flex:1;height:6px;background:#eee;border-radius:3px;overflow:hidden;display:inline-block">'
        + '<span style="display:block;height:100%;width:' + pct + '%;background:#d9534f"></span></span></div>';
    }).join("");
    return '<details class="opt-cprof" style="margin-top:6px;font-size:11px">'
      + '<summary style="cursor:pointer;color:#666">법적심의 제약 프로파일 (9요인)</summary>'
      + '<div style="margin-top:4px">' + rows + '</div></details>';
  }

  // 강점 요구도 태그 칩 (챔피언=★ 강조). 태양광 합계 최대 조합은 인센티브 태그를 강조.
  function tagChips(f) {
    var html = "";
    // 태양광 합계 최대 → 높은 자립률(ECO2)로 ZEB 인센티브 유리: 전용 강조 칩 선두 배치
    if (f.최대태양광) {
      html += '<span class="opt-tag incentive-hot" title="태양광 합계 용량 최대 → 높은 에너지자립률(ECO2)로 ZEB 등급 인센티브 확보에 유리">&#9889; 인센티브 유리</span>';
    }
    if (f.태그 && f.태그.length) {
      html += f.태그.map(function (t) {
        var champ = f.챔피언 && f.챔피언.indexOf(t) >= 0;
        var hot = (f.최대태양광 && t === "인센티브") ? " incentive-hot" : "";  // 기존 인센티브 태그도 강조
        return '<span class="opt-tag' + (champ ? " champ" : "") + hot + '">' + (champ ? "★ " : "") + t + "</span>";
      }).join("");
    } else if (!f.최대태양광) {
      html += '<span class="opt-tag muted">균형형</span>';
    }
    return '<div class="opt-tags">' + html + "</div>";
  }

  // 표시 조합 선정: 종합점수 상위 5개 (ranked는 점수 내림차순 정렬됨)
  var MAX_SHOW = 5;
  function pickShow(ranked) {
    return ranked.slice(0, Math.min(MAX_SHOW, ranked.length));
  }

  // 단일 조합 카드 HTML 생성 — 최적화 결과·AI 추천 비교에서 공용으로 사용(동일 양식 보장).
  //   opts.head        : 카드 헤더 내부 HTML 오버라이드(기본 "#rank 점수 [최적]")
  //   opts.best        : best 강조 여부(기본 rank===1)
  //   opts.showExplain : AI 설명 버튼 표시(기본 true). #optimize-result 외부에선 false 권장.
  //   opts.append      : 카드 맨 아래 추가 HTML(예: AI 평가 근거)
  function buildCardHTML(f, opts) {
    opts = opts || {};
    var reg = f.targets.법적규제;
    var totC = f.items.reduce(function (s, x) { return s + x.용량; }, 0);
    // 에너지원별 용량 — 가로 누적 바차트(총용량 대비 원별 비율) + 범례
    var segColors = ["#8b5cf6", "#f472b6", "#34d399", "#fbbf24", "#60a5fa", "#f87171", "#22d3ee", "#a3e635"];
    var segs = "", legend = "";
    f.items.forEach(function (it, i) {
      var pct = totC > 0 ? (it.용량 / totC * 100) : 0;
      var col = segColors[i % segColors.length];
      var 단위 = it.고정 ? " (" + it.기수 + "기)"
        : (it.구성 && it.구성.length
          ? " (" + it.구성.map(function (p) { return p.단위 + "kW×" + p.기수 + "기"; }).join(" + ") + ")"
          : (it.단위 ? " (" + it.단위 + "kW×" + it.단위기수 + "기)" : ""));
      var capLabel = Math.round(it.용량).toLocaleString();
      segs += '<div style="width:' + pct.toFixed(1) + "%;background:" + col
        + '" title="' + it.설비.세부형식 + " " + capLabel + 'kW"></div>';
      legend += '<span class="opt-leg"><span class="opt-leg-dot" style="background:' + col + '"></span>'
        + it.설비.세부형식 + 단위 + ' <b>' + capLabel + "kW</b> (" + pct.toFixed(0) + "%)</span>";
    });
    var sysHtml = '<div class="opt-stack-track">' + segs + '</div><div class="opt-stack-legend">' + legend + "</div>";
    var pwr = reg.전력생산비율 != null
      ? '<div><span>전력생산</span><b>' + reg.전력생산비율.toFixed(1) + "%</b></div>" : "";
    var util = (f.면적이용률 != null)
      ? '<div><span>면적이용</span><b>' + Math.round(f.면적이용률 * 100) + "%</b></div>" : "";
    var head = (opts.head != null) ? opts.head
      : '<span class="opt-rank">#' + f.rank + '</span>'
        + '<span class="opt-score">' + (f.score * 100).toFixed(0) + '점</span>'
        + (f.rank === 1 ? '<span class="opt-badge">최적</span>' : "");
    var isBest = (opts.best != null) ? opts.best : (f.rank === 1);
    var tail = (opts.showExplain === false) ? ""
      : '<button class="opt-explain-btn" data-rank="' + f.rank + '" type="button">AI 설명 생성</button>'
        + '<div class="opt-explain-text" id="opt-explain-' + f.rank + '"></div>';
    return '<div class="opt-card' + (isBest ? " best" : "") + '">'
      + '<div class="opt-card-head">' + head + "</div>"
      + tagChips(f)
      + '<div class="opt-sys">' + sysHtml + "</div>"
      + '<div class="opt-targets">'
      + '<div><span>초기비용</span><b>' + (f.targets.초기비용 / 1e8).toFixed(2) + "억</b></div>"
      + '<div><span>연간순익</span><b>' + (f.targets.운영순익 / 1e4).toFixed(0) + "만</b></div>"
      + '<div><span>의무비율</span><b' + (reg.의무설치비율_충족 === false ? ' class="opt-fail"' : "") + ">"
      + reg.의무설치비율.toFixed(1) + "%</b></div>" + pwr + util + "</div>"
      + '<div class="opt-quali"><span>디자인</span>' + gradeBar(f.targets.정성.디자인)
      + "<span>시공성</span>" + gradeBar(f.targets.정성.시공성)
      + "<span>ZEB</span>" + gradeBar(f.targets.정성.ZEB)
      + "<span>심의적합</span>" + gradeBar(1 + 4 * ((f.targets.제약 && f.targets.제약.적합도 != null) ? f.targets.제약.적합도 : 1))
      + "<span>건물적합</span>" + gradeBar(1 + 4 * ((f.targets.건물적합 && f.targets.건물적합.적합도 != null) ? f.targets.건물적합.적합도 : 0.5)) + "</div>"
      + constraintProfileHTML(f)
      + tail
      + (opts.append || "")
      + "</div>";
  }

  function render(r, box, ctx) {
    if (!r.ranked.length) {
      var msg = (r.실행가능건수 > 0)
        ? '실행가능 조합 ' + r.실행가능건수 + '개가 모두 건물유형 적합도 기준 미달로 표시에서 제외되었습니다. 설정에서 적합도 또는 표시 하한 등급을 조정하세요.'
        : '조건을 충족하는 조합이 없습니다. 면적·기준을 완화해 보세요.';
      box.innerHTML = '<div class="opt-error">' + msg + ' (평가 ' + r.평가건수 + '건)</div>'; return;
    }
    var html = "";
    // 경관 보정 적용 안내 (지자체 설정 + 경관보정 활성 시)
    var optcfg = (typeof window !== "undefined" && window.OPT_CONFIG) || {};
    if (ctx && ctx.지자체 && optcfg.경관보정사용 !== false
        && window.LIB_경관민감도 && window.LIB_경관민감도[ctx.지자체]) {
      var ms = window.LIB_경관민감도[ctx.지자체];
      html += '<div class="opt-geo-banner">경관 보정 적용 — <b>' + ctx.지자체 + '</b> 경관민감도 '
        + ms.민감도 + (ms.등급 ? ' (' + ms.등급 + ')' : "")
        + ' · 노출형 PV·BAPV 디자인 패널티↑ (지열·연료전지 불변)</div>';
    }
    if (r.지열옵션비교 && r.지열옵션비교.추천) {
      var gc = r.지열옵션비교;
      var s1 = gc.옵션1.ranked[0] ? (gc.옵션1.ranked[0].score * 100).toFixed(0) + "점" : "불가";
      var s2 = gc.옵션2.ranked[0] ? (gc.옵션2.ranked[0].score * 100).toFixed(0) + "점" : "불가";
      html += '<div class="opt-geo-banner">지열 의무 비교 — 옵션1(면적 50%): ' + s1
        + ' / 옵션2(비율 50%): ' + s2 + ' → <b>' + gc.추천 + '</b> 추천</div>';
    }
    if (ctx && ctx.면적범위) {
      html += '<div class="opt-geo-banner">면적이용률 구간 스윕 — 가용면적 최소~최대 비율을 5단계로 변화시켜 면적활용 변형 조합을 함께 평가했습니다 (카드의 「면적이용」 참고).</div>';
    }
    var show = pickShow(r.ranked);
    // 태양광 합계 용량 최대 조합 식별 — 높은 에너지자립률(ECO2)로 ZEB 인센티브 확보에 유리(태그·AI설명 강조).
    var maxPV = 0, maxPVf = null;
    show.forEach(function (f) {
      var pv = f.items.reduce(function (s, it) { return s + (it.설비.형식 === "태양광" ? it.용량 : 0); }, 0);
      f.태양광합계 = pv;
      if (pv > maxPV) { maxPV = pv; maxPVf = f; }
    });
    show.forEach(function (f) { f.최대태양광 = (f === maxPVf && maxPV > 0); });
    var 제외문 = (r.표시제외건수 > 0)
      ? " · 저적합 예외 " + r.표시제외건수 + "개 제외" : "";
    html += '<div class="opt-summary"><span>실행가능 ' + r.실행가능건수 + "개 중 " + show.length
      + "개 표시 <small>(종합점수 상위 " + MAX_SHOW + "개" + 제외문 + ")</small> / 평가 " + r.평가건수
      + '건</span><button class="opt-report-btn" type="button">보고서 출력</button></div>';
    html += '<div class="opt-card-grid">';
    show.forEach(function (f) { html += buildCardHTML(f); });
    html += '</div>';
    box.innerHTML = html;
  }

  // 결과 영역 클릭 처리 (이벤트 위임): 보고서 출력 + AI 설명 생성
  async function onResultClick(e) {
    if (!e.target.closest) return;
    // 보고서 출력
    if (e.target.closest(".opt-report-btn")) {
      if (window.OptimizeReport) {
        window.OptimizeReport.openReport(window.LAST_OPTIMIZE, window._optCtx, window._optExplains);
      }
      return;
    }
    // AI 설명 생성
    var btn = e.target.closest(".opt-explain-btn");
    if (!btn) return;
    if (!window.OptimizeExplain) return;
    var rank = parseInt(btn.dataset.rank, 10);
    var card = window.LAST_OPTIMIZE && window.LAST_OPTIMIZE.ranked[rank - 1];
    var out = $("opt-explain-" + rank);
    if (!card || !out) return;
    btn.disabled = true;
    out.innerHTML = '<span class="recommend-loading">AI 설명 생성 중…</span>';
    try {
      var text = await window.OptimizeExplain.explain(card, window._optCtx || {});
      out.textContent = text;
      if (!window._optExplains) window._optExplains = {};
      window._optExplains[rank] = text; // 보고서에 포함
    } catch (err) {
      out.innerHTML = '<span class="opt-error">' + err.message + "</span>";
    } finally {
      btn.disabled = false;
    }
  }

  // ── 프로젝트 저장/복원 (최적화 탭 입력값 + 마지막 최적화 결과) ──────
  // index.html 프로젝트 저장(saveFormState)/불러오기(applyProjectState)에서 호출.
  // 입력값은 필드별로, 결과는 window.LAST_OPTIMIZE(전역)를 그대로 직렬화해 저장하고
  // 복원 시 render()로 다시 그려 보고서·AI설명 버튼이 동작하도록 전역도 함께 되살린다.
  var 저장입력필드 = [
    ["opt-energy-demand", "energyDemand"], ["opt-req-ratio", "reqRatio"], ["opt-geo-ratio", "geoRatio"],
    ["opt-building-type", "buildingType"], ["opt-building-area", "buildingArea"], ["opt-power-ratio", "powerRatio"],
    ["opt-area-roof-min", "areaRoofMin"], ["opt-area-roof-max", "areaRoofMax"],
    ["opt-area-facade-min", "areaFacadeMin"], ["opt-area-facade-max", "areaFacadeMax"],
    ["opt-area-land-min", "areaLandMin"], ["opt-area-land-max", "areaLandMax"],
    ["opt-area-machine-pct", "areaMachinePct"]
  ];
  function getState() {
    var inputs = {};
    저장입력필드.forEach(function (m) { var el = $(m[0]); inputs[m[1]] = el ? el.value : ""; });
    inputs.요구도 = {};
    요구도항목.forEach(function (it) {
      var sel = document.querySelector("input[name=opt-pri-" + it.key + "]:checked");
      inputs.요구도[it.key] = sel ? sel.value : "보통";
    });
    return {
      inputs: inputs,
      result: (typeof window !== "undefined" && window.LAST_OPTIMIZE) || null,
      ctx: (typeof window !== "undefined" && window._optCtx) || null,
      explains: (typeof window !== "undefined" && window._optExplains) || null
    };
  }
  function setState(s) {
    if (!s) return;
    var inp = s.inputs || {};
    저장입력필드.forEach(function (m) {
      var el = $(m[0]);
      if (el && inp[m[1]] != null) el.value = inp[m[1]];
    });
    if (inp.요구도) {
      요구도항목.forEach(function (it) {
        var v = inp.요구도[it.key];
        if (!v) return;
        var r = document.querySelector('input[name=opt-pri-' + it.key + '][value="' + v + '"]');
        if (r) r.checked = true;
      });
    }
    updatePowerDemand();
    updateAreaCalc();
    // 마지막 최적화 결과 복원 — 전역 복원 후 재렌더(보고서·AI설명 버튼 동작 보장)
    var box = $("optimize-result");
    if (s.result && box) {
      window.LAST_OPTIMIZE = s.result;
      window._optCtx = s.ctx || {};
      window._optExplains = s.explains || {};
      try { render(s.result, box, s.ctx || {}); }
      catch (e) { box.innerHTML = '<div class="opt-error">저장된 최적화 결과 복원 실패: ' + e.message + '</div>'; }
    }
  }

  // AI 추천 등 외부 기능이 최적화 탭의 구조적 조건(가용면적·요구도·의무비율 등)을 공유할 때 사용.
  window.OptimizeUI = { init: init, run: run, getState: getState, setState: setState, getConditions: collectCtx, buildCardHTML: buildCardHTML };
})();
