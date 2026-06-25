// settings/settingsStore.js
// 설비조합 최적화 + 계산 라이브러리 설정 저장소 (localStorage 오버라이드 레이어)
//
// 동작 원리:
//   data/*.js 가 window.LIB_* 전역(원본)을 정의한 직후 본 스크립트가 로드되어
//   apply() 를 즉시 호출한다. apply() 는 (1) 현재 window 값을 "기본값"으로 스냅샷하고
//   (2) localStorage 에 저장된 사용자 오버라이드가 있으면 window 전역을 통째로 교체한다.
//   엔진/계산 로직은 모두 호출 시점에 window.LIB_*·window.OPT_CONFIG 를 읽으므로
//   저장 즉시 다음 계산·최적화에 반영된다. "기본값 복원"은 스냅샷을 되돌린다.
//
// IIFE 전역. window.SettingsStore 노출. (file:// 호환)
(function () {
  "use strict";

  var LS_PREFIX = "optset:";        // localStorage 키 접두사
  var CONFIG_KEY = "__config";      // OPT_CONFIG 저장 키

  // ── 최적화 가중치·상수 기본값 (코드에 흩어져 있던 상수의 단일 출처) ──────────
  //   연료전지최대기수  optimizer.generateCombinations — 대용량 연료전지 최대 기수
  //   외피층고          optimizeUI.외피면적 — 예상 외피면적 산정 층고(m)
  //   요구도점수        optimizer.deriveWeights / optimizeUI.autoLoadRequirements 가중치 점수
  //                     (건물유형별 사용자 요구도와 동일한 5등급 척도)
  //   등급점수          targetCalculator.등급점수 — 정성 5단계 등급 → 점수
  var DEFAULT_OPT_CONFIG = {
    연료전지최대기수: 2,
    외피층고: 3.5,
    경관보정사용: true,   // 지자체·에너지원별 경관계수를 디자인 목적함수에 적용할지(targetCalculator)
    법규제약사용: true,   // 법적심의 제약(건축심의+환경영향평가) 매트릭스를 「법규제약」 차원에 적용할지(targetCalculator)
    건물적합도사용: true, // 건물유형별 신재생에너지원 적합도를 「건물적합」 차원에 적용할지(targetCalculator)
    건물적합가중배수: 2,  // optimizer.deriveWeights — 「건물적합」 가중치를 다른 인자 대비 상향하는 배수(1=동등)
    적합매우낮음제외: true, // optimizer.generateCombinations — 건물유형 적합성 「매우낮음」 에너지원을 추천 조합에서 완전 배제
    적합표시하한등급: "보통", // optimizer — 조합의 건물적합 적합도가 이 등급 미만이면 화면 표시 제외(평가는 유지). 저적합 설비 위주 조합 숨김
    요구도점수: { "매우높음": 5, "높음": 4, "보통": 3, "낮음": 2, "매우낮음": 1 },
    // 의무근접허용오차: optimizer — 의무근접 요구도 등급별 최종 의무설치비율의 기준 대비 허용 상한(%p).
    //   '매우높음'=±0.5%p 밀착, 하위 등급 점증 완화, '매우낮음'=null(무제한). 하한은 법적 의무라 항상 기준 이상.
    의무근접허용오차: { "매우높음": 0.5, "높음": 1.5, "보통": 3.0, "낮음": 6.0, "매우낮음": null },
    등급점수: { "매우높음": 5, "높음": 4, "보통": 3, "낮음": 2, "매우낮음": 1 },
    // 제약요인가중치: 법적심의 제약 9요인의 상대 가중(입지·건물유형에 따라 중요 요인 강조). 기본 균등(1).
    //   별도 계수표 없이 매트릭스 등급은 등급점수 척도를 그대로 재사용(targetCalculator.계산제약).
    제약요인가중치: {
      경관디자인: 1, 빛반사빛공해: 1, 일조장해: 1, 소음진동: 1, 생태면적률: 1,
      지형지질: 1, 수환경: 1, 동식물상: 1, 구조안전: 1
    }
  };

  // ── 라이브러리 레지스트리 ──────────────────────────────────────────────────
  // shape: 'array' = 객체 배열 / 'map' = 키→객체 맵
  // group: 'optimize' = 최적화 전용 / 'calc' = 기존 계산 공용
  var LIBS = [
    { key: "설비최적화",   global: "LIB_설비최적화",          label: "설비 최적화 데이터셋 (8설비 × ⓐ~ⓡ)", shape: "array", group: "optimize" },
    { key: "요구도",       global: "LIB_요구도",              label: "건물유형별 사용자 요구도",            shape: "array", group: "optimize" },
    { key: "건물적합도",   global: "LIB_건물적합도",          label: "건물유형별 신재생에너지원 적합도 (5등급)", shape: "array", group: "optimize" },
    { key: "전력원단위",   global: "LIB_전력원단위",          label: "건물유형별 전력 원단위 ⚠잠정값",      shape: "array", group: "optimize" },
    { key: "경관민감도",   global: "LIB_경관민감도",          label: "경관 민감도 (지자체별)",              shape: "map",   group: "optimize" },
    { key: "경관영향",     global: "LIB_경관영향",            label: "경관 영향 (에너지원별)",              shape: "map",   group: "optimize" },
    { key: "제약가중치",   global: "LIB_제약가중치",          label: "법적심의 제약 매트릭스 (건축심의+환경영향평가, 9요인)", shape: "map", group: "optimize" },
    { key: "신재생계수",   global: "LIB_신재생에너지계수",    label: "신재생에너지 계수 (단위생산량·보정계수)", shape: "array", group: "calc" },
    { key: "지역계수",     global: "LIB_지역계수",            label: "지역계수 (17개 시도)",                shape: "map",   group: "calc" },
    { key: "단위에너지",   global: "LIB_단위에너지사용량",    label: "건축물 종류별 단위에너지사용량",      shape: "array", group: "calc" },
    { key: "의무비율",     global: "LIB_의무비율",            label: "의무설치비율 (지역·연도·등급)",       shape: "map",   group: "calc" }
  ];

  var _defaults = {};  // key → 원본 스냅샷(deep clone). CONFIG_KEY 포함.

  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  function readLS(key) {
    try {
      var raw = localStorage.getItem(LS_PREFIX + key);
      return raw == null ? null : JSON.parse(raw);
    } catch (e) { return null; }
  }
  function writeLS(key, data) {
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }
  function removeLS(key) {
    try { localStorage.removeItem(LS_PREFIX + key); } catch (e) {}
  }

  // 2단계 병합: 최상위 + 중첩 점수맵(요구도점수·등급점수). 저장본의 누락 키는 기본값으로 보완.
  function mergeConfig(base, override) {
    var o = clone(base);
    if (!override) return o;
    Object.keys(override).forEach(function (k) {
      if (o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) &&
          override[k] && typeof override[k] === "object") {
        Object.keys(override[k]).forEach(function (kk) { o[k][kk] = override[k][kk]; });
      } else {
        o[k] = override[k];
      }
    });
    return o;
  }

  // 로드 직후 1회 호출. 원본 스냅샷 → 오버라이드 적용.
  function apply() {
    _defaults[CONFIG_KEY] = clone(DEFAULT_OPT_CONFIG);
    window.OPT_CONFIG = mergeConfig(DEFAULT_OPT_CONFIG, readLS(CONFIG_KEY));

    LIBS.forEach(function (reg) {
      _defaults[reg.key] = clone(window[reg.global]);
      var ov = readLS(reg.key);
      if (ov != null) window[reg.global] = ov;
    });
  }

  // ── 조회 ────────────────────────────────────────────────────────────────
  function list() { return LIBS.slice(); }
  function meta(key) { return LIBS.filter(function (r) { return r.key === key; })[0] || null; }
  function getLib(key) { var m = meta(key); return m ? window[m.global] : null; }
  function getDefaultLib(key) { return clone(_defaults[key]); }
  function getConfig() { return mergeConfig(DEFAULT_OPT_CONFIG, readLS(CONFIG_KEY)); }
  function getDefaultConfig() { return clone(DEFAULT_OPT_CONFIG); }
  function isLibOverridden(key) { return readLS(key) != null; }
  function isConfigOverridden() { return readLS(CONFIG_KEY) != null; }

  // ── 저장·복원 ────────────────────────────────────────────────────────────
  function saveLib(key, data) {
    var m = meta(key);
    if (!m) return false;
    if (!writeLS(key, data)) return false;
    window[m.global] = data;
    return true;
  }
  function resetLib(key) {
    var m = meta(key);
    if (!m) return;
    removeLS(key);
    window[m.global] = clone(_defaults[key]);
  }
  function saveConfig(cfg) {
    var merged = mergeConfig(DEFAULT_OPT_CONFIG, cfg);
    if (!writeLS(CONFIG_KEY, merged)) return false;
    window.OPT_CONFIG = merged;
    return true;
  }
  function resetConfig() {
    removeLS(CONFIG_KEY);
    window.OPT_CONFIG = clone(DEFAULT_OPT_CONFIG);
  }
  function resetAll() {
    resetConfig();
    LIBS.forEach(function (r) { resetLib(r.key); });
  }

  // ── 내보내기·가져오기 (백업/공유용 단일 JSON) ──────────────────────────────
  function exportAll() {
    var out = { config: getConfig(), libs: {} };
    LIBS.forEach(function (r) { out.libs[r.key] = clone(window[r.global]); });
    return JSON.stringify(out, null, 2);
  }
  function importAll(json) {
    var obj = (typeof json === "string") ? JSON.parse(json) : json;
    if (obj.config) saveConfig(obj.config);
    if (obj.libs) Object.keys(obj.libs).forEach(function (k) {
      if (meta(k)) saveLib(k, obj.libs[k]);
    });
  }

  window.SettingsStore = {
    apply: apply,
    list: list, meta: meta,
    getLib: getLib, getDefaultLib: getDefaultLib,
    getConfig: getConfig, getDefaultConfig: getDefaultConfig,
    isLibOverridden: isLibOverridden, isConfigOverridden: isConfigOverridden,
    saveLib: saveLib, resetLib: resetLib,
    saveConfig: saveConfig, resetConfig: resetConfig, resetAll: resetAll,
    exportAll: exportAll, importAll: importAll
  };

  // 데이터 라이브러리가 모두 로드된 직후(head) 즉시 적용.
  apply();
})();
