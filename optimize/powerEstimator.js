// optimize/powerEstimator.js
// 연간 예상 전력소비량 산정 — 원단위 간이법 (개발기획서 §9.1 안A)
//   연간예상전력소비량(kWh/yr) = Σ_용도 [ 전력원단위(건물유형) × 연면적 ]
// 전력생산비율 제약(§5.2)의 분모로 사용된다.
//
// 의존성: data/전력원단위라이브러리.js (window.LIB_전력원단위)
// IIFE 전역. window.PowerEstimator 노출.
(function () {
  "use strict";

  function getLib() {
    return (typeof window !== "undefined" && window.LIB_전력원단위) || [];
  }

  function 원단위(건물유형) {
    var row = getLib().filter(function (r) { return r.건물유형 === 건물유형; })[0];
    return row ? row.전력원단위 : null;
  }

  function 유형목록() {
    return getLib().map(function (r) { return r.건물유형; });
  }

  // items: [{ 건물유형, 연면적 }]  (복합용도는 용도별 행으로 분리 입력)
  // 반환: { 연간예상전력소비량, 내역:[{건물유형, 연면적, 원단위, 소비량}], 경고:[...] }
  function estimate(items) {
    var 총합 = 0, 내역 = [], 경고 = [];
    (items || []).forEach(function (it) {
      var u = 원단위(it.건물유형);
      var 면적 = it.연면적 || 0;
      if (u == null) {
        경고.push("전력 원단위 미정의 건물유형: '" + it.건물유형 + "' → 0 처리");
        내역.push({ 건물유형: it.건물유형, 연면적: 면적, 원단위: null, 소비량: 0 });
        return;
      }
      var 소비량 = u * 면적;
      총합 += 소비량;
      내역.push({ 건물유형: it.건물유형, 연면적: 면적, 원단위: u, 소비량: 소비량 });
    });
    return { 연간예상전력소비량: 총합, 내역: 내역, 경고: 경고 };
  }

  window.PowerEstimator = {
    원단위: 원단위,
    유형목록: 유형목록,
    estimate: estimate
  };
})();
