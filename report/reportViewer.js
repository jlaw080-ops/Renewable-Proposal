// report/reportViewer.js
// 리포트 미리보기 모달 제어

'use strict';

var _currentReportHTML = '';

function showReportModal(data) {
  var html = buildReport(data);
  _currentReportHTML = html;

  // iframe에 srcdoc으로 주입 (CORS 없이 로컬 렌더링)
  var iframe = document.getElementById('report-iframe');
  // reportStyle.css 경로를 절대 경로로 교정 (file:// 환경 대응)
  var basePath = location.href.replace(/[^/\\]*$/, '');
  var fixedHtml = html.replace(
    'href="report/reportStyle.css"',
    'href="' + basePath + 'report/reportStyle.css"'
  );
  iframe.srcdoc = fixedHtml;

  var modal = document.getElementById('report-modal');
  modal.style.display = 'flex';

  // 모달 내부 버튼 이벤트 (매번 재바인딩)
  document.getElementById('modal-btn-pdf').onclick = function() {
    downloadReportPDF(_currentReportHTML);
  };
  document.getElementById('modal-btn-html').onclick = function() {
    downloadReportHTML(_currentReportHTML);
  };
  document.getElementById('modal-btn-word').onclick = function() {
    downloadReportWord(_currentReportHTML);
  };
  document.getElementById('modal-btn-close').onclick = closeReportModal;

  // 모달 외부 클릭 시 닫기
  modal.onclick = function(e) {
    if (e.target === modal) closeReportModal();
  };
}

function closeReportModal() {
  document.getElementById('report-modal').style.display = 'none';
  document.getElementById('report-iframe').srcdoc = '';
}
