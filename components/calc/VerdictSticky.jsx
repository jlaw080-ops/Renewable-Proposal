"use client";
import Badge from "@/components/ui/Badge";
import { pickRepresentative, VERDICT_UI } from "@/lib/projectSummary";
import "./verdictSticky.css";

export default function VerdictSticky({ output2 }) {
  const rep = pickRepresentative(output2);
  if (!rep) return null;
  const ui = VERDICT_UI[rep.만족여부] ?? VERDICT_UI.해당없음;
  const others = (output2?.length ?? 0) - 1;
  return (
    <div className={`vsticky vsticky--${ui.tone}`} role="status" aria-live="polite">
      <span className="vsticky__id mono">{rep.id}</span>
      <strong className="vsticky__ratio mono">{rep.비율.toFixed(1)}%</strong>
      <span className="vsticky__req">의무 {rep.의무비율 !== null ? `${rep.의무비율}%` : "-"}</span>
      <Badge tone={ui.tone}>{ui.sym} {ui.label}</Badge>
      {others > 0 && <span className="vsticky__more">외 {others}개</span>}
    </div>
  );
}
