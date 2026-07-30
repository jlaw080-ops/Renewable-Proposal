"use client";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { loadReportAssets, buildStyledReport } from "@/lib/reportAssets";
import "./report.css";

export default function ReportActions({ coverImage, calcReady, onCoverChange, getReportData }) {
  const [previewHtml, setPreviewHtml] = useState(null);
  const [busy, setBusy] = useState(null); // "preview"|"pdf"|"html"|"word"|null
  const [error, setError] = useState(null);

  const COVER_MAX_BYTES = 2 * 1024 * 1024; // localStorage 한도(~5MB, base64 +33%) 보호

  function pickCover(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > COVER_MAX_BYTES) {
      setError(`표지 이미지는 2MB 이하만 가능합니다 (선택한 파일: ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      e.target.value = "";
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => onCoverChange(reader.result);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function withAssets(kind, fn) {
    setBusy(kind); setError(null);
    try { await loadReportAssets(); await fn(); }
    catch (e) { setError(e.message); }
    finally { setBusy(null); }
  }

  const preview = () => withAssets("preview", async () => setPreviewHtml(await buildStyledReport(getReportData())));
  const pdf = () => withAssets("pdf", async () => window.downloadReportPDF(await buildStyledReport(getReportData())));
  const html = () => withAssets("html", async () => window.downloadReportHTML(await buildStyledReport(getReportData())));
  const word = () => withAssets("word", async () => window.downloadReportWord(getReportData()));

  return (
    <div className="ra">
      <div className="ra__cover">
        <span>표지 이미지</span>
        {coverImage && <img src={coverImage} alt="표지 미리보기" />}
        <input type="file" accept="image/*" onChange={pickCover} />
        {coverImage && <Button size="sm" variant="ghost" onClick={() => onCoverChange(null)}>제거</Button>}
      </div>
      <div className="ra__row">
        <Button onClick={preview} disabled={!calcReady || !!busy}>{busy === "preview" ? "생성 중…" : "보고서 미리보기"}</Button>
        <Button variant="ghost" onClick={pdf} disabled={!calcReady || !!busy}>{busy === "pdf" ? "생성 중…" : "PDF 다운로드"}</Button>
        <Button variant="ghost" onClick={word} disabled={!calcReady || !!busy}>{busy === "word" ? "생성 중…" : "Word 다운로드"}</Button>
        <Button variant="ghost" onClick={html} disabled={!calcReady || !!busy}>{busy === "html" ? "생성 중…" : "HTML 다운로드"}</Button>
      </div>
      {!calcReady && <p className="rv__hint">①·② 입력을 완료하면 보고서를 생성할 수 있습니다.</p>}
      {error && <p className="rv__error" role="status">보고서 오류: {error}</p>}
      <Modal open={previewHtml !== null} onClose={() => setPreviewHtml(null)} title="보고서 미리보기" wide>
        {previewHtml !== null && <iframe className="ra__frame" title="보고서 미리보기" srcDoc={previewHtml} />}
      </Modal>
    </div>
  );
}
