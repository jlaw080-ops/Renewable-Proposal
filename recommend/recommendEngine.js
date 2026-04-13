// recommend/recommendEngine.js
(function() {
  "use strict";

  function collectConstraints() {
    return {
      solarRoofArea: parseFloat(document.getElementById("constraint-solar-roof").value) || 0,
      solarGroundArea: parseFloat(document.getElementById("constraint-solar-ground").value) || 0,
      geothermalArea: parseFloat(document.getElementById("constraint-geo-area").value) || 0,
      nearSubway: document.getElementById("constraint-subway-yes").checked,
      budgetMin: parseFloat(document.getElementById("constraint-budget-min").value) || 0,
      budgetMax: parseFloat(document.getElementById("constraint-budget-max").value) || 0,
      priority: document.querySelector("input[name=constraint-priority]:checked")
        ? document.querySelector("input[name=constraint-priority]:checked").value
        : "balanced",
      excludeSources: getExcludedSources(),
      customConstraints: (document.getElementById("constraint-custom").value || "").trim()
    };
  }

  function getExcludedSources() {
    var excluded = [];
    document.querySelectorAll(".constraint-exclude-cb:checked").forEach(function(cb) {
      excluded.push(cb.value);
    });
    return excluded;
  }
  async function runRecommendation() {
    var input1 = collectInput1();
    if (!input1.용도별연면적목록.length) {
      alert("사업정보(용도별 연면적)를 먼저 입력해주세요.");
      return;
    }
    var output1 = calcOutput1(input1);
    if (output1.총예상에너지사용량 <= 0) {
      alert("예상에너지사용량이 0입니다.");
      return;
    }
    var constraints = collectConstraints();
    var userMessage = window.RecommendPrompt.buildUserMessage(input1, output1, constraints);
    var btn = document.getElementById("btn-run-recommend");
    var resultArea = document.getElementById("recommend-result");
    btn.disabled = true;
    btn.textContent = "AI 분석 중...";
    resultArea.innerHTML = '<div class="recommend-loading"><div class="loading-spinner" style="width:24px;height:24px;border-width:2px;"></div><span>AI가 최적 조합을 분석하고 있습니다...</span></div>';
    try {
      var resp = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: window.RecommendPrompt.SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7, responseMimeType: "application/json" }
        })
      });
      if (!resp.ok) { var errText = await resp.text(); throw new Error("API " + resp.status + ": " + errText); }
      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";
      var accumulated = "";
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
            var t = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0] && d.candidates[0].content.parts[0].text;
            if (t) accumulated += t;
          } catch(e) {}
        }
      }
      var jsonStr = accumulated.trim();
      var bs = jsonStr.indexOf("{");
      var be = jsonStr.lastIndexOf("}");
      if (bs >= 0 && be > bs) jsonStr = jsonStr.substring(bs, be + 1);
      var result = JSON.parse(jsonStr);
      window.LAST_RECOMMEND_RESULT = result;
      renderRecommendations(result);
    } catch(err) {
      resultArea.innerHTML = '<div class="recommend-error">오류: ' + escapeHtml(err.message) + '</div>';
    } finally {
      btn.disabled = false;
      btn.textContent = "AI 추천 실행";
    }
  }

  function renderRecommendations(result) {
    var container = document.getElementById("recommend-result");
    if (!result || !result.recommendations || !result.recommendations.length) {
      container.innerHTML = '<div class="recommend-error">추천 결과를 생성하지 못했습니다.</div>';
      return;
    }
    var html = "";
    if (result.reasoning) {
      html += '<div class="recommend-reasoning"><span class="recommend-reasoning-icon">&#x1F4A1;</span><span>' + escapeHtml(result.reasoning) + '</span></div>';
    }
    html += '<div class="recommend-cards">';
    result.recommendations.forEach(function(rec) {
      var isBest = rec.rank === result.best_pick;
      html += '<div class="recommend-card' + (isBest ? ' best' : '') + '">';
      html += '<div class="recommend-card-header">';
      if (isBest) html += '<span class="recommend-badge">최선안</span>';
      html += '<span class="recommend-rank">#' + rec.rank + '</span>';
      html += '<span class="recommend-name">' + escapeHtml(rec.name) + '</span></div>';
      if (rec.strategy) html += '<div class="recommend-strategy">' + escapeHtml(rec.strategy) + '</div>';
      html += '<div class="recommend-systems">';
      (rec.systems || []).forEach(function(sys) {
        html += '<div class="recommend-sys-row"><span class="recommend-sys-source">' + escapeHtml(sys.에너지원) + '</span><span class="recommend-sys-type">' + escapeHtml(sys.형식) + '</span><span class="recommend-sys-cap">' + sys.적용용량 + ' kW</span></div>';
      });
      html += '</div>';
      html += '<div class="recommend-ratio"><span>예상 설치비율</span><span class="recommend-ratio-value">' + (rec.estimated_ratio || 0).toFixed(1) + '%</span></div>';
      if (rec.pros && rec.pros.length) {
        html += '<div class="recommend-pros">';
        rec.pros.forEach(function(p) { html += '<div class="recommend-pro-item">&#10003; ' + escapeHtml(p) + '</div>'; });
        html += '</div>';
      }
      if (rec.cons && rec.cons.length) {
        html += '<div class="recommend-cons">';
        rec.cons.forEach(function(c) { html += '<div class="recommend-con-item">&#10007; ' + escapeHtml(c) + '</div>'; });
        html += '</div>';
      }
      if (rec.constraints_analysis) html += '<div class="recommend-constraint-analysis">' + escapeHtml(rec.constraints_analysis) + '</div>';
      html += '<button class="btn-apply-recommend" data-rank="' + rec.rank + '">이 안으로 시나리오 적용</button>';
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll(".btn-apply-recommend").forEach(function(b) {
      b.addEventListener("click", function() { applyRecommendation(parseInt(b.getAttribute("data-rank"))); });
    });
  }

  function applyRecommendation(rank) {
    var result = window.LAST_RECOMMEND_RESULT;
    if (!result || !result.recommendations) return;
    var rec = result.recommendations.find(function(r) { return r.rank === rank; });
    if (!rec || !rec.systems) return;
    var newScenario = {
      id: "AI-" + rank,
      systems: rec.systems.map(function(sys) {
        var coeff = get신재생에너지계수(sys.에너지원, sys.형식);
        return {
          에너지원: sys.에너지원, 형식: sys.형식,
          단위에너지생산량: coeff ? coeff.단위에너지생산량 : 0,
          원별보정계수: coeff ? coeff.원별보정계수 : 0,
          적용용량: sys.적용용량
        };
      })
    };
    var existIdx = scenarios.findIndex(function(s) { return s.id === newScenario.id; });
    if (existIdx >= 0) scenarios[existIdx] = newScenario;
    else scenarios.push(newScenario);
    activeAltIdx = scenarios.findIndex(function(s) { return s.id === newScenario.id; });
    var tabScenario = document.getElementById("tab-scenario");
    if (tabScenario) tabScenario.click();
    renderAltTabs();
    renderAll();
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  window.RecommendEngine = {
    run: runRecommendation,
    collectConstraints: collectConstraints,
    applyRecommendation: applyRecommendation
  };
})();
