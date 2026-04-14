// recommend/recommendEngine.js
(function() {
  "use strict";

  function collectConstraints() {
    return {
      solarRoofArea: parseFloat(document.getElementById("constraint-solar-roof").value) || 0,
      solarGroundArea: parseFloat(document.getElementById("constraint-solar-ground").value) || 0,
      solarNote: (document.getElementById("constraint-solar-note").value || "").trim(),
      geothermalArea: parseFloat(document.getElementById("constraint-geo-area").value) || 0,
      nearSubway: document.getElementById("constraint-subway-yes").checked,
      geothermalNote: (document.getElementById("constraint-geo-note").value || "").trim(),
      fuelCellNote: (document.getElementById("constraint-fuel-note").value || "").trim(),
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

  // Output_2 역산 공식으로 각 에너지원의 적용용량 계산
  // 설치비율(%) = Σ(적용용량 × 단위에너지생산량 × 원별보정계수) / 총에너지사용량 × 100
  // → 역산: 적용용량_i = (총필요생산량 × allocation_pct_i/100) / (단위에너지생산량_i × 원별보정계수_i)
  function backCalculateCapacities(result, input1, output1, 의무비율) {
    var 총에너지 = output1.총예상에너지사용량 || 0;
    var 총필요생산량 = 총에너지 * 의무비율 / 100;

    (result.recommendations || []).forEach(function(rec) {
      var sources = rec.sources || [];
      // allocation_pct 합계 정규화
      var totalAlloc = sources.reduce(function(sum, s) { return sum + (s.allocation_pct || 0); }, 0) || 100;

      rec.systems = sources.map(function(src) {
        var coeff = typeof get신재생에너지계수 === 'function'
          ? get신재생에너지계수(src.에너지원, src.형식)
          : null;
        var 단위 = coeff ? coeff.단위에너지생산량 : 0;
        var 보정 = coeff ? coeff.원별보정계수 : 0;
        var weight = (src.allocation_pct || 0) / totalAlloc;
        var 이소스필요생산량 = 총필요생산량 * weight;
        var 적용용량 = (단위 * 보정 > 0)
          ? Math.round(이소스필요생산량 / (단위 * 보정) * 10) / 10
          : 0;
        return {
          에너지원: src.에너지원,
          형식: src.형식,
          단위에너지생산량: 단위,
          원별보정계수: 보정,
          적용용량: 적용용량
        };
      });

      // Output_2 공식으로 실제 설치비율 계산 (검증용)
      var 실제생산량 = rec.systems.reduce(function(sum, s) {
        return sum + s.적용용량 * s.단위에너지생산량 * s.원별보정계수;
      }, 0);
      rec.estimated_ratio = 총에너지 > 0
        ? Math.round(실제생산량 / 총에너지 * 1000) / 10
        : 0;
    });
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

    // 의무비율 사전 계산 (역산에 사용)
    var 주거구분 = (input1.용도별연면적목록 || []).some(function(x) { return x.용도 !== '공동주택'; }) ? '비주거' : '주거';
    var 의무비율 = typeof get의무비율 === 'function'
      ? get의무비율(input1.사업형태, input1.대지위치, 주거구분, input1.카테고리, input1.사업연도)
      : null;
    if (!의무비율 || 의무비율 <= 0) {
      alert("의무설치비율을 확인할 수 없습니다.\n사업형태, 대지위치, 사업연도를 확인해주세요.");
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
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.7,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 }
          }
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
            var parts = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
            if (parts) {
              parts.forEach(function(part) {
                // thought: true 부분(thinking 토큰)은 제외하고 실제 응답 텍스트만 누적
                if (!part.thought && part.text) accumulated += part.text;
              });
            }
          } catch(e) {}
        }
      }
      var jsonStr = accumulated.trim();
      var bs = jsonStr.indexOf("{");
      var be = jsonStr.lastIndexOf("}");
      if (bs >= 0 && be > bs) jsonStr = jsonStr.substring(bs, be + 1);
      var result;
      try {
        result = JSON.parse(jsonStr);
      } catch(parseErr) {
        var posMatch = parseErr.message.match(/position (\d+)/);
        var pos = posMatch ? parseInt(posMatch[1]) : 0;
        var ctx = jsonStr.substring(Math.max(0, pos - 60), pos + 60);
        throw new Error('JSON 파싱 오류 (pos ' + pos + '): ...' + ctx + '...');
      }

      // Output_2 역산 공식으로 용량 계산 (의무비율 기준)
      backCalculateCapacities(result, input1, output1, 의무비율);

      window.LAST_RECOMMEND_RESULT = result;
      renderRecommendations(result, 의무비율);
    } catch(err) {
      resultArea.innerHTML = '<div class="recommend-error">오류: ' + escapeHtml(err.message) + '</div>';
    } finally {
      btn.disabled = false;
      btn.textContent = "AI 추천 실행";
    }
  }

  function renderRecommendations(result, 의무비율) {
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
        var src = (rec.sources || []).find(function(s) { return s.에너지원 === sys.에너지원 && s.형식 === sys.형식; });
        var allocLabel = src ? ' (' + src.allocation_pct + '%)' : '';
        html += '<div class="recommend-sys-row">'
          + '<span class="recommend-sys-source">' + escapeHtml(sys.에너지원) + '</span>'
          + '<span class="recommend-sys-type">' + escapeHtml(sys.형식) + '</span>'
          + '<span class="recommend-sys-cap">' + sys.적용용량 + ' kW' + escapeHtml(allocLabel) + '</span>'
          + '</div>';
      });
      html += '</div>';
      var ratioLabel = 의무비율 ? ' (의무비율 ' + 의무비율 + '%)' : '';
      html += '<div class="recommend-ratio"><span>예상 설치비율' + escapeHtml(ratioLabel) + '</span><span class="recommend-ratio-value">' + (rec.estimated_ratio || 0).toFixed(1) + '%</span></div>';
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
