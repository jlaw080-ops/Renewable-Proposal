// report/reportBuilder.js
// 리포트 HTML 생성 — DOM 조작 없이 문자열만 반환

'use strict';

// ── 유틸 ────────────────────────────────────────────
function fmt(n, digits) {
  digits = digits !== undefined ? digits : 0;
  if (n == null || n === '') return '-';
  var num = parseFloat(n);
  if (isNaN(num)) return n;
  return num.toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function today() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  });
}

function statusBadge(만족여부) {
  if (만족여부 === 'Yes') return '<span class="status-pass">✓ PASS</span>';
  if (만족여부 === 'No')  return '<span class="status-fail">✗ FAIL</span>';
  return '<span class="status-na">해당없음</span>';
}

// ── 머리글 공통 함수 ──────────────────────────────────
function header(섹션명, 페이지번호) {
  return '<div class="report-header">' +
    '<span class="report-header-title">신재생에너지 검토 보고서</span>' +
    '<div class="report-header-right">' +
      '<span class="report-header-section">' + 섹션명 + '</span>' +
      '<span class="report-header-page">' + 페이지번호 + '</span>' +
    '</div>' +
  '</div>';
}

// ── Page 1: 표지 ─────────────────────────────────────
function buildCoverPage(data) {
  var projectName = data.projectName;
  var coverImage  = data.coverImage;
  var logoImage   = data.logoImage;

  var coverImgHTML = coverImage
    ? '<img src="' + coverImage + '" alt="표지 이미지">'
    : '<span class="report-cover-image-empty">이미지 없음</span>';

  var logoHTML = logoImage
    ? '<img class="report-cover-logo" src="' + logoImage + '" alt="로고">'
    : '';

  return '<div class="report-page report-cover">' +
    '<div class="report-cover-main">신재생에너지 검토 보고서</div>' +
    '<div class="report-cover-sub">' + (projectName || '&nbsp;') + '</div>' +
    '<div class="report-cover-image-wrap">' + coverImgHTML + '</div>' +
    '<div class="report-cover-date">' + today() + '</div>' +
    logoHTML +
  '</div>';
}

// ── Page 2: 목차 ─────────────────────────────────────
function buildTocPage() {
  var items = [
    { num: '1', name: '검토결과 요약', page: 3 },
    { num: '2', name: '사업개요',      page: 4 },
    { num: '3', name: '기준검토',      page: 5 },
    { num: '4', name: '설치 비율 검토', page: 6 },
  ];

  var rows = items.map(function(i) {
    return '<div class="toc-item">' +
      '<span class="toc-item-num">' + i.num + '.</span>' +
      '<span class="toc-item-name">' + i.name + '</span>' +
      '<span class="toc-item-dots"></span>' +
      '<span class="toc-item-page">' + i.page + '</span>' +
    '</div>';
  }).join('');

  return '<div class="report-page">' +
    header('목차', 2) +
    '<div class="report-page-title">목  차</div>' +
    rows +
  '</div>';
}

// ── Page 3: 검토결과 요약 ─────────────────────────────
function buildResultPage(data) {
  var output2    = data.output2;
  var reviewHTML = data.reviewHTML;

  var summaryRows = '';
  if (!output2 || !output2.length) {
    summaryRows = '<tr><td colspan="4">-</td></tr>';
  } else {
    summaryRows = output2.map(function(alt) {
      return '<tr>' +
        '<td>' + alt.id + '</td>' +
        '<td>' + fmt(alt.비율, 1) + ' %</td>' +
        '<td>' + (alt.의무비율 != null ? alt.의무비율 + ' %' : '-') + '</td>' +
        '<td>' + statusBadge(alt.만족여부) + '</td>' +
      '</tr>';
    }).join('');
  }

  return '<div class="report-page">' +
    header('검토결과', 3) +
    '<div class="report-page-title">검토결과 요약</div>' +
    '<div class="report-section-title">신재생에너지 적용 비율 검토 요약</div>' +
    '<table class="report-table">' +
      '<thead><tr><th>구분</th><th>설치 비율</th><th>의무 비율</th><th>만족 여부</th></tr></thead>' +
      '<tbody>' + summaryRows + '</tbody>' +
    '</table>' +
    '<div class="report-section-title">검토 의견</div>' +
    '<div class="review-text-wrap">' + (reviewHTML || '(검토 의견 없음)') + '</div>' +
  '</div>';
}

