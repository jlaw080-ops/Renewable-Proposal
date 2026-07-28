"use client";
import Button from "@/components/ui/Button";

export default function RecommendPanel({ status, aiResult, error, onRun, onOpenConstraints, constraintsLabel, disabled }) {
  return (
    <div className="rp">
      <div className="rp__head">
        <Button variant="brand" onClick={onRun} disabled={disabled || status === "loading"}>
          {status === "loading" ? "AI 평가 중…" : "AI 추천 받기"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onOpenConstraints}>제약조건</Button>
        <span className="rp__hint">{constraintsLabel}</span>
        {status === "loading" && <span className="rp__hint">Gemini가 상위 후보를 정성 평가하고 있습니다…</span>}
        {error && <span className="rp__error" role="status">{error}</span>}
      </div>
      {aiResult?.summary && (
        <p className="rp__summary"><b>AI 총평:</b> {aiResult.summary}</p>
      )}
    </div>
  );
}
