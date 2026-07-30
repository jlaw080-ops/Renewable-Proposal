"use client";
import { loadScriptOnce } from "@/lib/scriptLoader";

// SRI 해시는 배포된 파일 원문 기준 — CDN 파일 버전 변경 시 해시 재계산 필수 (docx는 이를 위해 8.6.0 고정)
const CDN = [
  { src: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    integrity: "sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk" },
  { src: "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    integrity: "sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H" },
  { src: "https://unpkg.com/docx@8.6.0/build/index.umd.js",
    integrity: "sha384-4SKfH1E/s1imU9AjjNoxcGV2w4NxAzi4HDrJD7MweJJY+LZrRYDhP05DALqhQ15G" },
];
const REPORT_SCRIPTS = ["/report/reportBuilder.js", "/report/reportPdf.js", "/report/reportDocx.js"];

export async function loadReportAssets() {
  const { normalize대지위치 } = await import("@/engine/libraryLoader.js");
  if (typeof window !== "undefined" && !window.normalize대지위치) {
    window.normalize대지위치 = normalize대지위치; // reportBuilder가 window 전역을 읽음
  }
  for (const { src, integrity } of CDN) await loadScriptOnce(src, { integrity });
  for (const src of REPORT_SCRIPTS) await loadScriptOnce(src);
  const missing = ["buildReport", "downloadReportPDF", "downloadReportHTML", "downloadReportWord"]
    .filter(fn => typeof window[fn] !== "function");
  if (missing.length) throw new Error("보고서 모듈 전역 누락: " + missing.join(", "));
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); // ReviewSection과 동일 이스케이프 (심층 방어)

// reportBuilder는 CSS를 상대경로(report/reportStyle.css)로 참조 — 구앱은 루트 서빙이라 정상이었지만
// 새 앱은 /project/{id}/report 하위라 경로가 어긋나 무스타일 출력됨.
// 링크를 인라인 <style>로 치환해 미리보기(iframe)·PDF(html2canvas)·HTML 다운로드(file://) 모두에서 스타일 보장.
let reportCssCache = null;

export async function buildStyledReport(data) {
  if (reportCssCache === null) {
    const resp = await fetch("/report/reportStyle.css");
    if (!resp.ok) throw new Error("보고서 스타일시트를 불러오지 못했습니다");
    reportCssCache = await resp.text();
  }
  return window.buildReport(data).replace(
    '<link rel="stylesheet" href="report/reportStyle.css">',
    `<style>\n${reportCssCache}\n</style>`,
  );
}

export function buildReportData({ project, output1, output2, 카테고리 }) {
  const d = project.data;
  return {
    input1: {
      ...d.input1,
      카테고리,
      적용연면적: Number(d.input1?.연면적) || 0,
    },
    output1,
    output2,
    reviewHTML: d.review?.text ? esc(d.review.text).replace(/\n/g, "<br>") : "",
    projectName: project.name,
    coverImage: d.coverImage ?? null,
    logoImage: null,
  };
}
