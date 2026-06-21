// optimize/targetCalculator.js
// 목표값(Target Value) 계산 모듈 — 개발기획서 §5
// 조합 + 용량이 주어졌을 때 6개 목표값(비용2·인센티브·디자인·시공성·법적규제)을 산출한다.
// 정규화·가중합 순위화(§6.2[4])는 최적화 엔진이 담당하며, 본 모듈은 "원시 목표값"만 반환한다.
//
// IIFE 전역 패턴 (map/·recommend/ 와 동일, file:// 호환). window.TargetCalculator 노출.
//
// 용어: items = [{ 설비, 용량 }]  (설비 = window.LIB_설비최적화 항목, 용량 단위 kW)
(function () {
  "use strict";

  // ── 정성 등급 → 수치 매핑 (§6.4) ────────────────────────────────
  // 설정값(window.OPT_CONFIG.등급점수, settings/settingsStore.js)을 호출 시점에 읽는다.
  var 기본등급점수표 = { "매우높음": 5, "높음": 4, "보통": 3, "낮음": 2, "매우낮음": 1 };

  function 등급점수(등급) {
    var 표 = (typeof window !== "undefined" && window.OPT_CONFIG && window.OPT_CONFIG.등급점수) || 기본등급점수표;
    return 표.hasOwnProperty(등급) ? 표[등급] : 3; // 미상 등급은 보통(3)
  }
  // 역방향 지표(디자인훼손·외부공간차지·공사기간·난이도): 낮을수록 좋음 → "좋음점수"로 반전
  // 반전 기준은 등급점수 척도의 (최댓값+최솟값) — 기본 5+1=6. 척도 변경 시에도 정합 유지.
  function 좋음점수_역방향(등급) {
    var 표 = (typeof window !== "undefined" && window.OPT_CONFIG && window.OPT_CONFIG.등급점수) || 기본등급점수표;
    var vals = Object.keys(표).map(function (k) { return 표[k]; });
    var base = Math.max.apply(null, vals) + Math.min.apply(null, vals);
    return base - 등급점수(등급);
  }

  // ── 비용 (§5.1) ─────────────────────────────────────────────────
  // 초기비용 = Σ ⓓ·C  (부대시설비·시공설치비는 원본 미제공 → 장비비 기준. 보강 시 여기 확장)
  // 운영순익 = Σ ⓛ·C
  function 계산비용(items) {
    var 초기비용 = 0, 운영순익 = 0;
    items.forEach(function (it) {
      초기비용 += it.설비.d_장비비 * it.용량;
      운영순익 += it.설비.l_순익 * it.용량;
    });
    return { 초기비용: 초기비용, 운영순익: 운영순익 };
  }

  // ── 설치면적 (설치공간별 분리 집계) ─────────────────────────────
  // 면적 제약(§6.1): 옥상/외피=PV, 대지=지열, 기계실=연료전지
  function 계산설치면적(items) {
    var area = { 옥상: 0, 외피: 0, 대지: 0, 기계실: 0, 합계: 0 };
    items.forEach(function (it) {
      var a = it.설비.m_설치면적 * it.용량;
      var 공간 = it.설비.설치공간;
      if (!area.hasOwnProperty(공간)) area[공간] = 0;
      area[공간] += a;
      area.합계 += a;
    });
    return area;
  }

  // ── 법적규제 (§5.2) ─────────────────────────────────────────────
  // ctx = { 연간단위에너지소요량, 의무설치비율기준, 연간예상전력소비량, 전력생산비율기준 }
  //   - 의무설치비율 = Σ(ⓒ·C) / 연간단위에너지소요량 × 100  ≥ 기준
  //   - 전력생산비율 = Σ(ⓕ·C, 발전가능) / 연간예상전력소비량 × 100  ≥ 기준
  //     (분모 연간예상전력소비량은 §9.1 개발 항목 — 미제공 시 null 반환하고 제약 미적용)
  function 계산법적규제(items, ctx) {
    ctx = ctx || {};
    var 의무생산량 = 0, 발전량 = 0;
    items.forEach(function (it) {
      의무생산량 += it.설비.c_연간단위에너지생산량 * it.용량;
      if (it.설비.발전가능) 발전량 += it.설비.f_연간발전량 * it.용량;
    });

    var 의무설치비율 = ctx.연간단위에너지소요량 > 0
      ? (의무생산량 / ctx.연간단위에너지소요량) * 100
      : 0;

    var 전력생산비율 = (ctx.연간예상전력소비량 > 0)
      ? (발전량 / ctx.연간예상전력소비량) * 100
      : null;

    var eps = 1e-6; // LP 경계해의 부동소수 오차 허용 (예 9.99999% 를 10% 충족으로 인정)
    return {
      의무생산량: 의무생산량,
      발전량: 발전량,
      의무설치비율: 의무설치비율,
      의무설치비율_충족: (ctx.의무설치비율기준 != null)
        ? 의무설치비율 >= ctx.의무설치비율기준 - eps : null,
      전력생산비율: 전력생산비율,
      전력생산비율_충족: (전력생산비율 != null && ctx.전력생산비율기준 != null)
        ? 전력생산비율 >= ctx.전력생산비율기준 - eps : null
    };
  }

  // ── 경관계수 (지자체별 경관민감도 × 에너지원별 경관영향) ─────────
  // 근거: 0619_지자체_건축심사기준_신재생_조사.md §2.1·§3. window.LIB_경관민감도/영향 + OPT_CONFIG.경관보정사용.
  //   계수 = 1 + 민감도(지자체) × 영향(세부형식). 보정 비활성/지자체 미상/영향0 이면 1(불변).
  function 경관계수(ctx, 세부형식) {
    var cfg = (typeof window !== "undefined" && window.OPT_CONFIG) || {};
    if (cfg.경관보정사용 === false) return 1;
    var 지자체 = ctx && ctx.지자체;
    var 민감맵 = (typeof window !== "undefined" && window.LIB_경관민감도) || {};
    var 영향맵 = (typeof window !== "undefined" && window.LIB_경관영향) || {};
    var 민감 = (지자체 && 민감맵[지자체] && 민감맵[지자체].민감도 != null) ? 민감맵[지자체].민감도 : 0;
    var 영향 = (영향맵[세부형식] && 영향맵[세부형식].영향 != null) ? 영향맵[세부형식].영향 : 0;
    return 1 + 민감 * 영향;
  }
  function 등급범위() {
    var 표 = (typeof window !== "undefined" && window.OPT_CONFIG && window.OPT_CONFIG.등급점수) || 기본등급점수표;
    var v = Object.keys(표).map(function (k) { return 표[k]; });
    return { min: Math.min.apply(null, v), max: Math.max.apply(null, v) };
  }

  // ── 정성 목표값 (§5 #3·#4·#5, §6.4) ─────────────────────────────
  // 용량가중 "좋음점수"(1~5) 평균. 디자인·시공성은 최소화(훼손) 지표라 역방향 반전.
  // 인센티브(§5 #3)는 현재 ⓝ(ZEB기여도) 기반 proxy — 정밀 용적률% 매핑은 ECO2 연계(P6).
  // 디자인은 경관계수로 보정: 보정 = gmax − (gmax − 기본) × 계수 (강한 지자체일수록 BAPV 패널티↑), [gmin,gmax] 클램프.
  function 계산정성(items, ctx) {
    var totC = items.reduce(function (s, it) { return s + it.용량; }, 0);
    if (totC <= 0) return { ZEB: 0, 디자인: 0, 시공성: 0, 인센티브: 0 };

    var rng = 등급범위();
    var ZEB = 0, 디자인 = 0, 시공성 = 0;
    items.forEach(function (it) {
      var s = it.설비, C = it.용량;
      ZEB += 등급점수(s.n_ZEB기여도) * C;
      var baseD = (좋음점수_역방향(s.o_디자인훼손도) + 좋음점수_역방향(s.p_외부공간차지도)) / 2;
      var adjD = rng.max - (rng.max - baseD) * 경관계수(ctx, s.세부형식);
      if (adjD < rng.min) adjD = rng.min;
      if (adjD > rng.max) adjD = rng.max;
      디자인 += adjD * C;
      시공성 += (좋음점수_역방향(s.q_공사기간) + 좋음점수_역방향(s.r_공사난이도)) / 2 * C;
    });
    var zebAvg = ZEB / totC;
    return { ZEB: zebAvg, 디자인: 디자인 / totC, 시공성: 시공성 / totC, 인센티브: zebAvg };
  }

  // ── 통합 평가 ───────────────────────────────────────────────────
  function 평가조합(items, ctx) {
    var 비용 = 계산비용(items);
    return {
      초기비용: 비용.초기비용,
      운영순익: 비용.운영순익,
      설치면적: 계산설치면적(items),
      법적규제: 계산법적규제(items, ctx),
      정성: 계산정성(items, ctx)
    };
  }

  window.TargetCalculator = {
    등급점수: 등급점수,
    좋음점수_역방향: 좋음점수_역방향,
    계산비용: 계산비용,
    계산설치면적: 계산설치면적,
    계산법적규제: 계산법적규제,
    계산정성: 계산정성,
    경관계수: 경관계수,
    평가조합: 평가조합
  };
})();
