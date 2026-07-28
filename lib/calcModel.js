// 검토 계산 순수 함수 모델 — 규모등급 판정·시나리오 구조·엔진 입력 변환 (legacy 검증 로직 이식)

export function calc규모등급(용도별연면적목록 = []) {
  const 주거 = !용도별연면적목록.some(x => x.용도 !== "공동주택");
  if (주거) {
    const apt = 용도별연면적목록.find(x => x.용도 === "공동주택");
    const 세대수 = apt?.세대수 ?? "";
    if (세대수 === "1000세대 이상") return "가";
    if (세대수 === "300세대 이상~1000세대 미만") return "나";
    if (세대수 === "30세대 이상~300세대 미만") return "다";
    if (세대수 === "30세대 미만") return "라";
    return "";
  }
  const 합계 = 용도별연면적목록.reduce((s, x) => s + (Number(x.연면적) || 0), 0);
  if (합계 >= 100000) return "가";
  if (합계 >= 10000) return "나";
  if (합계 >= 3000) return "다";
  return "라";
}

export const EMPTY_SYSTEM = { 에너지원: "", 형식: "", 적용용량: "", 단위에너지생산량: 0, 원별보정계수: 0 };

export function newScenario(altNo) {
  return { id: `ALT-${altNo}`, systems: [{ ...EMPTY_SYSTEM }] };
}

export const EMPTY_INPUT2 = { scenarios: [newScenario(1)] };

export function nextAltNo(scenarios = []) {
  const max = scenarios.reduce((m, sc) => {
    const n = Number(String(sc.id).replace(/^ALT-/, ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return max + 1;
}

export function canCalculate(input1 = {}) {
  const missing = [];
  if (!input1.사업형태) missing.push("사업형태");
  if (!input1.사업연도) missing.push("사업연도");
  if (!input1.대지위치) missing.push("대지위치");
  const rows = input1.용도별연면적목록 ?? [];
  if (!rows.some(r => r.용도 && (Number(r.연면적) || 0) > 0)) missing.push("용도별 연면적");
  return { ok: missing.length === 0, missing };
}

export function buildEngineInput2(scenarios = []) {
  return {
    scenarios: scenarios.map(sc => ({
      ...sc,
      systems: sc.systems.map(s => ({ ...s, 적용용량: Number(s.적용용량) || 0 })),
    })),
  };
}

export function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return Number(n).toLocaleString("ko-KR");
}
