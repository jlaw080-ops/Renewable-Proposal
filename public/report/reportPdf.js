// report/reportPdf.js
// PDF / HTML / Word 다운로드 함수

'use strict';

function _filename(ext) {
  var d = new Date().toISOString().slice(0, 10);
  return '신재생에너지검토_' + d + '.' + ext;
}

// ── PDF 다운로드 ────────────────────────────────────
async function downloadReportPDF(reportHTML) {
  var btn      = document.getElementById('btn-report-pdf');
  var modalBtn = document.getElementById('modal-btn-pdf');
  [btn, modalBtn].forEach(function(b) {
    if (b) { b.disabled = true; b.textContent = '변환 중...'; }
  });

  try {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) throw new Error('jsPDF 라이브러리가 로드되지 않았습니다.');
    if (!window.html2canvas) throw new Error('html2canvas 라이브러리가 로드되지 않았습니다.');

    var pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // 임시 컨테이너에 렌더링
    var container = document.createElement('div');
    container.style.cssText = [
      'position:absolute',
      'left:-9999px',
      'top:0',
      'width:794px',
      'background:white',
    ].join(';');
    container.innerHTML = reportHTML;
    document.body.appendChild(container);

    // 폰트 로드 대기 (지시서 필수 사항)
    await document.fonts.ready;
    await new Promise(function(r) { setTimeout(r, 400); }); // 렌더링 안정화 대기

    var pages = container.querySelectorAll('.report-page');
    for (var i = 0; i < pages.length; i++) {
      var canvas = await html2canvas(pages[i], {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      var imgData = canvas.toDataURL('image/png');
      var pdfW = pdf.internal.pageSize.getWidth();
      var pdfH = (canvas.height * pdfW) / canvas.width;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, Math.min(pdfH, 297));
    }

    document.body.removeChild(container);
    pdf.save(_filename('pdf'));

  } catch (err) {
    console.error('PDF 변환 오류:', err);
    alert('PDF 변환 중 오류가 발생했습니다: ' + err.message);
  } finally {
    if (btn)      { btn.disabled = false;      btn.textContent = 'PDF 다운로드'; }
    if (modalBtn) { modalBtn.disabled = false; modalBtn.textContent = 'PDF 다운로드'; }
  }
}

// ── HTML 저장 ───────────────────────────────────────
function downloadReportHTML(reportHTML) {
  _downloadBlob(reportHTML, _filename('html'), 'text/html;charset=utf-8');
}

// ── Word 저장 (.docx) — report/reportDocx.js로 이관 ──

// ── 공통 유틸 ───────────────────────────────────────
function _downloadBlob(content, filename, type) {
  var blob = (content instanceof Blob)
    ? content
    : new Blob([content], { type: type });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

