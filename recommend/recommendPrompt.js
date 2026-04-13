// recommend/recommendPrompt.js
// AI 추천용 프롬프트 빌더

(function() {
  'use strict';

  var SYSTEM_PROMPT = [
    '당신은 한국 건축물 신재생에너지 의무설치비율 제도에 정통한 에너지 설비 설계 전문가입니다.',
    '',
    '## 역할',
    '사용자가 제공하는 건축물 정보, 제약조건, 에너지원 라이브러리를 분석하여',
    '최적의 신재생에너지 조합안 3개를 추천합니다.',
    '',
    '## 규칙',
    '1. 반드시 JSON 형식으로만 응답하세요. 설명 텍스트 없이 JSON만 출력합니다.',
    '2. 각 조합안의 에너지원/형식은 반드시 제공된 라이브러리에 존재하는 것만 사용하세요.',
    '3. 적용용량은 소수점 1자리까지, 현실적인 값으로 설정하세요.',
    '4. 설치비율이 의무비율을 충족하도록 설계하세요.',
    '5. 제약조건을 반드시 준수하세요 (면적 제한, 지하철 인근 지열 제한 등).',
    '6. 태양광 고정식 기준 약 5㎡당 1kW로 계산하세요.',
    '7. 지열 수직밀폐형 기준 약 50㎡당 1RT(약 3.517kW)로 계산하세요.',
    '8. rank 1이 최선안입니다. 각 안은 서로 다른 전략이어야 합니다.',
    '9. 장점/단점은 실무적이고 구체적으로 작성하세요.',
    '',
    '## 응답 JSON 스키마',
    '{',
    '  "recommendations": [',
    '    {',
    '      "rank": 1,',
    '      "name": "조합안 이름",',
    '      "strategy": "핵심 전략 설명",',
    '      "systems": [',
    '        { "에너지원": "태양광", "형식": "태양광-고정식", "적용용량": 50 }',
    '      ],',
    '      "estimated_ratio": 12.5,',
    '      "pros": ["장점1", "장점2"],',
    '      "cons": ["단점1"],',
    '      "constraints_analysis": "제약조건 충족 여부 분석"',
    '    }',
    '  ],',
    '  "best_pick": 1,',
    '  "reasoning": "최선안 선정 이유"',
    '}'
  ].join('\n');

  function buildUserMessage(input1, output1, constraints) {
    var lines = [];

    lines.push('## 사업 정보');
    lines.push('- 사업형태: ' + (input1.사업형태 || '미입력'));
    lines.push('- 사업연도: ' + (input1.사업연도 || '미입력'));
    lines.push('- 대지위치: ' + (input1.대지위치 || '미입력'));
    lines.push('- 대지면적: ' + (input1.대지면적 || 0) + ' ㎡');
    lines.push('- 건축면적: ' + (input1.건축면적 || 0) + ' ㎡');
    lines.push('- 연면적: ' + (input1.연면적 || 0) + ' ㎡');
    lines.push('- 적용연면적: ' + (input1.적용연면적 || 0) + ' ㎡');
    lines.push('- 규모등급: ' + (input1.카테고리 || '미정'));
    lines.push('');

    lines.push('### 용도별 연면적');
    (input1.용도별연면적목록 || []).forEach(function(item) {
      var line = '- ' + item.용도 + ': ' + item.연면적 + ' ㎡';
      if (item.세대수) line += ' (' + item.세대수 + ')';
      lines.push(line);
    });
    lines.push('');

    lines.push('## 에너지 사용량 (계산 완료)');
    lines.push('- 총예상에너지사용량: ' + Math.round(output1.총예상에너지사용량) + ' kWh/yr');
    lines.push('');

    var 주거구분 = (input1.용도별연면적목록 || []).some(function(x) { return x.용도 !== '공동주택'; }) ? '비주거' : '주거';
    var 의무비율 = null;
    if (typeof get의무비율 === 'function') {
      의무비율 = get의무비율(input1.사업형태, input1.대지위치, 주거구분, input1.카테고리, input1.사업연도);
    }
    lines.push('## 의무비율');
    lines.push('- 주거구분: ' + 주거구분);
    lines.push('- 의무비율: ' + (의무비율 !== null ? 의무비율 + '%' : '해당없음'));
    lines.push('');

    var loc = window.KakaoMapModule ? window.KakaoMapModule.getLocation() : null;
    if (loc) {
      lines.push('## 위치 정보');
      lines.push('- 주소: ' + (loc.address || '-'));
      lines.push('- 좌표: ' + loc.lat.toFixed(6) + ', ' + loc.lng.toFixed(6));
      lines.push('');
    }

    lines.push('## 제약조건');
    if (constraints.solarRoofArea > 0) lines.push('- 태양광 옥상 가용면적: ' + constraints.solarRoofArea + ' ㎡ (약 ' + Math.floor(constraints.solarRoofArea / 5) + 'kW 설치 가능)');
    if (constraints.solarGroundArea > 0) lines.push('- 태양광 부지 가용면적: ' + constraints.solarGroundArea + ' ㎡ (약 ' + Math.floor(constraints.solarGroundArea / 5) + 'kW 설치 가능)');
    if (constraints.geothermalArea > 0) lines.push('- 지열 가용면적: ' + constraints.geothermalArea + ' ㎡ (약 ' + Math.floor(constraints.geothermalArea / 50) + 'RT 설치 가능)');
    if (constraints.nearSubway) lines.push('- 인근 지하철 노선 존재: 지열 시스템 설치 제한 또는 불가');
    if (constraints.budgetMin > 0 || constraints.budgetMax > 0) lines.push('- 예산 범위: ' + (constraints.budgetMin || 0) + ' ~ ' + (constraints.budgetMax || '무제한') + ' 만원');
    if (constraints.excludeSources && constraints.excludeSources.length > 0) lines.push('- 제외 에너지원: ' + constraints.excludeSources.join(', '));
    if (constraints.priority) {
      var labels = { cost: '비용 절감', efficiency: '효율 극대화', balanced: '균형' };
      lines.push('- 우선순위: ' + (labels[constraints.priority] || constraints.priority));
    }
    if (constraints.customConstraints) lines.push('- 기타 제약사항: ' + constraints.customConstraints);
    lines.push('');

    lines.push('## 사용 가능한 에너지원 라이브러리');
    var lib = window.LIB_신재생에너지계수 || [];
    lib.forEach(function(item) {
      var excluded = (constraints.excludeSources || []).indexOf(item.에너지원) >= 0;
      var nearSubwayGeo = constraints.nearSubway && item.에너지원 === '지열';
      var tag = '';
      if (excluded) tag = ' [제외됨]';
      else if (nearSubwayGeo) tag = ' [지하철 인근 제한]';
      lines.push('- ' + item.에너지원 + ' / ' + item.형식 + ' | 단위생산량: ' + item.단위에너지생산량 + ' kWh/kW·yr | 보정계수: ' + item.원별보정계수 + tag);
    });
    lines.push('');
    lines.push('위 정보를 바탕으로 최적의 신재생에너지 조합안 3개를 JSON 형식으로 추천해주세요.');

    return lines.join('\n');
  }

  window.RecommendPrompt = {
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    buildUserMessage: buildUserMessage
  };
})();
