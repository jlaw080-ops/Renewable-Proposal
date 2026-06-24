// recommend/recommendEngine.js
// AI 추천 = "AI 정성평가 vs 최적화 알고리즘" 비교 도구.
//   최적화 엔진(optimizer.js)이 동일한 입력·조건으로 feasible 후보를 생성(조합수·제약 동일)하고,
//   ① 알고리즘 평가(8차원 가중합 순위)와 ② AI(Gemini) 정성평가 순위를 같은 후보 위에서 비교한다.
(function() {
  "use strict";

  var TOP_N = 10;   // AI에 넘겨 평가할 후보 수(알고리즘 상위)

  // 소프트 조건(예산·제외·지하철·자유텍스트)만 모달에서 수집. 면적·요구도는 ctx(최적화 공유)에 있음.
  function val(id) { var el = document.getElementById(id); return el ? (el.value || "").trim() : ""; }
  function getExcludedSources() {
    var excluded = [];
    document.querySelectorAll(".constraint-exclude-cb:checked").forEach(function(cb) { excluded.push(cb.value); });
    return excluded;
  }
  function collectConstraints() {
    return {
      solarNote: val("constraint-solar-note"),
      nearSubway: (function () { var e = document.getElementById("constraint-subway-yes"); return e ? e.checked : false; })(),
      geothermalNote: val("constraint-geo-note"),
      fuelCellNote: val("constraint-fuel-note"),
      budgetMin: parseFloat(val("constraint-budget-min")) || 0,
      budgetMax: parseFloat(val("constraint-budget-max")) || 0,
      excludeSources: getExcludedSources(),
      customConstraints: val("constraint-custom")
    };
  }

  // 최적화 탭과 동일한 조건(ctx) 확보. 최적화 탭 미입력 시 사업정보 계산결과(Output1/2)로 보완.
  function ensureCtx() {
    var ctx = (window.OptimizeUI && window.OptimizeUI.getConditions) ? window.OptimizeUI.getConditions() : {};
    if (!(ctx.연간단위에너지소요량 > 0) && window.LAST_OUTPUT1 && window.LAST_OUTPUT1.총예상에너지사용량 > 0) {
      ctx.연간단위에너지소요량 = Math.round(window.LAST_OUTPUT1.총예상에너지사용량);
    }
    if (ctx.의무설치비율기준 == null && window.LAST_OUTPUT2 && window.LAST_OUTPUT2[0] && window.LAST_OUTPUT2[0].의무비율 != null) {
      ctx.의무설치비율기준 = window.LAST_OUTPUT2[0].의무비율;
    }
    return ctx;
  }

  // 후보 풀: 알고리즘 순위 상위 N. 제외 선호 에너지원이 포함된 조합은 풀에서 배제(두 평가 동일 풀).
  function buildCandidates(ranked, constraints) {
    var 제외 = constraints.excludeSources || [];
    var filtered = ranked.filter(function(f) {
      return !f.items.some(function(it) {
        return 제외.indexOf(it.설비.형식) >= 0 || 제외.indexOf(it.설비.세부형식) >= 0;
      });
    });
    return filtered.slice(0, TOP_N).map(function(f, i) { return { cid: i + 1, f: f }; });
  }

  function sysText(f) {
    return f.items.map(function(it) {
      return it.설비.세부형식 + " " + Math.round(it.용량).toLocaleString() + "kW";
    }).join(" + ");
  }

  async function runComparison() {
    var resultArea = document.getElementById("recommend-result");
    var btn = document.getElementById("btn-run-recommend");

    if (!window.Optimizer || !window.OptimizeUI) {
      resultArea.innerHTML = '<div class="recommend-error">최적화 엔진 미로드.</div>'; return;
    }
    var ctx = ensureCtx();
    if (!(ctx.연간단위에너지소요량 > 0) || ctx.의무설치비율기준 == null) {
      resultArea.innerHTML = '<div class="recommend-error">먼저 사업정보를 입력하고 「설비조합 최적화」 탭의 법적규제 기준(에너지소요량·의무비율)을 확인해주세요. (계산 시 자동 연동)</div>';
      return;
    }

    // ① 최적화 엔진 실행 — 동일 입력·조건으로 후보 생성 + 알고리즘 순위
    var optResult;
    try { optResult = window.Optimizer.optimize(ctx); }
    catch (e) { resultArea.innerHTML = '<div class="recommend-error">최적화 실행 오류: ' + escapeHtml(e.message) + '</div>'; return; }
    if (!optResult.ranked || !optResult.ranked.length) {
      resultArea.innerHTML = '<div class="recommend-error">조건을 충족하는 조합이 없습니다. 가용면적·기준을 완화해 보세요. (평가 ' + optResult.평가건수 + '건)</div>';
      return;
    }

    var constraints = collectConstraints();
    var candidates = buildCandidates(optResult.ranked, constraints);
    if (!candidates.length) {
      resultArea.innerHTML = '<div class="recommend-error">제외 조건 적용 후 남은 후보가 없습니다.</div>'; return;
    }

    // ② AI 정성평가 (같은 후보를 순위화)
    var userMessage = window.RecommendPrompt.buildEvalMessage(ctx, candidates, constraints);
    btn.disabled = true; btn.textContent = "AI 평가 중...";
    resultArea.innerHTML = '<div class="recommend-loading"><div class="loading-spinner" style="width:24px;height:24px;border-width:2px;"></div><span>AI가 ' + candidates.length + '개 후보를 정성 평가하고 있습니다...</span></div>';
    try {
      var resp = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: window.RecommendPrompt.SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 8192, temperature: 0.7, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } }
        })
      });
      if (!resp.ok) { var errText = await resp.text(); throw new Error("API " + resp.status + ": " + errText); }
      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "", accumulated = "";
      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        var splitLines = buffer.split("\n");
        buffer = splitLines.pop();
        for (var i = 0; i < splitLines.length; i++) {
          var ln = splitLines[i].trim();
          if (!ln.startsWith("data: ")) continue;
          var raw = ln.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            var d = JSON.parse(raw);
            var parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
            if (parts) parts.forEach(function(part) { if (!part.thought && part.text) accumulated += part.text; });
          } catch(e) {}
        }
      }
      var jsonStr = accumulated.trim();
      var bs = jsonStr.indexOf("{"), be = jsonStr.lastIndexOf("}");
      if (bs >= 0 && be > bs) jsonStr = jsonStr.substring(bs, be + 1);
      var aiResult;
      try { aiResult = JSON.parse(jsonStr); }
      catch(parseErr) {
        var posMatch = parseErr.message.match(/position (\d+)/);
        var pos = posMatch ? parseInt(posMatch[1]) : 0;
        throw new Error('JSON 파싱 오류 (pos ' + pos + '): ...' + jsonStr.substring(Math.max(0, pos - 60), pos + 60) + '...');
      }
      window.LAST_RECOMMEND_RESULT = { candidates: candidates, optResult: optResult, aiResult: aiResult };
      renderComparison(candidates, aiResult);
    } catch(err) {
      resultArea.innerHTML = '<div class="recommend-error">오류: ' + escapeHtml(err.message) + '</div>';
    } finally {
      btn.disabled = false; btn.textContent = "AI 추천 실행";
    }
  }

  // 알고리즘 순위 vs AI 정성평가 순위를 나란히 비교 표시
  function renderComparison(candidates, aiResult) {
    var container = document.getElementById("recommend-result");
    var candById = {};
    candidates.forEach(function(c) { candById[c.cid] = c; });
    var aiList = (aiResult.ai_ranking || []).filter(function(a) { return candById[a.id]; }).slice(0, 3);
    var aiRankById = {};
    aiList.forEach(function(a, i) { aiRankById[a.id] = i + 1; });
    var bestPick = aiResult.best_pick;

    function metricsLine(f) {
      var reg = f.targets.법적규제;
      return (f.score * 100).toFixed(0) + '점 · 초기 ' + (f.targets.초기비용 / 1e8).toFixed(2) + '억 · 순익 '
        + (f.targets.운영순익 / 1e4).toFixed(0) + '만 · 의무 ' + reg.의무설치비율.toFixed(1) + '%'
        + (reg.전력생산비율 != null ? ' · 전력 ' + reg.전력생산비율.toFixed(1) + '%' : '');
    }

    var html = '';
    if (aiResult.comparison) {
      html += '<div class="recommend-reasoning"><span class="recommend-reasoning-icon">&#x2696;&#xFE0F;</span><span>' + escapeHtml(aiResult.comparison) + '</span></div>';
    }
    html += '<div class="cmp-grid">';

    // 좌: 최적화 알고리즘 (상위 5)
    html += '<div class="cmp-col"><div class="cmp-col-title">&#x1F522; 최적화 알고리즘 <small>(8차원 가중합)</small></div>';
    candidates.slice(0, 5).forEach(function(c) {
      var aiR = aiRankById[c.cid];
      html += '<div class="cmp-item' + (c.cid === 1 ? ' best' : '') + '">'
        + '<div class="cmp-head"><span class="cmp-rank">알고 #' + c.cid + '</span>'
        + '<span class="cmp-xref">' + (aiR ? 'AI #' + aiR : 'AI 권외') + '</span></div>'
        + '<div class="cmp-sys">' + escapeHtml(sysText(c.f)) + '</div>'
        + '<div class="cmp-metrics">' + metricsLine(c.f) + '</div></div>';
    });
    html += '</div>';

    // 우: AI 정성평가 (상위 3)
    html += '<div class="cmp-col"><div class="cmp-col-title">&#x1F916; AI 정성평가</div>';
    if (!aiList.length) {
      html += '<div class="empty-state" style="padding:16px 0;">AI 평가 결과를 해석하지 못했습니다.</div>';
    }
    aiList.forEach(function(a, i) {
      var c = candById[a.id];
      html += '<div class="cmp-item' + (a.id === bestPick ? ' best' : '') + '">'
        + '<div class="cmp-head"><span class="cmp-rank">AI #' + (i + 1) + (a.id === bestPick ? ' &#9733;' : '') + '</span>'
        + '<span class="cmp-xref">알고 #' + a.id + '</span></div>'
        + '<div class="cmp-sys">' + escapeHtml(sysText(c.f)) + '</div>'
        + '<div class="cmp-metrics">' + metricsLine(c.f) + '</div>'
        + (a.reasoning ? '<div class="cmp-reason">' + escapeHtml(a.reasoning) + '</div>' : '') + '</div>';
    });
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  window.RecommendEngine = {
    run: runComparison,
    collectConstraints: collectConstraints
  };
})();