// ── Page 4: 사업개요 ──────────────────────────────────
function buildProjectPage(data) {
  var i = data.input1;

  var usageRows = '';
  if (i.용도별연면적목록 && i.용도별연면적목록.length) {
    usageRows = i.용도별연면적목록.map(function(item, idx) {
      return '<tr>' +
        '<td class="col-label">용도 (' + (idx + 1) + ')</td>' +
        '<td class="col-value">' + (item.용도 || '-') + ' / ' + fmt(item.연면적) + ' ㎡</td>' +
      '</tr>';
    }).join('');
  }

  return '<div class="report-page">' +
    header('사업개요', 4) +
    '<div class="report-page-title">설계개요</div>' +
    '<table class="report-table">' +
      '<thead><tr><th style="width:35%">구분</th><th>내용</th></tr></thead>' +
      '<tbody>' +
        '<tr><td class="col-label">사업형태</td><td class="col-value">' + (i.사업형태 || '-') + '</td></tr>' +
        '<tr><td class="col-label">사업연도</td><td class="col-value">' + (i.사업연도 || '-') + '</td></tr>' +
        '<tr><td class="col-label">대지위치</td><td class="col-value">' + (i.대지위치 || '-') + '</td></tr>' +
        '<tr><td class="col-label">대지면적</td><td class="col-value">' + fmt(i.대지면적) + ' ㎡</td></tr>' +
        '<tr><td class="col-label">건축면적</td><td class="col-value">' + fmt(i.건축면적) + ' ㎡</td></tr>' +
        '<tr><td class="col-label">연면적</td>  <td class="col-value">' + fmt(i.연면적) + ' ㎡</td></tr>' +
        '<tr><td class="col-label">건폐율</td>  <td class="col-value">' + fmt(i.건폐율, 1) + ' %</td></tr>' +
        '<tr><td class="col-label">용적률</td>  <td class="col-value">' + fmt(i.용적률, 1) + ' %</td></tr>' +
        '<tr><td class="col-label">적용연면적</td><td class="col-value">' + fmt(i.적용연면적) + ' ㎡</td></tr>' +
        usageRows +
      '</tbody>' +
    '</table>' +
  '</div>';
}

