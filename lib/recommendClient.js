"use client";

let promptScript = null;

export function loadRecommendPrompt() {
  if (typeof window !== "undefined" && window.RecommendPrompt) return Promise.resolve();
  if (!promptScript) {
    promptScript = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/recommend/recommendPrompt.js";
      s.async = true;
      s.onload = () => (window.RecommendPrompt ? resolve() : reject(new Error("RecommendPrompt 초기화 실패")));
      s.onerror = () => reject(new Error("recommendPrompt.js 로드 실패"));
      document.head.appendChild(s);
    });
    promptScript.catch(() => { promptScript = null; });
  }
  return promptScript;
}

export function buildCandidates(ranked = [], topN = 10) {
  return ranked.slice(0, topN).map((f, i) => ({ cid: i + 1, f }));
}

export async function requestRecommend({ ctx, candidates }) {
  await loadRecommendPrompt();
  const userMessage = window.RecommendPrompt.buildEvalMessage(ctx, candidates, {}); // legacy 함수가 constraints 필드를 널 가드 없이 읽음 — 빈 객체 전달
  const resp = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: window.RecommendPrompt.SYSTEM_PROMPT ?? "" }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      // thinking 토큰이 출력 예산을 잠식해 JSON이 절단되는 것을 방지 (2.5-flash 기본 thinking on)
      generationConfig: { maxOutputTokens: 8192, temperature: 0.7, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!resp.ok) {
    let detail = "";
    try { detail = (await resp.json()).error ?? ""; } catch { /* 스트림 아님 */ }
    throw new Error(detail || `AI 추천 요청 실패 (${resp.status})`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", accumulated = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const raw of lines) {
      const ln = raw.trim();
      if (!ln.startsWith("data: ")) continue;
      const payload = ln.slice(6).trim();
      if (payload === "[DONE]") continue;
      try {
        const d = JSON.parse(payload);
        const parts = d.candidates?.[0]?.content?.parts;
        if (parts) for (const p of parts) { if (!p.thought && p.text) accumulated += p.text; }
      } catch { /* 불완전 청크 무시 */ }
    }
  }
  let jsonStr = accumulated.trim();
  const bs = jsonStr.indexOf("{"), be = jsonStr.lastIndexOf("}");
  if (bs >= 0 && be > bs) jsonStr = jsonStr.slice(bs, be + 1);
  const parsed = JSON.parse(jsonStr);
  return {
    best_pick: parsed.best_pick,
    ai_ranking: parsed.ai_ranking ?? [],
    summary: parsed.summary ?? parsed.comparison ?? "",
  };
}
