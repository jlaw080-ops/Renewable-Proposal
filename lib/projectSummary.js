// lib/projectSummary.js — 대시보드 요약용 순수 함수 (파생값 저장 없음)
const ORDER = ["info", "calc", "optimize", "report"];

// output2(엔진 출력 배열)에서 대표 ALT = 설치비율 최대 (동률이면 앞 순서)
export function pickRepresentative(output2) {
  if (!Array.isArray(output2) || output2.length === 0) return null;
  return output2.reduce((best, alt) => (alt.비율 > best.비율 ? alt : best));
}

// 첫 미완료(done 아님) 단계 — 전부 완료면 report
export function nextSegment(statuses) {
  return ORDER.find(seg => statuses[seg] !== "done") ?? "report";
}

// 판정 표시 문법 — Output2Panel과 동일
export const VERDICT_UI = {
  Yes: { tone: "pass", label: "만족", sym: "✓" },
  No: { tone: "fail", label: "불만족", sym: "✕" },
  해당없음: { tone: "na", label: "해당없음", sym: "–" },
};
