// optimize/optimizeExplain.js
// 설비조합 최적화 — AI 자연어 설명 (개발기획서 §7-#5)
// 상위 조합에 대해 "왜 추천되는지 / 장단점 / 주의사항"을 건물 특성 + 설비 데이터 근거로 생성.
// 기존 Gemini 프록시(/api/recommend, recommend 기능과 공용)를 재사용한다.
// IIFE 전역. window.OptimizeExplain 노출.
(function () {
  "use strict";

  var SYSTEM_PROMPT =
    "당신은 신재생에너지 설비 설계 전문 컨설턴트입니다. " +
    "주어진 '최적 설비조합'에 대해, 건물 특성과 각 설비의 장단점 데이터에 근거하여 " +
    "왜 이 조합이 추천되는지, 핵심 장점, 유의해야 할 단점, 실무 주의사항을 설명하세요.\n" +
    "[작성 원칙]\n" +
    "- 제공된 설비 장단점·목표값 수치에 근거할 것(임의 추정 금지).\n" +
    "- 수치는 단위와 함께 인용(예: 의무비율 12.5%, 초기비용 8.9억).\n" +
    "- 4~6문장, 컨설팅 보고서 본문체. 인사말·마무리 문구 없이 본문만.\n" +
    "- 과충족(의무비율 대비 과다 설치) 시 비용효율 측면을 지적할 것.";

  // 조합 + 맥락 → 사용자 메시지(프롬프트)
  function buildExplainMessage(card, ctx) {
    var L = [];
    L.push("## 건물 정보");
    if (ctx && ctx.건물유형) L.push("- 건물유형: " + ctx.건물유형);
    if (ctx && ctx.연간단위에너지소요량) L.push("- 연간 에너지소요량: " + Math.round(ctx.연간단위에너지소요량).toLocaleString() + " kWh/yr");
    if (ctx && ctx.의무설치비율기준 != null) L.push("- 의무설치비율 기준: " + ctx.의무설치비율기준 + "%");

    var reg = card.targets.법적규제;
    L.push("\n## 추천 조합 (순위 " + card.rank + ", 종합점수 " + (card.score * 100).toFixed(0) + "점)");
    card.items.forEach(function (it) {
      L.push("- " + it.설비.세부형식 + (it.고정 ? "(" + it.기수 + "기)" : "") + " : " + Math.round(it.용량).toLocaleString() + " kW");
    });

    L.push("\n## 목표값 결과");
    L.push("- 초기비용: " + (card.targets.초기비용 / 1e8).toFixed(2) + "억 원");
    L.push("- 연간 운영순익: " + (card.targets.운영순익 / 1e4).toFixed(0) + "만 원/yr");
    L.push("- 신재생 의무설치비율: " + reg.의무설치비율.toFixed(1) + "% (기준 " + (ctx.의무설치비율기준 != null ? ctx.의무설치비율기준 + "%" : "-") + ")");
    if (reg.전력생산비율 != null) L.push("- 전력생산비율: " + reg.전력생산비율.toFixed(1) + "%");

    L.push("\n## 채택 설비별 특성 (근거 데이터)");
    card.items.forEach(function (it) {
      L.push("### " + it.설비.세부형식);
      if (it.설비.장점) L.push("- 장점: " + it.설비.장점);
      if (it.설비.단점) L.push("- 단점/유의: " + it.설비.단점);
    });
    return L.join("\n");
  }

  // SSE 스트림에서 Gemini 텍스트 누적 추출
  function parseSSEText(raw) {
    var text = "";
    raw.split("\n").forEach(function (line) {
      line = line.trim();
      if (line.indexOf("data:") !== 0) return;
      var json = line.slice(5).trim();
      if (!json || json === "[DONE]") return;
      try {
        var obj = JSON.parse(json);
        var parts = obj && obj.candidates && obj.candidates[0] &&
          obj.candidates[0].content && obj.candidates[0].content.parts;
        // thought(사고과정) 파트는 본문에서 제외하고 실제 답변 텍스트만 누적
        if (parts) parts.forEach(function (p) { if (p.text && !p.thought) text += p.text; });
      } catch (e) { /* 부분 청크는 무시 */ }
    });
    return text;
  }

  // 조합 설명 생성 (Gemini 프록시 호출). 반환: Promise<string>
  async function explain(card, ctx) {
    var userMsg = buildExplainMessage(card, ctx);
    var resp = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userMsg }] }],
        // thinkingBudget:0 — gemini-2.5-flash는 기본 thinking이 켜져 maxOutputTokens 예산을
        //   소진해 본문이 MAX_TOKENS로 잘린다. thinking을 끄고 토큰 여유를 둬 끝까지 작성되게 함.
        generationConfig: { maxOutputTokens: 4096, temperature: 0.6, responseMimeType: "text/plain", thinkingConfig: { thinkingBudget: 0 } }
      })
    });
    if (!resp.ok) {
      var errText = await resp.text();
      throw new Error("AI 설명 생성 실패 (" + resp.status + "): " + errText.slice(0, 200));
    }
    var raw = await resp.text(); // 프록시가 SSE를 그대로 전달
    var text = parseSSEText(raw);
    if (!text) throw new Error("AI 응답이 비어 있습니다.");
    return text.trim();
  }

  window.OptimizeExplain = {
    buildExplainMessage: buildExplainMessage,
    parseSSEText: parseSSEText,
    explain: explain
  };
})();
