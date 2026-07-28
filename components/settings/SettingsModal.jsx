"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { loadScriptOnce } from "@/lib/scriptLoader";
import "./settingsModal.css";

export default function SettingsModal({ open, onClose, children }) {
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError(null);
    loadScriptOnce("/settings/settingsUI.js")
      .then(() => {
        if (!alive) return;
        if (window.SettingsUI?.init) window.SettingsUI.init();
        else throw new Error("SettingsUI 초기화 실패");
      })
      .catch(e => alive && setError(e.message));
    return () => { alive = false; };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="설정 — 입력값 · 가중치 · 라이브러리" wide>
      {error && <p className="sm__error" role="status">{error}</p>}
      <p className="sm__hint">변경 사항은 즉시 저장됩니다. 계산·최적화 결과에 반영하려면 해당 화면에서 다시 실행하세요.</p>
      {children}
      <div id="settings-content" className="sm__content" />
    </Modal>
  );
}