// ── Page 5: 기준검토 ──────────────────────────────────
function buildCriteriaPage(data) {
  var input1 = data.input1;
  var 사업형태 = input1.사업형태;
  var 연도컬럼 = ['2024','2025','2026','2027','2028','2029','2030'];

  var 페이지제목 = 사업형태 === '공공'
    ? '공공기관 에너지이용 합리화 추진에 관한 규정'
    : (input1.대지위치 || '') + ' 녹색건축물 설계기준';

  var tableHTML = '';

  if (사업형태 === '공공') {
    var lib = (window.LIB_의무비율 && window.LIB_의무비율['공공']) ? window.LIB_의무비율['공공'] : {};
    var yearCells = 연도컬럼.map(function(y) { return '<th>' + y + '</th>'; }).join('');
    var valueCells = 연도컬럼.map(function(y) {
      var v = lib[y];
      return '<td>' + ((v !== '' && v != null) ? v + ' %' : '-') + '</td>';
    }).join('');

    tableHTML = '<table class="report-table">' +
      '<thead><tr><th>구분</th>' + yearCells + '</tr></thead>' +
      '<tbody><tr><td style="font-weight:600">공공</td>' + valueCells + '</tr></tbody>' +
    '</table>';

  } else {
    var lib2 = window.LIB_의무비율 || {};
    var 선택카테고리 = input1.카테고리;

    var 주거구분 = (input1.용도별연면적목록 || []).some(function(x) {
      return x.용도 !== '공동주택';
    }) ? '비주거' : '주거';

    var 지역키 = (window.normalize대지위치 ? window.normalize대지위치(input1.대지위치) : '') || '';
    var 후보 = Object.values(lib2).filter(function(v) {
      return v.state === 지역키 && v.purpose === 주거구분;
    });
    var 카테고리순 = ['가','나','다','라'];
    var 정렬 = 카테고리순
      .map(function(c) { return 후보.find(function(v) { return v.category === c; }); })
      .filter(Boolean);

    if (정렬.length === 0) {
      tableHTML = '<p style="color:#999; font-size:11px;">해당 지역 기준 데이터 없음</p>';
    } else {
      var yearCells2 = 연도컬럼.map(function(y) { return '<th>' + y + '</th>'; }).join('');
      var rows = 정렬.map(function(item) {
        var isSelected = item.category === 선택카테고리;
        var valueCells2 = 연도컬럼.map(function(y) {
          var v = item[y];
          if (v === '' || v == null) return '<td>-</td>';
          return '<td>' + (v === '자율' ? '자율' : v + ' %') + '</td>';
        }).join('');
        return '<tr class="' + (isSelected ? 'highlight-row' : '') + '">' +
          '<td style="font-weight:600">' + item.category + '</td>' +
          '<td>' + (item.녹색건축인증 || '-') + '</td>' +
          '<td>' + (item.에너지효율등급 || '-') + '</td>' +
          valueCells2 +
        '</tr>';
      }).join('');

      tableHTML = '<table class="report-table">' +
        '<thead><tr><th>등급</th><th>녹색건축인증</th><th>에너지효율등급</th>' + yearCells2 + '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
    }
  }

  return '<div class="report-page">' +
    header('기준검토', 5) +
    '<div class="report-page-title">' + 페이지제목 + '</div>' +
    '<div class="report-section-title">신재생에너지 의무 설치 비율</div>' +
    tableHTML +
  '</div>';
}

