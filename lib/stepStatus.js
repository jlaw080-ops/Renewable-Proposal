// 워크스페이스 단계 완료 판정 (표시 전용 파생값, 스키마 무변경)
import { canCalculate } from "./calcModel.js";

export function stepStatuses(project, activeSegment) {
  const d = project?.data ?? {};
  const done = {
    info: canCalculate(d.input1 ?? {}).ok,
    calc: !!d.input2?.scenarios?.some(sc =>
      (sc.systems ?? []).some(s => s.에너지원 && s.형식 && Number(s.적용용량) > 0)),
    optimize: d.input3 != null,
    report: !!d.review?.text,
  };
  const out = {};
  for (const seg of ["info", "calc", "optimize", "report"])
    out[seg] = seg === activeSegment ? "active" : (done[seg] ? "done" : "todo");
  return out;
}
