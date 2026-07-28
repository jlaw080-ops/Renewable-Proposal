"use client";
import { loadScriptOnce } from "@/lib/scriptLoader";

export async function loadOptimizeExtras() {
  await loadScriptOnce("/optimize/optimizeExplain.js");
  await loadScriptOnce("/optimize/optimizeReport.js");
  if (!window.OptimizeExplain || !window.OptimizeReport) {
    throw new Error("최적화 부가 모듈 로드 실패");
  }
}

export async function explainCard(card, ctx) {
  await loadOptimizeExtras();
  return window.OptimizeExplain.explain(card, ctx);
}

export async function openComboReport(r, ctx, explains, memos) {
  await loadOptimizeExtras();
  window.OptimizeReport.openReport(r, ctx, explains, memos);
}
