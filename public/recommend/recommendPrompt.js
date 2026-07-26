// recommend/recommendPrompt.js
// AI 정성평가용 프롬프트 — 최적화 엔진이 만든 feasible 후보를 "평가"한다(생성하지 않는다).
(function() {
  'use strict';

  var SYSTEM_PROMPT = [
    '당신은 한국 건축물 신재생에너지 의무설치비율 제도에 정통한 에너지 설비 설계 전문가입니다.',
    '',
    '## 역할',
    '제공된 "후보 설비조합" 목록을 정성적으로 평가하여 순위를 매깁니다.',
    '각 후보는 이미 의무비율·면적 등 제약을 충족하도록 최적화 엔진이 생성·사이징한 것입니다.',
    '',
    '## 규칙',
    '1. 반드시 JSON 형식으로만 응답하세요. 설명 텍스트 없이 JSON만 출력합니다.',
    '2. 새로운 조합이나 설비를 만들지 마세요. 반드시 제공된 후보의 id만 사용합니다.',
    '3. 비용·운영성·디자인·시공성·인센티브·심의(법규) 리스크·건물 적합성, 그리고 제공된 소프트 조건(예산·제외 선호·특이사항)을 종합해 정성적으로 판단합니다.',
    '4. 상위 3개를 선정하고, 각 선정 근거를 실무적으로 구체적으로 작성합니다.',
    '5. comparison 필드에는 "8차원 가중합 알고리즘 순위"와 당신의 정성 평가가 어디서·왜 갈리는지를 1~3문장으로 설명합니다.',
    '',
    '## 응답 JSON 스키마',
    '{',
    '  "ai_ranking": [',
    '    { "id": 3, "reasoning": "이 후보를 1위로 평가한 근거" },',
    '    { "id": 1, "reasoning": "..." },',
    '    { "id": 7, "reasoning": "..." }',
    '  ],',
    '  "comparison": "알고리즘 순위와 당신 평가의 차이 및 이유",',
    '  "best_pick": 3',
    '}'
  ].join('\n');

  var 요구도라벨 = {
    초기비용: '초기비용 절감', 운영비: '운영비 절감', 인센티브: '인센티브 확보', 디자인: '디자인 보존',
    시공성: '시공 용이성', 의무근접: '의무비율 근접', 법규제약: '법적심의 적합', 건물적합: '건물유형 적합'
  };

  // ctx: 최적화 공유 조건, candidates: [{cid, f}], constraints: 소프트 조건
  function buildEvalMessage(ctx, candidates, constraints) {
    var lines = [];

    lines.push('## 사업·의무 맥락');
    lines.push('- 건물유형: ' + (ctx.건물유형 || '미지정'));
    lines.push('- 연간 에너지소요량: ' + Math.round(ctx.연간단위에너지소요량 || 0).toLocaleString() + ' kWh/yr');
    lines.push('- 의무설치비율: ' + (ctx.의무설치비율기준 != null ? ctx.의무설치비율기준 + '%' : '-'));
    lines.push('');

    var 요구도 = ctx.요구도 || {};
    var 요구도줄 = Object.keys(요구도라벨).filter(function(k) { return 요구도[k]; })
      .map(function(k) { return 요구도라벨[k] + '=' + 요구도[k]; });
    if (요구도줄.length) {
      lines.push('## 사용자 요구도 (참고 — 높을수록 중시)');
      lines.push('- ' + 요구도줄.join(', '));
      lines.push('');
    }

    lines.push('## 평가 대상 후보 (이 id만 사용, 새 조합 생성 금지)');
    candidates.forEach(function(c) {
      var f = c.f, reg = f.targets.법적규제, q = f.targets.정성;
      var sys = f.items.map(function(it) { return it.설비.세부형식 + ' ' + Math.round(it.용량).toLocaleString() + 'kW'; }).join(' + ');
      var 심의 = (f.targets.제약 && f.targets.제약.적합도 != null) ? f.targets.제약.적합도.toFixed(2) : '-';
      var 건물 = (f.targets.건물적합 && f.targets.건물적합.적합도 != null) ? f.targets.건물적합.적합도.toFixed(2) : '-';
      lines.push('[후보 ' + c.cid + '] ' + sys);
      lines.push('  초기비용 ' + (f.targets.초기비용 / 1e8).toFixed(2) + '억 · 연간순익 ' + (f.targets.운영순익 / 1e4).toFixed(0)
        + '만원 · 의무비율 ' + reg.의무설치비율.toFixed(1) + '%' + (reg.전력생산비율 != null ? ' · 전력생산 ' + reg.전력생산비율.toFixed(1) + '%' : ''));
      lines.push('  디자인 ' + q.디자인.toFixed(1) + ' · 시공성 ' + q.시공성.toFixed(1) + ' · ZEB ' + q.ZEB.toFixed(1)
        + ' · 인센티브 ' + q.인센티브.toFixed(1) + ' · 심의적합 ' + 심의 + ' · 건물적합 ' + 건물);
    });
    lines.push('  (디자인·시공성·ZEB·인센티브는 1~5점·높을수록 좋음, 심의적합·건물적합은 0~1·높을수록 좋음)');
    lines.push('');

    var soft = [];
    if (constraints.budgetMin > 0 || constraints.budgetMax > 0) soft.push('예산 ' + (constraints.budgetMin || 0) + '~' + (constraints.budgetMax || '무제한') + '만원');
    if (constraints.excludeSources && constraints.excludeSources.length) soft.push('제외 선호: ' + constraints.excludeSources.join(', '));
    if (constraints.nearSubway) soft.push('인근 지하철 노선 존재(지열 설치 제한)');
    if (constraints.solarNote) soft.push('태양광: ' + constraints.solarNote);
    if (constraints.geothermalNote) soft.push('지열: ' + constraints.geothermalNote);
    if (constraints.fuelCellNote) soft.push('연료전지: ' + constraints.fuelCellNote);
    if (constraints.customConstraints) soft.push('기타: ' + constraints.customConstraints);
    if (soft.length) {
      lines.push('## 추가 소프트 조건 (정성 반영)');
      soft.forEach(function(s) { lines.push('- ' + s); });
      lines.push('');
    }

    lines.push('위 후보들을 정성 기준으로 평가해 상위 3개를 고르고, 각 근거와 알고리즘 순위와의 비교를 JSON으로 출력하세요.');
    return lines.join('\n');
  }

  window.RecommendPrompt = {
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    buildEvalMessage: buildEvalMessage
  };
})();