// ── Page 6: 설치 비율 검토 ────────────────────────────
function buildRatioPage(data) {
  var output1 = data.output1;
  var output2 = data.output2;

  // 예상에너지사용량 테이블
  var energyRows = '';
  if (output1.용도별결과 && output1.용도별결과.length) {
    energyRows = output1.용도별결과.map(function(row, idx) {
      return '<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td>' + row.용도 + '</td>' +
        '<td>' + fmt(row.연면적) + '</td>' +
        '<td>' + fmt(row.지역계수, 2) + '</td>' +
        '<td>' + fmt(row.단위에너지사용량, 2) + '</td>' +
        '<td>' + fmt(Math.round(row.예상에너지사용량)) + '</td>' +
      '</tr>';
    }).join('');
  }

  var energyTable = '<table class="report-table">' +
    '<thead><tr>' +
      '<th>구분</th><th>용도</th>' +
      '<th>적용연면적<br>(㎡)</th>' +
      '<th>지역계수</th>' +
      '<th>단위에너지사용량<br>(kWh/㎡·yr)</th>' +
      '<th>예상에너지사용량<br>(kWh/yr)</th>' +
    '</tr></thead>' +
    '<tbody>' +
      energyRows +
      '<tr class="total-row">' +
        '<td colspan="2">합계</td>' +
        '<td>' + fmt(output1.총연면적) + '</td>' +
        '<td></td><td></td>' +
        '<td>' + fmt(Math.round(output1.총예상에너지사용량)) + '</td>' +
      '</tr>' +
    '</tbody>' +
  '</table>';

  // ALT별 블록
  var altBlocks = '';
  if (!output2 || !output2.length) {
    altBlocks = '<p style="color:#999; font-size:11px;">시나리오 없음</p>';
  } else {
    altBlocks = output2.map(function(alt) {
      var systemRows = '';
      if (alt.systems && alt.systems.length) {
        systemRows = alt.systems.map(function(s) {
          return '<tr>' +
            '<td>' + s.에너지원 + '</td>' +
            '<td>' + s.형식 + '</td>' +
            '<td>' + fmt(s.단위에너지생산량) + '</td>' +
            '<td>' + fmt(s.원별보정계수, 2) + '</td>' +
            '<td>' + fmt(s.적용용량) + '</td>' +
            '<td>' + fmt(Math.round(s.신재생에너지생산량)) + '</td>' +
          '</tr>';
        }).join('');
      }

      return '<div class="report-section-title">' + alt.id + '</div>' +
        '<table class="report-table">' +
          '<thead><tr>' +
            '<th>에너지원</th><th>형식</th>' +
            '<th>단위에너지생산량<br>(kWh/kW·yr)</th>' +
            '<th>원별보정계수</th>' +
            '<th>적용용량<br>(kW)</th>' +
            '<th>신재생에너지생산량<br>(kWh/yr)</th>' +
          '</tr></thead>' +
          '<tbody>' +
            systemRows +
            '<tr class="total-row summary-label-row">' +
              '<td colspan="5" style="text-align:right">신재생에너지 생산량 합계 (kWh/yr)</td>' +
              '<td>' + fmt(Math.round(alt.생산량합계)) + '</td>' +
            '</tr>' +
            '<tr class="summary-label-row">' +
              '<td colspan="5" style="text-align:right">총 에너지 사용량 (kWh/yr)</td>' +
              '<td>' + fmt(Math.round(alt.총에너지사용량)) + '</td>' +
            '</tr>' +
            '<tr class="summary-label-row">' +
              '<td colspan="5" style="text-align:right">신재생에너지 설치 비율 (%)</td>' +
              '<td><strong>' + fmt(alt.비율, 1) + ' %</strong></td>' +
            '</tr>' +
            '<tr class="summary-label-row">' +
              '<td colspan="5" style="text-align:right">의무 설치 비율 (%)</td>' +
              '<td>' + (alt.의무비율 != null ? alt.의무비율 + ' %' : '-') + '</td>' +
            '</tr>' +
            '<tr class="summary-label-row">' +
              '<td colspan="5" style="text-align:right">의무비율 만족 여부</td>' +
              '<td>' + statusBadge(alt.만족여부) + '</td>' +
            '</tr>' +
          '</tbody>' +
        '</table>';
    }).join('');
  }

  return '<div class="report-page">' +
    header('설치 비율 검토', 6) +
    '<div class="report-page-title">설치 비율 검토</div>' +
    '<div class="report-section-title">예상에너지 사용량 검토</div>' +
    energyTable +
    '<div class="report-section-title">신재생에너지 설치 비율 검토</div>' +
    altBlocks +
    '<div class="report-footnote">' +
      '<p>단위에너지사용량 및 지역계수는 관련 고시에 따라 자동 적용됩니다.</p>' +
    '</div>' +
  '</div>';
}

// ── 메인 빌드 함수 ────────────────────────────────────
function buildReport(data) {
  var pages = [
    buildCoverPage(data),
    buildTocPage(),
    buildResultPage(data),
    buildProjectPage(data),
    buildCriteriaPage(data),
    buildRatioPage(data),
  ].join('\n');

  return '<!DOCTYPE html>\n' +
    '<html lang="ko">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>신재생에너지 검토 보고서</title>\n' +
    '  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">\n' +
    '  <link rel="stylesheet" href="report/reportStyle.css">\n' +
    '</head>\n' +
    '<body class="report-wrap">\n' +
    pages + '\n' +
    '</body>\n' +
    '</html>';
}
