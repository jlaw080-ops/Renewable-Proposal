// settings/settingsUI.js
// 설정 페이지 UI — 최적화 가중치·상수 폼 + 라이브러리별 편집 테이블
// 의존: window.SettingsStore. IIFE 전역. window.SettingsUI 노출.
//
// 편집 모델: 렌더 시 라이브러리의 deep clone(working)을 만들고 input value 로 바인딩.
//   저장 시 DOM 의 모든 input 을 읽어 "원본 셀의 타입"에 맞춰 형변환(coerce)하여 구조를 재조립한다.
//   (의무비율 연도 셀처럼 같은 컬럼에 숫자 34 와 문자열 "자율" 이 섞여 있어 셀 단위 타입 보존이 필요)
(function () {
  "use strict";

  var LONG_COLS = { "장점": 1, "단점": 1, "비고": 1 };  // textarea 로 렌더할 컬럼
  var GRADE5 = ["매우높음", "높음", "보통", "낮음", "매우낮음"];  // 5등급 드롭다운 옵션

  var BOOL_OPTS = ["true", "false"];  // 불리언 컬럼 드롭다운(코어ce 시 boolean 으로 환원)

  // 법적심의 제약 9요인 [내부키, 표시명] — 제약요인가중치 폼·저장에 사용
  var 제약요인 = [
    ["경관디자인", "경관·디자인"], ["빛반사빛공해", "빛반사·빛공해"], ["일조장해", "일조장해"],
    ["소음진동", "소음·진동"], ["생태면적률", "생태면적률"], ["지형지질", "지형·지질"],
    ["수환경", "수환경"], ["동식물상", "동식물상"], ["구조안전", "구조·안전"]
  ];

  // 라이브러리별 컬럼 드롭다운 옵션 (없으면 입력칸). 범주형(등급·구분·불리언)만 드롭다운, 수치·식별자·텍스트는 입력칸.
  function colSelectOptions(regKey, data) {
    // 맵 형태: 법적심의 제약 매트릭스 9요인 셀은 5등급 드롭다운
    if (regKey === "제약가중치") {
      var mopt = {};
      mapInnerCols(data).forEach(function (c) { mopt[c] = GRADE5; });
      return mopt;
    }
    if (!Array.isArray(data)) return {};
    function distinct(col) {
      var s = [];
      data.forEach(function (r) { if (r[col] != null && r[col] !== "" && s.indexOf(r[col]) < 0) s.push(r[col]); });
      return s;
    }
    var opt = {};
    if (regKey === "요구도") {
      opt["사업형태"] = distinct("사업형태");
      opt["건물유형"] = distinct("건물유형");
      ["초기비용", "운영비", "디자인", "인센티브", "토지개발", "기계실", "공사기간", "공사난이도"]
        .forEach(function (c) { opt[c] = GRADE5; });
    } else if (regKey === "건물적합도") {
      opt["건물유형"] = distinct("건물유형");
      ["고정식(수평)PV", "고정식(수직)BAPV", "BIPV", "수직밀폐형", "PEMFC(건물용)", "SOFC(건물용)", "PAFC(발전용)", "SOFC(발전용)"]
        .forEach(function (c) { opt[c] = GRADE5; });
    } else if (regKey === "설비최적화") {
      opt["형식"] = distinct("형식");
      opt["설치공간"] = distinct("설치공간");
      ["n_ZEB기여도", "o_디자인훼손도", "p_외부공간차지도", "q_공사기간", "r_공사난이도"]
        .forEach(function (c) { opt[c] = GRADE5; });
      opt["발전가능"] = BOOL_OPTS;
      opt["차용플래그"] = BOOL_OPTS;
    }
    return opt;
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // 컬럼 목록: 모든 행의 키 합집합(스냅단위·차용플래그 등 일부 행에만 있는 키 포함)
  function arrayCols(arr) {
    var cols = [];
    (arr || []).forEach(function (row) {
      Object.keys(row).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); });
    });
    return cols;
  }
  function mapInnerCols(map) {
    var cols = [];
    Object.keys(map || {}).forEach(function (k) {
      Object.keys(map[k]).forEach(function (c) { if (cols.indexOf(c) < 0) cols.push(c); });
    });
    return cols;
  }

  // 셀 입력값 → 원본 타입에 맞춘 값
  function coerce(str, sample) {
    if (Array.isArray(sample)) {
      try { var a = JSON.parse(str); return Array.isArray(a) ? a : str; }
      catch (e) { return str; }
    }
    if (typeof sample === "boolean") return str === "true";
    if (typeof sample === "number") {
      if (str.trim() === "") return "";
      var n = Number(str);
      return isNaN(n) ? str : n;
    }
    // 문자열/빈값: 비었던 셀에 숫자를 넣으면 숫자로 승격(연도 셀 보완)
    if (sample === "" && str.trim() !== "") {
      var m = Number(str);
      if (!isNaN(m)) return m;
    }
    return str;
  }

  function cellValueStr(v) {
    if (Array.isArray(v)) return JSON.stringify(v);
    if (v == null) return "";
    return String(v);
  }

  // 표시 폭(ch): 한글·CJK·전각은 2, 나머지는 1로 계산
  function dispCols(s) {
    var w = 0;
    for (var i = 0; i < s.length; i++) w += (s.charCodeAt(i) > 0x2dff ? 2 : 1);
    return w;
  }

  // 단일 셀 입력 위젯 생성 — options 가 있으면 드롭다운, 아니면 내용폭 자동 input/textarea
  function cellInput(col, value, refAttr, options) {
    var raw = cellValueStr(value);
    var attrs = ' data-col="' + esc(col) + '" ' + refAttr;  // class 는 위젯별로 부여
    var val = esc(raw);
    if (options && options.length) {
      var opts = options.slice();
      if (raw !== "" && opts.indexOf(raw) < 0) opts.unshift(raw); // 목록에 없는 기존값 보존
      var body = opts.map(function (o) {
        return '<option value="' + esc(o) + '"' + (o === raw ? " selected" : "") + ">" + esc(o) + "</option>";
      }).join("");
      var blank = (raw === "") ? '<option value="" selected></option>' : "";
      return '<select class="set-cell set-select"' + attrs + ">" + blank + body + "</select>";
    }
    var isLong = LONG_COLS[col] || (typeof value === "string" && raw.length > 40);
    if (isLong) return '<textarea class="set-cell"' + attrs + ' rows="2">' + val + "</textarea>";
    var numeric = typeof value === "number";
    // 숫자칸은 스피너 화살표(약 2ch) 여유를 더 둔다
    var ch = Math.max(6, dispCols(raw) + (numeric ? 4 : 3));
    var style = ' style="min-width:' + ch + 'ch"';
    return '<input class="set-cell" type="' + (numeric ? "number" : "text") + '" step="any"' + style + attrs + ' value="' + val + '" />';
  }

  // ── 라이브러리 테이블 렌더 ──────────────────────────────────────────────
  function renderLibTable(reg) {
    var data = window.SettingsStore.getLib(reg.key);
    var selOpts = colSelectOptions(reg.key, data);
    var box = el("div", "set-table-wrap");

    var tbl = el("table", "set-table");
    var thead = el("thead");
    var trh = el("tr");

    var cols, isMap = reg.shape === "map", rowKeys = null;
    if (isMap) {
      cols = mapInnerCols(data);
      rowKeys = Object.keys(data);
      trh.appendChild(el("th", "set-th-key", "키"));
    } else {
      cols = arrayCols(data);
    }
    cols.forEach(function (c) { trh.appendChild(el("th", null, esc(c))); });
    thead.appendChild(trh);
    tbl.appendChild(thead);

    var tbody = el("tbody");
    if (isMap) {
      rowKeys.forEach(function (rk) {
        var tr = el("tr");
        tr.setAttribute("data-rowkey", rk);
        tr.appendChild(el("td", "set-td-key", esc(rk)));
        cols.forEach(function (c) {
          var td = el("td");
          td.innerHTML = cellInput(c, data[rk][c], 'data-rowkey="' + esc(rk) + '"', selOpts[c]);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    } else {
      data.forEach(function (row, i) {
        var tr = el("tr");
        tr.setAttribute("data-rowidx", i);
        cols.forEach(function (c) {
          var td = el("td");
          td.innerHTML = cellInput(c, row[c], 'data-rowidx="' + i + '"', selOpts[c]);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    tbl.appendChild(tbody);
    box.appendChild(tbl);
    return { wrap: box, table: tbl, cols: cols, isMap: isMap };
  }

  // DOM input 들 → 저장용 데이터 구조 재조립 (원본 셀 타입 기준 coerce)
  // 원본 행에 없던 컬럼(예: PV행의 스냅단위)은 빈 값이면 건너뛰어 원본 형태를 보존한다.
  function had(row, col) { return row && Object.prototype.hasOwnProperty.call(row, col); }
  function collectLib(reg, table) {
    var orig = window.SettingsStore.getLib(reg.key);
    if (reg.shape === "map") {
      var out = {};
      Object.keys(orig).forEach(function (rk) { out[rk] = {}; for (var k in orig[rk]) out[rk][k] = orig[rk][k]; });
      table.querySelectorAll(".set-cell").forEach(function (inp) {
        var rk = inp.getAttribute("data-rowkey"), col = inp.getAttribute("data-col");
        if (out[rk] == null) return;
        if (!had(orig[rk], col) && inp.value.trim() === "") return;
        out[rk][col] = coerce(inp.value, orig[rk] ? orig[rk][col] : "");
      });
      return out;
    }
    var arr = orig.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; return o; });
    table.querySelectorAll(".set-cell").forEach(function (inp) {
      var i = parseInt(inp.getAttribute("data-rowidx"), 10), col = inp.getAttribute("data-col");
      if (!arr[i]) return;
      if (!had(orig[i], col) && inp.value.trim() === "") return;
      arr[i][col] = coerce(inp.value, orig[i] ? orig[i][col] : "");
    });
    return arr;
  }

  // 라이브러리 1개 = <details> 카드
  function libCard(reg) {
    var det = el("details", "set-card");
    var overridden = window.SettingsStore.isLibOverridden(reg.key);
    var sum = el("summary", "set-summary");
    sum.innerHTML = '<span class="set-summary-title">' + esc(reg.label) + "</span>"
      + '<span class="set-badge' + (overridden ? " on" : "") + '">' + (overridden ? "변경됨" : "기본값") + "</span>";
    det.appendChild(sum);

    var body = el("div", "set-card-body");
    var filter = null;
    var rendered = renderLibTable(reg);

    // 행이 많은 맵(의무비율 등)에는 필터 추가
    if (reg.shape === "map" && Object.keys(window.SettingsStore.getLib(reg.key)).length > 12) {
      filter = el("input", "set-filter");
      filter.type = "text";
      filter.placeholder = "행 필터 (키·값 일부 입력)…";
      filter.addEventListener("input", function () {
        var q = filter.value.trim().toLowerCase();
        rendered.table.querySelectorAll("tbody tr").forEach(function (tr) {
          tr.style.display = (!q || tr.textContent.toLowerCase().indexOf(q) >= 0) ? "" : "none";
        });
      });
      body.appendChild(filter);
    }
    body.appendChild(rendered.wrap);

    var actions = el("div", "set-actions");
    var saveBtn = el("button", "set-btn set-btn-save", "저장");
    saveBtn.type = "button";
    var resetBtn = el("button", "set-btn set-btn-reset", "기본값 복원");
    resetBtn.type = "button";
    var msg = el("span", "set-msg");
    actions.appendChild(saveBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(msg);
    body.appendChild(actions);
    det.appendChild(body);

    saveBtn.addEventListener("click", function () {
      var data = collectLib(reg, rendered.table);
      var ok = window.SettingsStore.saveLib(reg.key, data);
      msg.textContent = ok ? "저장됨 — 다음 계산부터 적용" : "저장 실패(localStorage)";
      msg.className = "set-msg " + (ok ? "ok" : "err");
      setBadge(sum, true);
      reflectMainCalc();
    });
    resetBtn.addEventListener("click", function () {
      window.SettingsStore.resetLib(reg.key);
      var fresh = renderLibTable(reg);
      rendered.wrap.replaceWith(fresh.wrap);
      rendered = fresh;
      msg.textContent = "기본값으로 복원됨";
      msg.className = "set-msg ok";
      setBadge(sum, false);
      reflectMainCalc();
    });
    return det;
  }

  function setBadge(summary, on) {
    var b = summary.querySelector(".set-badge");
    if (b) { b.textContent = on ? "변경됨" : "기본값"; b.className = "set-badge" + (on ? " on" : ""); }
  }

  // ── 최적화 가중치·상수 폼 ────────────────────────────────────────────────
  function num(id) { var v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; }

  function configCard() {
    var cfg = window.SettingsStore.getConfig();
    var det = el("details", "set-card");
    det.open = true;
    var overridden = window.SettingsStore.isConfigOverridden();
    var sum = el("summary", "set-summary");
    sum.innerHTML = '<span class="set-summary-title">최적화 가중치 · 상수</span>'
      + '<span class="set-badge' + (overridden ? " on" : "") + '">' + (overridden ? "변경됨" : "기본값") + "</span>";
    det.appendChild(sum);

    var body = el("div", "set-card-body");
    function field(label, id, val, hint) {
      return '<label class="set-field"><span>' + esc(label) + (hint ? ' <small>' + esc(hint) + '</small>' : "")
        + '</span><input type="number" step="any" id="' + id + '" value="' + esc(String(val)) + '"/></label>';
    }
    var html = '<label class="set-toggle"><input type="checkbox" id="cfg-landscape"'
      + (cfg.경관보정사용 !== false ? " checked" : "") + "/> "
      + '경관 보정 사용 <small>지자체·에너지원별 디자인 패널티(경관 민감도·영향 표)</small></label>'
      + '<label class="set-toggle"><input type="checkbox" id="cfg-legalreg"'
      + (cfg.법규제약사용 !== false ? " checked" : "") + "/> "
      + '법적심의 제약 사용 <small>건축심의·환경영향평가 제약 매트릭스(9요인)를 「법규제약」 차원에 반영</small></label>'
      + '<label class="set-toggle"><input type="checkbox" id="cfg-bldfit"'
      + (cfg.건물적합도사용 !== false ? " checked" : "") + "/> "
      + '건물 적합도 사용 <small>건물유형별 신재생에너지원 적합도(5등급)를 「건물적합」 차원에 반영</small></label>'
      + '<div class="set-cfg-grid">'
      + field("연료전지 최대 기수", "cfg-fc-max", cfg.연료전지최대기수, "대용량 연료전지 조합 전개 한도")
      + field("외피면적 산정 층고 (m)", "cfg-eave-h", cfg.외피층고, "외피면적 = 4·√건축 × 층수 × 층고")
      + "</div>"
      + '<div class="set-cfg-sub">요구도 점수 (5등급 가중치 환산 — 건물유형별 요구도와 동일 척도)</div><div class="set-cfg-grid">'
      + field("매우높음", "cfg-req-vh", cfg.요구도점수["매우높음"])
      + field("높음", "cfg-req-hi", cfg.요구도점수["높음"])
      + field("보통", "cfg-req-mid", cfg.요구도점수["보통"])
      + field("낮음", "cfg-req-lo", cfg.요구도점수["낮음"])
      + field("매우낮음", "cfg-req-vl", cfg.요구도점수["매우낮음"])
      + "</div>"
      + '<div class="set-cfg-sub">정성 등급 점수 (디자인·시공성·ZEB)</div><div class="set-cfg-grid">'
      + field("매우높음", "cfg-g-vh", cfg.등급점수["매우높음"])
      + field("높음", "cfg-g-h", cfg.등급점수["높음"])
      + field("보통", "cfg-g-m", cfg.등급점수["보통"])
      + field("낮음", "cfg-g-l", cfg.등급점수["낮음"])
      + field("매우낮음", "cfg-g-vl", cfg.등급점수["매우낮음"])
      + "</div>"
      + '<div class="set-cfg-sub">제약 요인별 가중치 (법적심의 제약 9요인 — 입지·건물유형에 따라 중요 요인 강조, 기본 균등 1)</div><div class="set-cfg-grid">'
      + 제약요인.map(function (fk, i) {
          return field(fk[1], "cfg-cw" + i, (cfg.제약요인가중치 || {})[fk[0]] != null ? cfg.제약요인가중치[fk[0]] : 1);
        }).join("")
      + "</div>";
    body.innerHTML = html;

    var actions = el("div", "set-actions");
    var saveBtn = el("button", "set-btn set-btn-save", "저장");
    saveBtn.type = "button";
    var resetBtn = el("button", "set-btn set-btn-reset", "기본값 복원");
    resetBtn.type = "button";
    var msg = el("span", "set-msg");
    actions.appendChild(saveBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(msg);
    body.appendChild(actions);
    det.appendChild(body);

    saveBtn.addEventListener("click", function () {
      var c = {
        연료전지최대기수: num("cfg-fc-max"), 외피층고: num("cfg-eave-h"),
        경관보정사용: document.getElementById("cfg-landscape").checked,
        법규제약사용: document.getElementById("cfg-legalreg").checked,
        건물적합도사용: document.getElementById("cfg-bldfit").checked,
        요구도점수: {
          "매우높음": num("cfg-req-vh"), "높음": num("cfg-req-hi"), "보통": num("cfg-req-mid"),
          "낮음": num("cfg-req-lo"), "매우낮음": num("cfg-req-vl")
        },
        등급점수: {
          "매우높음": num("cfg-g-vh"), "높음": num("cfg-g-h"), "보통": num("cfg-g-m"),
          "낮음": num("cfg-g-l"), "매우낮음": num("cfg-g-vl")
        },
        제약요인가중치: (function () {
          var o = {};
          제약요인.forEach(function (fk, i) { o[fk[0]] = num("cfg-cw" + i); });
          return o;
        })()
      };
      var ok = window.SettingsStore.saveConfig(c);
      msg.textContent = ok ? "저장됨 — 다음 최적화부터 적용" : "저장 실패";
      msg.className = "set-msg " + (ok ? "ok" : "err");
      setBadge(sum, true);
    });
    resetBtn.addEventListener("click", function () {
      window.SettingsStore.resetConfig();
      det.replaceWith(configCard());  // 폼 재생성
    });
    return det;
  }

  // 라이브러리 변경 후 메인 계산결과 즉시 갱신 (있을 때)
  function reflectMainCalc() {
    try { if (typeof window.renderAll === "function") window.renderAll(); } catch (e) {}
  }

  // ── 전체 렌더 ────────────────────────────────────────────────────────────
  var _built = false;
  function init() {
    var host = document.getElementById("settings-content");
    // host가 비어 있으면 재구축 허용 — React 모달은 닫힘/페이지 이동 시 host DOM을 파괴하므로
    // _built 플래그만으로 가드하면 재오픈 시 빈 모달이 됨 (2026-07-29 보수)
    if (!host || (_built && host.childElementCount > 0)) return;
    _built = true;

    host.appendChild(configCard());

    [["optimize", "최적화 전용 라이브러리"], ["calc", "기존 계산 공용 라이브러리"]].forEach(function (g) {
      var libs = window.SettingsStore.list().filter(function (r) { return r.group === g[0]; });
      if (!libs.length) return;
      host.appendChild(el("div", "set-group-title", g[1]));
      libs.forEach(function (reg) { host.appendChild(libCard(reg)); });
    });

    // 전역 도구: 전체 복원 / 내보내기 / 가져오기
    var tools = el("div", "set-global-tools");
    var resetAllBtn = el("button", "set-btn set-btn-reset", "전체 기본값 복원");
    resetAllBtn.type = "button";
    var exportBtn = el("button", "set-btn", "JSON 내보내기");
    exportBtn.type = "button";
    var importBtn = el("button", "set-btn", "JSON 가져오기");
    importBtn.type = "button";
    var fileInp = el("input");
    fileInp.type = "file"; fileInp.accept = ".json,application/json"; fileInp.style.display = "none";
    tools.appendChild(resetAllBtn);
    tools.appendChild(exportBtn);
    tools.appendChild(importBtn);
    tools.appendChild(fileInp);
    host.appendChild(tools);

    resetAllBtn.addEventListener("click", function () {
      if (!window.confirm("모든 설정을 기본값으로 되돌립니다. 계속할까요?")) return;
      window.SettingsStore.resetAll();
      host.innerHTML = ""; _built = false; init(); reflectMainCalc();
    });
    exportBtn.addEventListener("click", function () {
      var blob = new Blob([window.SettingsStore.exportAll()], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "최적화설정.json";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    importBtn.addEventListener("click", function () { fileInp.click(); });
    fileInp.addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function (ev) {
        try {
          window.SettingsStore.importAll(ev.target.result);
          host.innerHTML = ""; _built = false; init(); reflectMainCalc();
        } catch (err) { window.alert("가져오기 실패: " + err.message); }
      };
      rd.readAsText(f);
    });
  }

  window.SettingsUI = { init: init };
})();
