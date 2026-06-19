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
    ".explain{margin:10px 0;padding:10px 12px;background:#f9fafb;border-left:3px solid #10b981;border-radius:4px}" +
    ".explain p{margin:4px 0 0;white-space:pre-wrap}" +
    ".footer{margin-top:28px;padding-top:12px;border-top:1px solid #ddd;color:#888;font-size:11px}" +
    "button.noprint{margin-top:20px;padding:10px 20px;background:#10b981;color:#fff;border:none;" +
    "border-radius:6px;font-size:13px;cursor:pointer}" +
    "@media print{button.noprint{display:none}body{padding:0}}";

  function 조건표(ctx) {
    ctx = ctx || {};
    var 면적 = ctx.면적 || {};
    function v(x, u) { return x == null ? "—" : x.toLocaleString() + (u || ""); }
    var 요구 = ctx.요구도 || {};
    var 요구문 = ["초기비용", "운영비", "인센티브", "디자인", "시공성", "의무근접"]
      .map(function (k) { return k + ":" + (요구[k] || "보통"); }).join(", ");
    return "<table><tbody>" +
      "<tr><th>건물유형</th><td class='l'>" + escapeHtml(ctx.건물유형 || "—") + "</td>" +
      "<th>연간 에너지소요량</th><td class='l'>" + v(ctx.연간단위에너지소요량, " kWh/yr") + "</td></tr>" +
      "<tr><th>의무설치비율 기준</th><td class='l'>" + v(ctx.의무설치비율기준, "%") + "</td>" +
      "<th>전력생산비율 기준</th><td class='l'>" + v(ctx.전력생산비율기준, "%") + "</td></tr>" +
      "<tr><th>예상 전력소비량</th><td class='l'>" + v(ctx.연간예상전력소비량, " kWh/yr") + "</td>" +
      "<th>가용면적(옥상/외피/대지/기계실)</th><td class='l'>" +
      v(면적.옥상) + " / " + v(면적.외피) + " / " + v(면적.대지) + " / " + v(면적.기계실) + " ㎡</td></tr>" +
      "<tr><th>사용자 요구도</th><td class='l' colspan='3'>" + escapeHtml(요구문) + "</td></tr>" +
      "</tbody></table>";
  }

  function 순위표(r) {
    var rows = r.ranked.slice(0, 5).map(function (f) {
      var reg = f.targets.법적규제;
      var sys = f.items.map(function (it) {
        return escapeHtml(it.설비.세부형식) + (it.고정 ? "(" + it.기수 + "기)" : "") +
          " " + Math.round(it.용량).toLocaleString() + "kW";
      }).join("<br>");
      return "<tr" + (f.rank === 1 ? " class='best'" : "") + "><td>" + f.rank + "</td>" +
        "<td class='l'>" + sys + "</td><td>" + 억(f.targets.초기비용) + "억</td>" +
        "<td>" + (f.targets.운영순익 / 1e4).toFixed(0) + "만</td>" +
        "<td>" + reg.의무설치비율.toFixed(1) + "%</td>" +
        "<td>" + (reg.전력생산비율 != null ? reg.전력생산비율.toFixed(1) + "%" : "—") + "</td>" +
        "<td>" + (f.score * 100).toFixed(0) + "</td></tr>";
    }).join("");
    return "<table><thead><tr><th>순위</th><th>설비조합 (용량)</th><th>초기비용</th>" +
      "<th>연간순익</th><th>의무비율</th><th>전력생산</th><th>점수</th></tr></thead><tbody>" +
      rows + "</tbody></table>";
  }

  function buildReportHTML(r, ctx, explains) {
    var now = new Date().toLocaleString("ko-KR");
    var explainHTML = "";
    r.ranked.slice(0, 5).forEach(function (f) {
      if (explains && explains[f.rank]) {
        explainHTML += "<div class='explain'><h3>순위 " + f.rank + " — AI 분석</h3><p>" +
          escapeHtml(explains[f.rank]) + "</p></div>";
      }
    });
    return "<!DOCTYPE html><html lang='ko'><head><meta charset='utf-8'>" +
      "<title>신재생에너지 설비조합 최적화 보고서</title><style>" + CSS + "</style></head><body>" +
      "<h1>신재생에너지 설비조합 최적화 보고서</h1>" +
      "<div class='meta'>생성일시: " + escapeHtml(now) +
      " · 실행가능 " + r.실행가능건수 + "개 조합 / 평가 " + r.평가건수 + "건</div>" +
      "<h2>1. 입력 조건</h2>" + 조건표(ctx) +
      "<h2>2. 최적 설비조합 순위</h2>" + 순위표(r) +
      (explainHTML ? "<h2>3. AI 분석 의견</h2>" + explainHTML : "") +
      "<div class='footer'>※ 전력 원단위는 잠정 추정값이며 실측·공인 통계에 의한 확정이 필요합니다.<br>" +
      "※ 본 보고서는 의사결정 참고용이며, 최종 설계는 현장 여건·법적 검토를 반영해야 합니다.</div>" +
      "<button class='noprint' onclick='window.print()'>인쇄 / PDF 저장</button>" +
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
