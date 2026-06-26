// optimize/optimizeReport.js
// 설비조합 최적화 — 컨설팅 보고서 (개발기획서 §7-#6)
// 최적화 결과 + 목표값 + (생성된) AI 설명을 A4 인쇄용 HTML 보고서로 출력한다.
// 기존 report/ 모듈에 의존하지 않는 독립 빌더 (결합도 최소). window.OptimizeReport 노출.
(function () {
  "use strict";

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function 억(v) { return (v / 1e8).toFixed(2); }

  var CSS =
    "*{box-sizing:border-box}body{font-family:'Malgun Gothic','맑은 고딕',sans-serif;color:#1a1a1a;" +
    "max-width:800px;margin:0 auto;padding:32px 28px;line-height:1.6;font-size:13px}" +
    "h1{font-size:22px;margin:0 0 4px;border-bottom:3px solid #10b981;padding-bottom:8px}" +
    "h2{font-size:16px;margin:28px 0 10px;color:#0a7a5a}" +
    "h3{font-size:13px;margin:14px 0 4px;color:#333}" +
    ".meta{color:#666;font-size:12px;margin-bottom:8px}" +
    "table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px}" +
    "th,td{border:1px solid #ccc;padding:6px 8px;text-align:center;vertical-align:top}" +
    "th{background:#f0fdf9;font-weight:700}" +
    "td.l{text-align:left}" +
    "tr.best{background:#ecfdf5}tr.best td{font-weight:700}" +
    ".explain{margin:8px 0 0;padding:10px 12px;background:#f9fafb;border-left:3px solid #10b981;border-radius:4px}" +
    ".explain h3{margin:0 0 4px}.explain p{margin:0;white-space:pre-wrap}" +
    ".footer{margin-top:28px;padding-top:12px;border-top:1px solid #ddd;color:#888;font-size:11px}" +
    // ── 카드형 순위 표시 ──
    ".legend{display:flex;gap:14px;flex-wrap:wrap;margin:6px 0 14px;font-size:12px}" +
    ".lg{display:flex;align-items:center;gap:5px}" +
    ".card{border:1px solid #d1d5db;border-radius:8px;padding:14px 16px;margin:12px 0;" +
    "break-inside:avoid;page-break-inside:avoid}" +
    ".card.best{border:2px solid #10b981;background:#f6fffb}" +
    ".card-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}" +
    ".rank{font-size:18px;font-weight:800;color:#0a7a5a}" +
    ".score{margin-left:auto;font-size:16px;font-weight:800;color:#0a7a5a}" +
    ".badge{background:#10b981;color:#fff;border-radius:10px;padding:2px 10px;font-size:11px;font-weight:700}" +
    ".tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}" +
    ".tag{background:#eef2ff;color:#3730a3;border-radius:10px;padding:2px 8px;font-size:11px}" +
    ".tag.champ{background:#10b981;color:#fff}" +
    ".stack{display:flex;height:18px;border-radius:5px;overflow:hidden;margin:8px 0;border:1px solid #e5e7eb}" +
    ".stack>span{display:block;height:100%}" +
    ".sys-row{display:flex;align-items:center;gap:8px;margin:3px 0;font-size:12px}" +
    ".sys-name{flex:1}.sys-name small{color:#888}.sys-cap{font-weight:700}" +
    ".dot{width:11px;height:11px;border-radius:2px;flex:0 0 auto;display:inline-block}" +
    ".targets{display:flex;gap:18px;flex-wrap:wrap;margin:10px 0;font-size:12px;color:#555}" +
    ".targets b{font-size:14px;color:#1a1a1a;margin-left:4px}" +
    ".quali{display:flex;flex-wrap:wrap;margin:8px 0}" +
    ".qg{display:inline-flex;align-items:center;gap:5px;margin:2px 14px 2px 0;font-size:11px;color:#555}" +
    ".gbar{display:inline-block;width:56px;height:7px;background:#e5e7eb;border-radius:4px;vertical-align:middle;overflow:hidden}" +
    ".gbar>span{display:block;height:100%;background:#10b981}" +
    ".profile{margin-top:8px;font-size:11px}.profile summary{cursor:pointer;color:#666}" +
    ".pf-row{display:flex;align-items:center;gap:6px;margin:2px 0}" +
    ".pf-name{flex:0 0 92px;color:#555}.pf-grade{flex:0 0 56px;color:#333}" +
    ".pf-bar{flex:1;height:6px;background:#eee;border-radius:3px;overflow:hidden}" +
    ".pf-bar>span{display:block;height:100%;background:#dc2626}" +
    "button.noprint{margin-top:20px;padding:10px 20px;background:#10b981;color:#fff;border:none;" +
    "border-radius:6px;font-size:13px;cursor:pointer}" +
    "@media print{button.noprint{display:none}body{padding:0}}";

  // 신재생 에너지원(세부형식)별 색상 — 누적차트·범례·설비 점 공통.
  // 결과 화면처럼 모든 에너지원을 개별 색으로 세분화(태양광 PV·BAPV·BIPV도 각각 구분).
  var 세부색 = {
    "고정식(수평)PV": "#f59e0b", "고정식(수직)BAPV": "#f472b6", "BIPV": "#8b5cf6",
    "수직밀폐형": "#16a34a", "PEMFC(건물용)": "#3b82f6", "SOFC(건물용)": "#06b6d4",
    "PAFC(발전용)": "#ef4444", "SOFC(발전용)": "#a3e635"
  };
  // 미등재(커스텀) 세부형식은 이름 해시로 결정적 색 생성 → 항상 동일 색·서로 구분.
  function hashColor(s) {
    var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "hsl(" + (h % 360) + ",62%,55%)";
  }
  function colorOf(세부형식) { return 세부색[세부형식] || hashColor(String(세부형식 || "")); }

  function 조건표(ctx) {
    ctx = ctx || {};
    var 면적 = ctx.면적 || {};
    var rng = ctx.면적범위 || null;
    function v(x, u) { return x == null ? "—" : x.toLocaleString() + (u || ""); }
    // 가용면적: 범위(min~max)가 있으면 범위로, 없으면 단일값. min==max(기계실 단일)이면 단일 표기.
    function 면적V(sp) {
      if (rng && rng[sp]) {
        var lo = Math.round(rng[sp].min), hi = Math.round(rng[sp].max);
        return lo === hi ? lo.toLocaleString() : lo.toLocaleString() + "~" + hi.toLocaleString();
      }
      return 면적[sp] == null ? "—" : Math.round(면적[sp]).toLocaleString();
    }
    var 요구 = ctx.요구도 || {};
    var 요구문 = ["초기비용", "운영비", "인센티브", "디자인", "시공성", "의무근접", "법규제약", "건물적합"]
      .map(function (k) { return k + ":" + (요구[k] || "보통"); }).join(", ");
    return "<table><tbody>" +
      "<tr><th>건물유형</th><td class='l'>" + escapeHtml(ctx.건물유형 || "—") + "</td>" +
      "<th>연간 에너지소요량</th><td class='l'>" + v(ctx.연간단위에너지소요량, " kWh/yr") + "</td></tr>" +
      "<tr><th>의무설치비율 기준</th><td class='l'>" + v(ctx.의무설치비율기준, "%") + "</td>" +
      "<th>전력생산비율 기준</th><td class='l'>" + v(ctx.전력생산비율기준, "%") + "</td></tr>" +
      "<tr><th>예상 전력소비량</th><td class='l'>" + v(ctx.연간예상전력소비량, " kWh/yr") + "</td>" +
      "<th>가용면적 최소~최대(옥상/외피/대지/기계실)</th><td class='l'>" +
      면적V("옥상") + " / " + 면적V("외피") + " / " + 면적V("대지") + " / " + 면적V("기계실") + " ㎡</td></tr>" +
      "<tr><th>사용자 요구도</th><td class='l' colspan='3'>" + escapeHtml(요구문) + "</td></tr>" +
      "</tbody></table>";
  }

  // 법적심의 제약 9요인 (표시명) — optimizeUI 와 동일 순서
  var 제약요인표시 = [
    ["경관디자인", "경관·디자인"], ["빛반사빛공해", "빛반사·빛공해"], ["일조장해", "일조장해"],
    ["소음진동", "소음·진동"], ["생태면적률", "생태면적률"], ["지형지질", "지형·지질"],
    ["수환경", "수환경"], ["동식물상", "동식물상"], ["구조안전", "구조·안전"]
  ];

  function clampPct(p) { return Math.max(0, Math.min(100, p)); }
  function 단위표시(it) {
    return it.고정 ? "(" + it.기수 + "기)"
      : (it.구성 && it.구성.length
        ? "(" + it.구성.map(function (p) { return p.단위 + "kW×" + p.기수 + "기"; }).join(" + ") + ")"
        : (it.단위 ? "(" + it.단위 + "kW×" + it.단위기수 + "기)" : ""));
  }
  // 등급점수(기본 1~5) → 0~100% 막대
  function gbar(pct) {
    return "<span class='gbar'><span style='width:" + clampPct(pct).toFixed(0) + "%'></span></span>";
  }

  // 신재생 용량 누적차트 — 설비별 세그먼트(에너지원 색상)로 용량 비율 표시
  function 누적차트(items) {
    var tot = items.reduce(function (s, x) { return s + x.용량; }, 0) || 1;
    var segs = items.map(function (it) {
      var pct = it.용량 / tot * 100;
      return "<span style='width:" + pct.toFixed(2) + "%;background:" + colorOf(it.설비.세부형식) + "' " +
        "title='" + escapeHtml(it.설비.세부형식) + " " + Math.round(it.용량) + "kW (" +
        pct.toFixed(0) + "%)'></span>";
    }).join("");
    return "<div class='stack'>" + segs + "</div>";
  }
  // 설비 목록 — 색 점 + 세부형식(+단위) + 용량
  function 설비목록(items) {
    return items.map(function (it) {
      var sub = 단위표시(it);
      return "<div class='sys-row'><span class='dot' style='background:" + colorOf(it.설비.세부형식) + "'></span>" +
        "<span class='sys-name'>" + escapeHtml(it.설비.세부형식) +
        (sub ? " <small>" + escapeHtml(sub) + "</small>" : "") + "</span>" +
        "<span class='sys-cap'>" + Math.round(it.용량).toLocaleString() + " kW</span></div>";
    }).join("");
  }
  // 강점 요구도 태그칩 (챔피언=★)
  function 태그칩(f) {
    if (!f.태그 || !f.태그.length) return "<div class='tags'><span class='tag'>균형형</span></div>";
    return "<div class='tags'>" + f.태그.map(function (t) {
      var champ = f.챔피언 && f.챔피언.indexOf(t) >= 0;
      return "<span class='tag" + (champ ? " champ" : "") + "'>" + (champ ? "★ " : "") + escapeHtml(t) + "</span>";
    }).join("") + "</div>";
  }
  // 정성 막대 (디자인·시공성·ZEB·심의적합)
  function 정성막대(f) {
    var t = f.targets.정성;
    var adeq = (f.targets.제약 && f.targets.제약.적합도 != null) ? f.targets.제약.적합도 : 1;
    var fit = (f.targets.건물적합 && f.targets.건물적합.적합도 != null) ? f.targets.건물적합.적합도 : 0.5;
    function qg(label, pct) { return "<span class='qg'><span>" + label + "</span>" + gbar(pct) + "</span>"; }
    return "<div class='quali'>" +
      qg("디자인", (t.디자인 - 1) / 4 * 100) + qg("시공성", (t.시공성 - 1) / 4 * 100) +
      qg("ZEB", (t.ZEB - 1) / 4 * 100) + qg("심의적합", adeq * 100) + qg("건물적합", fit * 100) + "</div>";
  }
  // 법적심의 제약 9요인 프로파일 (접힘, 인쇄 시 자동 펼침)
  function 제약프로파일(f) {
    var p = f.targets.제약 && f.targets.제약.프로파일;
    if (!p) return "";
    var rows = 제약요인표시.filter(function (d) { return p[d[0]]; }).map(function (d) {
      var it = p[d[0]];
      var pct = clampPct((it.점수 - 1) / 4 * 100);
      return "<div class='pf-row'><span class='pf-name'>" + d[1] + "</span>" +
        "<span class='pf-grade'>" + escapeHtml(it.등급) + "</span>" +
        "<span class='pf-bar'><span style='width:" + pct.toFixed(0) + "%'></span></span></div>";
    }).join("");
    return "<details class='profile'><summary>법적심의 제약 프로파일 (9요인)</summary>" +
      "<div style='margin-top:4px'>" + rows + "</div></details>";
  }

  // 단일 조합 카드 (스크린샷 항목 그대로)
  function 조합카드(f, explains) {
    var reg = f.targets.법적규제;
    var pwr = reg.전력생산비율 != null
      ? "<div><span>전력생산</span><b>" + reg.전력생산비율.toFixed(1) + "%</b></div>" : "";
    var util = (f.면적이용률 != null)
      ? "<div><span>면적이용</span><b>" + Math.round(f.면적이용률 * 100) + "%</b></div>" : "";
    var ex = (explains && explains[f.rank])
      ? "<div class='explain'><h3>AI 설명</h3><p>" + escapeHtml(explains[f.rank]) + "</p></div>" : "";
    return "<div class='card" + (f.rank === 1 ? " best" : "") + "'>" +
      "<div class='card-head'><span class='rank'>#" + f.rank + "</span>" +
      "<span class='score'>" + (f.score * 100).toFixed(0) + "점</span>" +
      (f.rank === 1 ? "<span class='badge'>최적</span>" : "") + "</div>" +
      태그칩(f) +
      누적차트(f.items) +
      "<div class='sys'>" + 설비목록(f.items) + "</div>" +
      "<div class='targets'>" +
      "<div><span>초기비용</span><b>" + 억(f.targets.초기비용) + "억</b></div>" +
      "<div><span>연간순익</span><b>" + (f.targets.운영순익 / 1e4).toFixed(0) + "만</b></div>" +
      "<div><span>의무비율</span><b>" + reg.의무설치비율.toFixed(1) + "%</b></div>" + pwr + util + "</div>" +
      정성막대(f) +
      제약프로파일(f) +
      ex +
      "</div>";
  }

  // 에너지원 색상 범례 (결과에 등장하는 세부형식만 — 결과 화면처럼 에너지원별 세분화)
  function 범례(r) {
    var seen = [];
    r.ranked.forEach(function (f) {
      f.items.forEach(function (it) { if (seen.indexOf(it.설비.세부형식) < 0) seen.push(it.설비.세부형식); });
    });
    return "<div class='legend'>" + seen.map(function (t) {
      return "<span class='lg'><span class='dot' style='background:" + colorOf(t) + "'></span>" + escapeHtml(t) + "</span>";
    }).join("") + "</div>";
  }

  // 생성된 모든 조합을 카드로 (순위순)
  function 순위카드(r, explains) {
    return 범례(r) + "<div class='cards'>" +
      r.ranked.map(function (f) { return 조합카드(f, explains); }).join("") + "</div>";
  }

  function buildReportHTML(r, ctx, explains) {
    var now = new Date().toLocaleString("ko-KR");
    // 인쇄 시 접힌 제약 프로파일을 자동 펼쳤다가 복원 (화면은 스크린샷과 동일하게 접힘 유지)
    var printScript = "<script>" +
      "window.addEventListener('beforeprint',function(){document.querySelectorAll('details').forEach(function(d){d.setAttribute('data-o',d.open?'1':'0');d.open=true;});});" +
      "window.addEventListener('afterprint',function(){document.querySelectorAll('details').forEach(function(d){d.open=d.getAttribute('data-o')==='1';});});" +
      "<\/script>";
    return "<!DOCTYPE html><html lang='ko'><head><meta charset='utf-8'>" +
      "<title>신재생에너지 설비조합 최적화 보고서</title><style>" + CSS + "</style></head><body>" +
      "<h1>신재생에너지 설비조합 최적화 보고서</h1>" +
      "<div class='meta'>생성일시: " + escapeHtml(now) +
      " · 실행가능 " + r.실행가능건수 + "개 조합 / 평가 " + r.평가건수 + "건</div>" +
      "<h2>1. 입력 조건</h2>" + 조건표(ctx) +
      "<h2>2. 최적 설비조합 순위 (선택 " + r.ranked.length + "개 조합)</h2>" + 순위카드(r, explains) +
      "<div class='footer'>※ 신재생 용량 막대는 에너지원(세부형식)별 색상으로 구분한 누적차트(용량 비율)입니다.<br>" +
      "※ 전력 원단위는 잠정 추정값이며 실측·공인 통계에 의한 확정이 필요합니다.<br>" +
      "※ 본 보고서는 의사결정 참고용이며, 최종 설계는 현장 여건·법적 검토를 반영해야 합니다.</div>" +
      "<button class='noprint' onclick='window.print()'>인쇄 / PDF 저장</button>" +
      printScript +
      "</body></html>";
  }

  function openReport(r, ctx, explains) {
    if (!r || !r.ranked || !r.ranked.length) { alert("먼저 최적화를 실행하세요."); return; }
    var html = buildReportHTML(r, ctx, explains);
    var w = window.open("", "_blank");
    if (!w) { alert("팝업이 차단되었습니다. 팝업을 허용해 주세요."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  window.OptimizeReport = { buildReportHTML: buildReportHTML, openReport: openReport };
})();
