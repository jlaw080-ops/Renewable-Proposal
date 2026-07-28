// recommend/recommendPrompt.js
// AI 정성평가용 프롬프트 — 최적화 엔진이 만든 feasible 후보를 "평가"한다(생성하지 않는다).
(function() {
  'use strict';

  var SYSTEM_PROMPT = [
    '당신은 신재생에너지 설비 계획 컨설턴트입니다. 최적화 알고리즘이 산출한 실행 가능한 설비조합 후보들을 검토하여, 사업 여건과 사용자 요구도에 가장 적합한 조합을 의사결정자에게 추천합니다.',
    '',
    '규칙:',
    '- 반드시 제공된 후보의 id만 사용합니다. 새로운 조합을 만들지 않습니다.',
    '- 후보의 정량 지표(비용·순익·의무비율 충족)와 정성 지표(디자인·시공성·ZEB·심의적합·건물적합), 사용자 요구도를 종합해 판단합니다.',
    '- 근거는 의사결정자가 읽는 문장으로, 해당 조합의 강점과 주의사항을 함께 서술합니다.',
    '',
    '다음 JSON 형식으로만 응답합니다 (다른 텍스트 금지):',
    '{',
    '  "best_pick": 3,',
    '  "ai_ranking": [',
    '    { "id": 3, "reasoning": "추천 1순위 근거 1~2문장" },',
    '    { "id": 1, "reasoning": "2순위 근거" },',
    '    { "id": 7, "reasoning": "3순위 근거" }',
    '  ],',
    '  "summary": "추천 총평 1~3문장 (알고리즘 순위와 다르게 판단했다면 그 이유 포함)"',
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
