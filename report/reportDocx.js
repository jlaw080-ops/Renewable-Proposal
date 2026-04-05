// report/reportDocx.js
// docx-js 기반 Word(.docx) 다운로드 — PDF와 동일한 A4 페이지 구성

'use strict';

/* ================================================================
   상수
================================================================ */
var _DOCX_A4_W = 11906;   // A4 width  (DXA)
var _DOCX_A4_H = 16838;   // A4 height (DXA)
var _DOCX_M_TOP = 1021;   // 18mm
var _DOCX_M_BTM = 1247;   // 22mm
var _DOCX_M_LR  = 1134;   // 20mm
var _DOCX_CW    = 9638;   // content width (11906 - 1134*2)

var _DOCX_CLR = {
  dark:      '2C3E50',
  white:     'FFFFFF',
  pass:      '2E7D32',
  fail:      'C62828',
  labelBg:   'F0F4F8',
  altRow:    'F8F9FA',
  totalBg:   'EAF0FB',
  highlight: 'FFF9E6',
  border:    'BDC3C7',
  borderLt:  'DDE1E4',
  textMain:  '1A1A1A',
  textSub:   '444444',
  textHint:  '888888',
  reviewBg:  'FAFBFC',
};

/* ================================================================
   유틸
================================================================ */
function _dFmt(n, digits) {
  digits = digits !== undefined ? digits : 0;
  if (n == null || n === '') return '-';
  var num = parseFloat(n);
  if (isNaN(num)) return String(n);
  return num.toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function _dToday() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

/* docx-js 단축 참조 */
function _D() { return window.docx; }

/* 텍스트 런 생성 */
function _tr(text, opts) {
  var D = _D();
  var runOpts = Object.assign({ text: text, font: 'Malgun Gothic' }, opts || {});
  return new D.TextRun(runOpts);
}

/* 단락 생성 */
function _p(children, opts) {
  var D = _D();
  var pOpts = Object.assign({}, opts || {}, { children: children });
  return new D.Paragraph(pOpts);
}

/* 테이블 셀 생성 */
function _tc(children, width, opts) {
  var D = _D();
  var border = { style: D.BorderStyle.SINGLE, size: 1, color: _DOCX_CLR.borderLt };
  var cellOpts = {
    borders: { top: border, bottom: border, left: border, right: border },
    width: { size: width, type: D.WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    verticalAlign: D.VerticalAlign.CENTER,
    children: children,
  };
  if (opts) Object.assign(cellOpts, opts);
  return new D.TableCell(cellOpts);
}

/* 테이블 헤더 셀 (어두운 배경) */
function _thc(text, width) {
  var D = _D();
  var border = { style: D.BorderStyle.SINGLE, size: 1, color: _DOCX_CLR.border };
  return new D.TableCell({
    borders: { top: border, bottom: border, left: border, right: border },
    width: { size: width, type: D.WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    shading: { fill: _DOCX_CLR.dark, type: D.ShadingType.CLEAR },
    verticalAlign: D.VerticalAlign.CENTER,
    children: [_p([_tr(text, { bold: true, size: 18, color: _DOCX_CLR.white })], { alignment: D.AlignmentType.CENTER })],
  });
}

/* 공통 페이지 속성 */
function _pageProps() {
  return {
    page: {
      size: { width: _DOCX_A4_W, height: _DOCX_A4_H },
      margin: { top: _DOCX_M_TOP, bottom: _DOCX_M_BTM, left: _DOCX_M_LR, right: _DOCX_M_LR },
    },
  };
}

/* 머리글(Header) 생성 */
function _makeHeader(sectionName, pageNum) {
  var D = _D();
  return new D.Header({
    children: [
      _p([
        _tr('신재생에너지 검토 보고서', { size: 16, color: _DOCX_CLR.textHint }),
        _tr('\t'),
        _tr(sectionName, { size: 16, bold: true, color: _DOCX_CLR.dark }),
        _tr('  ' + pageNum, { size: 16, color: 'AAAAAA' }),
      ], {
        tabStops: [{ type: D.TabStopType.RIGHT, position: D.TabStopPosition.MAX }],
        border: { bottom: { style: D.BorderStyle.SINGLE, size: 3, color: _DOCX_CLR.dark, space: 4 } },
        spacing: { after: 200 },
      }),
    ],
  });
}

/* 페이지 제목 (파란 하단선) */
function _pageTitle(text) {
  var D = _D();
  return _p([_tr(text, { bold: true, size: 28, color: _DOCX_CLR.textMain })], {
    spacing: { after: 240 },
    border: { bottom: { style: D.BorderStyle.SINGLE, size: 4, color: _DOCX_CLR.dark, space: 6 } },
  });
}

/* 섹션 소제목 */
function _sectionTitle(text) {
  return _p([_tr(text, { bold: true, size: 22, color: _DOCX_CLR.dark })], {
    spacing: { before: 280, after: 140 },
  });
}

/* HTML 텍스트를 단락 배열로 변환 (간단 파서) */
function _htmlToParagraphs(html) {
  if (!html) return [_p([_tr('(검토 의견 없음)', { size: 20, color: _DOCX_CLR.textHint, italics: true })])];

  var div = document.createElement('div');
  div.innerHTML = html;
  var text = div.textContent || div.innerText || '';
  var lines = text.split(/\n+/).filter(function(l) { return l.trim(); });

  if (lines.length === 0) return [_p([_tr('(검토 의견 없음)', { size: 20, color: _DOCX_CLR.textHint, italics: true })])];

  return lines.map(function(line) {
    return _p([_tr(line.trim(), { size: 20, color: _DOCX_CLR.textMain })], {
      spacing: { after: 100 },
    });
  });
}

/* ================================================================
   Page 1: 표지
================================================================ */
function _buildCoverSection(data) {
  var D = _D();
  var children = [];

  // 상단 여백
  children.push(_p([], { spacing: { before: 3000 } }));

  // 메인 제목
  children.push(_p([_tr('신재생에너지 검토 보고서', { bold: true, size: 60, color: _DOCX_CLR.textMain })], {
    alignment: D.AlignmentType.CENTER,
    spacing: { after: 300 },
  }));

  // 프로젝트명
  children.push(_p([_tr(data.projectName || '', { size: 34, color: _DOCX_CLR.textSub })], {
    alignment: D.AlignmentType.CENTER,
    spacing: { after: 1200 },
  }));

  // 표지 이미지 (base64 → ImageRun)
  if (data.coverImage) {
    try {
      var imgParts = data.coverImage.split(',');
      var imgType = 'png';
      if (imgParts[0] && imgParts[0].indexOf('jpeg') >= 0) imgType = 'jpg';
      var imgData = _base64ToUint8(imgParts[1] || imgParts[0]);
      children.push(_p([new D.ImageRun({
        type: imgType,
        data: imgData,
        transformation: { width: 300, height: 200 },
        altText: { title: '표지 이미지', description: '표지 이미지', name: 'cover' },
      })], {
        alignment: D.AlignmentType.CENTER,
        spacing: { after: 600 },
      }));
    } catch (e) {
      console.warn('표지 이미지 삽입 실패:', e);
    }
  }

  // 날짜
  children.push(_p([_tr(_dToday(), { bold: true, size: 24, color: _DOCX_CLR.textMain })], {
    alignment: D.AlignmentType.CENTER,
    spacing: { after: 400 },
  }));

  // 로고 이미지
  if (data.logoImage) {
    try {
      var logoParts = data.logoImage.split(',');
      var logoType = 'png';
      if (logoParts[0] && logoParts[0].indexOf('jpeg') >= 0) logoType = 'jpg';
      var logoData = _base64ToUint8(logoParts[1] || logoParts[0]);
      children.push(_p([new D.ImageRun({
        type: logoType,
        data: logoData,
        transformation: { width: 120, height: 50 },
        altText: { title: '로고', description: '로고', name: 'logo' },
      })], {
        alignment: D.AlignmentType.CENTER,
      }));
    } catch (e) {
      console.warn('로고 이미지 삽입 실패:', e);
    }
  }

  return {
    properties: _pageProps(),
    children: children,
  };
}

/* base64 → Uint8Array */
function _base64ToUint8(base64) {
  var bin = atob(base64);
  var arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/* ================================================================
   Page 2: 목차
================================================================ */
function _buildTocSection() {
  var D = _D();
  var items = [
    { num: '1', name: '검토결과 요약', page: '3' },
    { num: '2', name: '사업개요',      page: '4' },
    { num: '3', name: '기준검토',      page: '5' },
    { num: '4', name: '설치 비율 검토', page: '6' },
  ];

  var children = [_pageTitle('목  차')];

  items.forEach(function(item) {
    children.push(_p([
      _tr(item.num + '.  ', { bold: true, size: 22, color: _DOCX_CLR.dark }),
      _tr(item.name, { size: 22, color: _DOCX_CLR.textMain }),
      new D.TextRun({
        font: 'Malgun Gothic',
        size: 22,
        children: [
          new D.PositionalTab({
            alignment: D.PositionalTabAlignment.RIGHT,
            relativeTo: D.PositionalTabRelativeTo.MARGIN,
            leader: D.PositionalTabLeader.DOT,
          }),
          item.page,
        ],
      }),
    ], {
      spacing: { after: 100 },
      border: { bottom: { style: D.BorderStyle.SINGLE, size: 1, color: 'F0F0F0', space: 4 } },
    }));
  });

  return {
    properties: Object.assign({}, _pageProps(), {
      headers: { default: _makeHeader('목차', 2) },
    }),
    children: children,
  };
}

/* ================================================================
   Page 3: 검토결과 요약
================================================================ */
function _buildResultSection(data) {
  var D = _D();
  var output2 = data.output2 || [];
  var children = [_pageTitle('검토결과 요약')];

  children.push(_sectionTitle('신재생에너지 적용 비율 검토 요약'));

  // 요약 테이블
  var colW = [2400, 2400, 2400, 2438];
  var headerRow = new D.TableRow({
    children: [_thc('구분', colW[0]), _thc('설치 비율', colW[1]), _thc('의무 비율', colW[2]), _thc('만족 여부', colW[3])],
  });

  var bodyRows = output2.length ? output2.map(function(alt) {
    var 만족 = alt.만족여부 === 'Yes' ? 'PASS' : (alt.만족여부 === 'No' ? 'FAIL' : '해당없음');
    var 만족color = alt.만족여부 === 'Yes' ? _DOCX_CLR.pass : (alt.만족여부 === 'No' ? _DOCX_CLR.fail : _DOCX_CLR.textHint);
    return new D.TableRow({
      children: [
        _tc([_p([_tr(alt.id, { size: 18 })], { alignment: D.AlignmentType.CENTER })], colW[0]),
        _tc([_p([_tr(_dFmt(alt.비율, 1) + ' %', { size: 18 })], { alignment: D.AlignmentType.CENTER })], colW[1]),
        _tc([_p([_tr(alt.의무비율 != null ? alt.의무비율 + ' %' : '-', { size: 18 })], { alignment: D.AlignmentType.CENTER })], colW[2]),
        _tc([_p([_tr(만족, { size: 18, bold: true, color: 만족color })], { alignment: D.AlignmentType.CENTER })], colW[3]),
      ],
    });
  }) : [new D.TableRow({
    children: [_tc([_p([_tr('-', { size: 18 })], { alignment: D.AlignmentType.CENTER })], _DOCX_CW, { columnSpan: 4 })],
  })];

  children.push(new D.Table({
    width: { size: _DOCX_CW, type: D.WidthType.DXA },
    columnWidths: colW,
    rows: [headerRow].concat(bodyRows),
  }));

  // 검토 의견
  children.push(_sectionTitle('검토 의견'));
  var reviewParagraphs = _htmlToParagraphs(data.reviewHTML);
  children = children.concat(reviewParagraphs);

  return {
    properties: Object.assign({}, _pageProps(), {
      headers: { default: _makeHeader('검토결과', 3) },
    }),
    children: children,
  };
}

/* ================================================================
   Page 4: 사업개요
================================================================ */
function _buildProjectSection(data) {
  var D = _D();
  var i = data.input1 || {};
  var children = [_pageTitle('설계개요')];

  var colW = [3373, 6265]; // 35% : 65%

  function _infoRow(label, value) {
    return new D.TableRow({
      children: [
        _tc([_p([_tr(label, { bold: true, size: 18 })])], colW[0], {
          shading: { fill: _DOCX_CLR.labelBg, type: D.ShadingType.CLEAR },
        }),
        _tc([_p([_tr(value, { size: 18 })])], colW[1]),
      ],
    });
  }

  var rows = [
    new D.TableRow({ children: [_thc('구분', colW[0]), _thc('내용', colW[1])] }),
    _infoRow('사업형태', i.사업형태 || '-'),
    _infoRow('사업연도', i.사업연도 || '-'),
    _infoRow('대지위치', i.대지위치 || '-'),
    _infoRow('대지면적', _dFmt(i.대지면적) + ' m\u00B2'),
    _infoRow('건축면적', _dFmt(i.건축면적) + ' m\u00B2'),
    _infoRow('연면적',   _dFmt(i.연면적) + ' m\u00B2'),
    _infoRow('건폐율',   _dFmt(i.건폐율, 1) + ' %'),
    _infoRow('용적률',   _dFmt(i.용적률, 1) + ' %'),
    _infoRow('적용연면적', _dFmt(i.적용연면적) + ' m\u00B2'),
  ];

  if (i.용도별연면적목록 && i.용도별연면적목록.length) {
    i.용도별연면적목록.forEach(function(item, idx) {
      rows.push(_infoRow('용도 (' + (idx + 1) + ')', (item.용도 || '-') + ' / ' + _dFmt(item.연면적) + ' m\u00B2'));
    });
  }

  children.push(new D.Table({
    width: { size: _DOCX_CW, type: D.WidthType.DXA },
    columnWidths: colW,
    rows: rows,
  }));

  return {
    properties: Object.assign({}, _pageProps(), {
      headers: { default: _makeHeader('사업개요', 4) },
    }),
    children: children,
  };
}

/* ================================================================
   Page 5: 기준검토
================================================================ */
function _buildCriteriaSection(data) {
  var D = _D();
  var input1 = data.input1 || {};
  var 사업형태 = input1.사업형태;
  var 연도컬럼 = ['2024','2025','2026','2027','2028','2029','2030'];

  var 페이지제목 = 사업형태 === '공공'
    ? '공공기관 에너지이용 합리화 추진에 관한 규정'
    : (input1.대지위치 || '') + ' 녹색건축물 설계기준';

  var children = [_pageTitle(페이지제목)];
  children.push(_sectionTitle('신재생에너지 의무 설치 비율'));

  if (사업형태 === '공공') {
    var lib = (window.LIB_의무비율 && window.LIB_의무비율['공공']) ? window.LIB_의무비율['공공'] : {};
    var yearColW = Math.floor((_DOCX_CW - 1400) / 연도컬럼.length);
    var firstColW = _DOCX_CW - yearColW * 연도컬럼.length;
    var colWidths = [firstColW].concat(연도컬럼.map(function() { return yearColW; }));

    var hCells = [_thc('구분', firstColW)].concat(연도컬럼.map(function(y, idx) { return _thc(y, colWidths[idx + 1]); }));
    var vCells = [_tc([_p([_tr('공공', { bold: true, size: 18 })], { alignment: D.AlignmentType.CENTER })], firstColW)];
    연도컬럼.forEach(function(y, idx) {
      var v = lib[y];
      var txt = (v !== '' && v != null) ? v + ' %' : '-';
      vCells.push(_tc([_p([_tr(txt, { size: 18 })], { alignment: D.AlignmentType.CENTER })], colWidths[idx + 1]));
    });

    children.push(new D.Table({
      width: { size: _DOCX_CW, type: D.WidthType.DXA },
      columnWidths: colWidths,
      rows: [
        new D.TableRow({ children: hCells }),
        new D.TableRow({ children: vCells }),
      ],
    }));

  } else {
    var lib2 = window.LIB_의무비율 || {};
    var 선택카테고리 = input1.카테고리;
    var 주거구분 = (input1.용도별연면적목록 || []).some(function(x) { return x.용도 !== '공동주택'; }) ? '비주거' : '주거';
    var 지역키 = (window.normalize대지위치 ? window.normalize대지위치(input1.대지위치) : '') || '';
    var 후보 = Object.values(lib2).filter(function(v) { return v.state === 지역키 && v.purpose === 주거구분; });
    var 카테고리순 = ['가','나','다','라'];
    var 정렬 = 카테고리순.map(function(c) { return 후보.find(function(v) { return v.category === c; }); }).filter(Boolean);

    if (정렬.length === 0) {
      children.push(_p([_tr('해당 지역 기준 데이터 없음', { size: 20, color: _DOCX_CLR.textHint, italics: true })]));
    } else {
      var fixedCols = [900, 1400, 1400]; // 등급, 녹색건축인증, 에너지효율등급
      var fixedSum = fixedCols.reduce(function(a, b) { return a + b; }, 0);
      var yrColW = Math.floor((_DOCX_CW - fixedSum) / 연도컬럼.length);
      var lastYrAdj = _DOCX_CW - fixedSum - yrColW * (연도컬럼.length - 1);
      var allColW = fixedCols.concat(연도컬럼.map(function(_, idx) { return idx === 연도컬럼.length - 1 ? lastYrAdj : yrColW; }));

      var hdrCells = [_thc('등급', allColW[0]), _thc('녹색건축인증', allColW[1]), _thc('에너지효율등급', allColW[2])];
      연도컬럼.forEach(function(y, idx) { hdrCells.push(_thc(y, allColW[3 + idx])); });

      var dataRows = 정렬.map(function(item) {
        var isSelected = item.category === 선택카테고리;
        var shadingOpt = isSelected ? { shading: { fill: _DOCX_CLR.highlight, type: D.ShadingType.CLEAR } } : {};
        var cells = [
          _tc([_p([_tr(item.category, { bold: true, size: 18 })], { alignment: D.AlignmentType.CENTER })], allColW[0], shadingOpt),
          _tc([_p([_tr(item.녹색건축인증 || '-', { size: 18 })], { alignment: D.AlignmentType.CENTER })], allColW[1], shadingOpt),
          _tc([_p([_tr(item.에너지효율등급 || '-', { size: 18 })], { alignment: D.AlignmentType.CENTER })], allColW[2], shadingOpt),
        ];
        연도컬럼.forEach(function(y, idx) {
          var v = item[y];
          var txt = (v === '' || v == null) ? '-' : (v === '자율' ? '자율' : v + ' %');
          cells.push(_tc([_p([_tr(txt, { size: 18 })], { alignment: D.AlignmentType.CENTER })], allColW[3 + idx], shadingOpt));
        });
        return new D.TableRow({ children: cells });
      });

      children.push(new D.Table({
        width: { size: _DOCX_CW, type: D.WidthType.DXA },
        columnWidths: allColW,
        rows: [new D.TableRow({ children: hdrCells })].concat(dataRows),
      }));
    }
  }

  return {
    properties: Object.assign({}, _pageProps(), {
      headers: { default: _makeHeader('기준검토', 5) },
    }),
    children: children,
  };
}

/* ================================================================
   Page 6: 설치 비율 검토
================================================================ */
function _buildRatioSection(data) {
  var D = _D();
  var output1 = data.output1 || {};
  var output2 = data.output2 || [];

  var children = [_pageTitle('설치 비율 검토')];

  // ── 예상에너지 사용량 테이블 ──
  children.push(_sectionTitle('예상에너지 사용량 검토'));

  var eCols = [800, 1600, 1600, 1200, 2100, 2338];
  var eHeader = new D.TableRow({
    children: [
      _thc('구분', eCols[0]),
      _thc('용도', eCols[1]),
      _thc('적용연면적\n(m\u00B2)', eCols[2]),
      _thc('지역계수', eCols[3]),
      _thc('단위에너지사용량\n(kWh/m\u00B2\u00B7yr)', eCols[4]),
      _thc('예상에너지사용량\n(kWh/yr)', eCols[5]),
    ],
  });

  var eRows = [];
  if (output1.용도별결과 && output1.용도별결과.length) {
    output1.용도별결과.forEach(function(row, idx) {
      eRows.push(new D.TableRow({
        children: [
          _tc([_p([_tr(String(idx + 1), { size: 18 })], { alignment: D.AlignmentType.CENTER })], eCols[0]),
          _tc([_p([_tr(row.용도, { size: 18 })], { alignment: D.AlignmentType.CENTER })], eCols[1]),
          _tc([_p([_tr(_dFmt(row.연면적), { size: 18 })], { alignment: D.AlignmentType.CENTER })], eCols[2]),
          _tc([_p([_tr(_dFmt(row.지역계수, 2), { size: 18 })], { alignment: D.AlignmentType.CENTER })], eCols[3]),
          _tc([_p([_tr(_dFmt(row.단위에너지사용량, 2), { size: 18 })], { alignment: D.AlignmentType.CENTER })], eCols[4]),
          _tc([_p([_tr(_dFmt(Math.round(row.예상에너지사용량)), { size: 18 })], { alignment: D.AlignmentType.CENTER })], eCols[5]),
        ],
      }));
    });
  }

  // 합계행
  eRows.push(new D.TableRow({
    children: [
      _tc([_p([_tr('합계', { bold: true, size: 18 })], { alignment: D.AlignmentType.CENTER })], eCols[0] + eCols[1], {
        columnSpan: 2,
        shading: { fill: _DOCX_CLR.totalBg, type: D.ShadingType.CLEAR },
      }),
      _tc([_p([_tr(_dFmt(output1.총연면적), { bold: true, size: 18 })], { alignment: D.AlignmentType.CENTER })], eCols[2], {
        shading: { fill: _DOCX_CLR.totalBg, type: D.ShadingType.CLEAR },
      }),
      _tc([_p([_tr('', { size: 18 })])], eCols[3], {
        shading: { fill: _DOCX_CLR.totalBg, type: D.ShadingType.CLEAR },
      }),
      _tc([_p([_tr('', { size: 18 })])], eCols[4], {
        shading: { fill: _DOCX_CLR.totalBg, type: D.ShadingType.CLEAR },
      }),
      _tc([_p([_tr(_dFmt(Math.round(output1.총예상에너지사용량)), { bold: true, size: 18 })], { alignment: D.AlignmentType.CENTER })], eCols[5], {
        shading: { fill: _DOCX_CLR.totalBg, type: D.ShadingType.CLEAR },
      }),
    ],
  }));

  children.push(new D.Table({
    width: { size: _DOCX_CW, type: D.WidthType.DXA },
    columnWidths: eCols,
    rows: [eHeader].concat(eRows),
  }));

  // ── ALT별 시나리오 ──
  children.push(_sectionTitle('신재생에너지 설치 비율 검토'));

  if (!output2.length) {
    children.push(_p([_tr('시나리오 없음', { size: 20, color: _DOCX_CLR.textHint, italics: true })]));
  } else {
    output2.forEach(function(alt) {
      children.push(_p([_tr(alt.id, { bold: true, size: 22, color: _DOCX_CLR.dark })], {
        spacing: { before: 200, after: 100 },
      }));

      var aCols = [1400, 1400, 1700, 1200, 1400, 2538];
      var aHeader = new D.TableRow({
        children: [
          _thc('에너지원', aCols[0]),
          _thc('형식', aCols[1]),
          _thc('단위에너지생산량\n(kWh/kW\u00B7yr)', aCols[2]),
          _thc('원별보정계수', aCols[3]),
          _thc('적용용량\n(kW)', aCols[4]),
          _thc('신재생에너지생산량\n(kWh/yr)', aCols[5]),
        ],
      });

      var aRows = [];
      if (alt.systems && alt.systems.length) {
        alt.systems.forEach(function(s) {
          aRows.push(new D.TableRow({
            children: [
              _tc([_p([_tr(s.에너지원, { size: 18 })], { alignment: D.AlignmentType.CENTER })], aCols[0]),
              _tc([_p([_tr(s.형식, { size: 18 })], { alignment: D.AlignmentType.CENTER })], aCols[1]),
              _tc([_p([_tr(_dFmt(s.단위에너지생산량), { size: 18 })], { alignment: D.AlignmentType.CENTER })], aCols[2]),
              _tc([_p([_tr(_dFmt(s.원별보정계수, 2), { size: 18 })], { alignment: D.AlignmentType.CENTER })], aCols[3]),
              _tc([_p([_tr(_dFmt(s.적용용량), { size: 18 })], { alignment: D.AlignmentType.CENTER })], aCols[4]),
              _tc([_p([_tr(_dFmt(Math.round(s.신재생에너지생산량)), { size: 18 })], { alignment: D.AlignmentType.CENTER })], aCols[5]),
            ],
          }));
        });
      }

      // 요약 행들
      function _summaryRow(label, value, opts) {
        var labelColW = aCols[0] + aCols[1] + aCols[2] + aCols[3] + aCols[4];
        var valBold = (opts && opts.bold) || false;
        var valColor = (opts && opts.color) || _DOCX_CLR.textMain;
        return new D.TableRow({
          children: [
            _tc([_p([_tr(label, { bold: true, size: 18 })], { alignment: D.AlignmentType.RIGHT })], labelColW, {
              columnSpan: 5,
              shading: { fill: _DOCX_CLR.labelBg, type: D.ShadingType.CLEAR },
            }),
            _tc([_p([_tr(value, { bold: valBold, size: 18, color: valColor })], { alignment: D.AlignmentType.CENTER })], aCols[5]),
          ],
        });
      }

      var 만족text = alt.만족여부 === 'Yes' ? 'PASS' : (alt.만족여부 === 'No' ? 'FAIL' : '해당없음');
      var 만족clr = alt.만족여부 === 'Yes' ? _DOCX_CLR.pass : (alt.만족여부 === 'No' ? _DOCX_CLR.fail : _DOCX_CLR.textHint);

      aRows.push(_summaryRow('신재생에너지 생산량 합계 (kWh/yr)', _dFmt(Math.round(alt.생산량합계)), { bold: true }));
      aRows.push(_summaryRow('총 에너지 사용량 (kWh/yr)', _dFmt(Math.round(alt.총에너지사용량))));
      aRows.push(_summaryRow('신재생에너지 설치 비율 (%)', _dFmt(alt.비율, 1) + ' %', { bold: true }));
      aRows.push(_summaryRow('의무 설치 비율 (%)', alt.의무비율 != null ? alt.의무비율 + ' %' : '-'));
      aRows.push(_summaryRow('의무비율 만족 여부', 만족text, { bold: true, color: 만족clr }));

      children.push(new D.Table({
        width: { size: _DOCX_CW, type: D.WidthType.DXA },
        columnWidths: aCols,
        rows: [aHeader].concat(aRows),
      }));
    });
  }

  // 각주
  children.push(_p([_tr('* 단위에너지사용량 및 지역계수는 관련 고시에 따라 자동 적용됩니다.', { size: 16, color: _DOCX_CLR.textHint, italics: true })], {
    spacing: { before: 200 },
    border: { top: { style: D.BorderStyle.SINGLE, size: 1, color: 'EEEEEE', space: 4 } },
  }));

  return {
    properties: Object.assign({}, _pageProps(), {
      headers: { default: _makeHeader('설치 비율 검토', 6) },
    }),
    children: children,
  };
}

/* ================================================================
   메인: downloadReportWord(data)
================================================================ */
async function downloadReportWord(data) {
  var btn = document.getElementById('btn-report-word');
  var modalBtn = document.getElementById('modal-btn-word');
  [btn, modalBtn].forEach(function(b) {
    if (b) { b.disabled = true; b.textContent = '변환 중...'; }
  });

  try {
    var D = _D();
    if (!D) throw new Error('docx 라이브러리가 로드되지 않았습니다.');

    var doc = new D.Document({
      styles: {
        default: {
          document: {
            run: { font: 'Malgun Gothic', size: 22 },
          },
        },
      },
      sections: [
        _buildCoverSection(data),
        _buildTocSection(),
        _buildResultSection(data),
        _buildProjectSection(data),
        _buildCriteriaSection(data),
        _buildRatioSection(data),
      ],
    });

    var blob = await D.Packer.toBlob(doc);
    var filename = '신재생에너지검토_' + new Date().toISOString().slice(0, 10) + '.docx';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

  } catch (err) {
    console.error('Word 변환 오류:', err);
    alert('Word 변환 중 오류가 발생했습니다: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Word 저장'; }
    if (modalBtn) { modalBtn.disabled = false; modalBtn.textContent = 'Word 저장'; }
  }
}
