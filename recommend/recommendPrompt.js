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
    '3. sources의 allocation_pct 합계는 반드시 100이 되어야 합니다.',
    '4. 제약조건(면적, 예산, 지하철 인근 등)을 반드시 준수하세요.',
    '5. 면적 제약이 있는 경우, 해당 에너지원의 최대 가능 용량을 초과하는 allocation_pct를 설정하지 마세요.',
    '6. rank 1이 최선안입니다. 각 안은 서로 다른 에너지원 전략이어야 합니다.',
    '7. 장점/단점은 실무적이고 구체적으로 작성하세요.',
    '8. 실제 설치 용량은 시스템에서 allocation_pct와 의무비율을 기반으로 자동 역산합니다. 용량 수치를 직접 계산할 필요 없습니다.',
    '',
    '## 응답 JSON 스키마',
    '{',
    '  "recommendations": [',
    '    {',
    '      "rank": 1,',
    '      "name": "조합안 이름",',
    '      "strategy": "핵심 전략 설명",',
    '      "sources": [',
    '        { "에너지원": "태양광", "형식": "태양광-고정식", "allocation_pct": 60 },',
    '        { "에너지원": "지열", "형식": "지열-수직밀폐형", "allocation_pct": 40 }',
    '      ],',
    '      "pros": ["장점1", "장점2"],',
    '      "cons": ["단점1"],',
    '      "constraints_analysis": "제약조건 충족 여부 및 allocation_pct 설정 근거"',
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
    lines.push('## 의무비율 및 역산 기준');
    lines.push('- 주거구분: ' + 주거구분);
    lines.push('- 의무설치비율: ' + (의무비율 !== null ? 의무비율 + '%' : '해당없음'));
    if (의무비율 !== null && 의무비율 > 0) {
      var 필요생산량 = Math.round(output1.총예상에너지사용량 * 의무비율 / 100);
      lines.push('- 달성 목표 생산량: ' + 필요생산량.toLocaleString() + ' kWh/yr');
      lines.push('  (= 총에너지 ' + Math.round(output1.총예상에너지사용량).toLocaleString() + ' × ' + 의무비율 + '% / 100)');
      lines.push('- 역산 공식: 각 에너지원 용량[kW] = (목표생산량 × allocation_pct÷100) ÷ (단위생산량 × 보정계수)');
      lines.push('- allocation_pct 합계가 100이 되도록 각 에너지원의 생산 기여 비율을 설정하세요.');
    }
    lines.push('');

    var loc = window.KakaoMapModule ? window.KakaoMapModule.getLocation() : null;
    if (loc) {
      lines.push('## 위치 정보');
      lines.push('- 주소: ' + (loc.address || '-'));
      lines.push('- 좌표: ' + loc.lat.toFixed(6) + ', ' + loc.lng.toFixed(6));
      lines.push('');
    }

    lines.push('## 제약조건 (설비조합 최적화 탭과 공유)');
    // 가용면적 — 최적화 탭의 공간별 가용면적(㎡, null=무제한). 공간↔에너지원 매핑 안내.
    var 면적 = constraints.면적 || {};
    [['옥상', '수평 태양광', 5], ['외피', '수직 태양광·BIPV', 5], ['대지', '지열', 50], ['기계실', '연료전지', null]]
      .forEach(function (m) {
        var v = 면적[m[0]];
        if (v == null) { lines.push('- ' + m[0] + ' 가용면적(' + m[1] + '): 무제한'); return; }
        var 추정 = m[2] ? ' (약 ' + Math.floor(v / m[2]) + (m[0] === '대지' ? 'RT' : 'kW') + ' 설치 가능)' : '';
        lines.push('- ' + m[0] + ' 가용면적(' + m[1] + '): ' + Math.round(v) + ' ㎡' + 추정);
      });
    // 사용자 요구도(우선순위) — 최적화 탭의 8차원 등급
    var 요구도 = constraints.요구도 || {};
    var 요구도라벨 = {
      초기비용: '초기비용 절감', 운영비: '운영비 절감', 인센티브: '인센티브 확보', 디자인: '디자인 보존',
      시공성: '시공 용이성', 의무근접: '의무비율 근접', 법규제약: '법적심의 적합', 건물적합: '건물유형 적합'
    };
    var 요구도줄 = Object.keys(요구도라벨)
      .filter(function (k) { return 요구도[k]; })
      .map(function (k) { return 요구도라벨[k] + '=' + 요구도[k]; });
    if (요구도줄.length) lines.push('- 사용자 요구도(우선순위, 높을수록 중시): ' + 요구도줄.join(', '));
    // 소프트 조건(최적화에 없는 것 — AI 추천 모달에서 입력)
    if (constraints.solarNote) lines.push('- 태양광 추가 조건: ' + constraints.solarNote);
    if (constraints.nearSubway) lines.push('- 인근 지하철 노선 존재: 지열 시스템 설치 제한 또는 불가');
    if (constraints.geothermalNote) lines.push('- 지열 추가 조건: ' + constraints.geothermalNote);
    if (constraints.fuelCellNote) lines.push('- 연료전지 추가 조건: ' + constraints.fuelCellNote);
    if (constraints.budgetMin > 0 || constraints.budgetMax > 0) lines.push('- 예산 범위: ' + (constraints.budgetMin || 0) + ' ~ ' + (constraints.budgetMax || '무제한') + ' 만원');
    if (constraints.excludeSources && constraints.excludeSources.length > 0) lines.push('- 제외 에너지원: ' + constraints.excludeSources.join(', '));
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
