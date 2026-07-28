"use client";
import { loadScriptOnce } from "@/lib/scriptLoader";

const CDN = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://unpkg.com/docx@8/build/index.umd.js",
];
const REPORT_SCRIPTS = ["/report/reportBuilder.js", "/report/reportPdf.js", "/report/reportDocx.js"];

export async function loadReportAssets() {
  const { normalize대지위치 } = await import("@/engine/libraryLoader.js");
  if (typeof window !== "undefined" && !window.normalize대지위치) {
    window.normalize대지위치 = normalize대지위치; // reportBuilder가 window 전역을 읽음
  }
  for (const src of [...CDN, ...REPORT_SCRIPTS]) await loadScriptOnce(src);
  const missing = ["buildReport", "downloadReportPDF", "downloadReportHTML", "downloadReportWord"]
    .filter(fn => typeof window[fn] !== "function");
  if (missing.length) throw new Error("보고서 모듈 전역 누락: " + missing.join(", "));
}

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); // ReviewSection과 동일 이스케이프 (심층 방어)

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
