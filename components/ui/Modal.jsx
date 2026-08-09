"use client";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import "./modal.css";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, footer, wide = false, children }) {
  const titleId = useId();
  const backdropRef = useRef(null);
  const dialogRef = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;          // 최신 핸들러를 ref로 — effect 의존성에서 제외해 리렌더 재실행 방지

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;                 // 닫힐 때 복귀할 트리거
    const dialog = dialogRef.current;
    // 본문 우선: 헤더 닫기 버튼이 첫 포커스가 되면 입력 대신 닫기에 포커스가 간다
    const first = bodyRef.current?.querySelector(FOCUSABLE)
      ?? dialog.querySelector(FOCUSABLE)
      ?? dialog;
    first.focus();

    // 배경 비활성화: body 직계 중 모달 백드롭 제외 전부 inert
    const siblings = [...document.body.children].filter(el => el !== backdropRef.current);
    siblings.forEach(el => el.setAttribute("inert", ""));

    const onKey = e => {
      if (e.key === "Escape") { onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) { e.preventDefault(); return; }
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && (document.activeElement === lastEl || !dialog.contains(document.activeElement))) {
        e.preventDefault(); firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      siblings.forEach(el => el.removeAttribute("inert"));
      trigger?.focus?.();
    };
  }, [open]);   // onClose는 ref 경유 — 의존성에 넣으면 렌더마다 재실행되어 포커스가 튄다

  if (!open) return null;
  return createPortal(
    <div className="modal__backdrop" ref={backdropRef} onClick={onClose}>
      <div className={wide ? "modal modal--wide" : "modal"} ref={dialogRef} role="dialog" aria-modal="true"
        aria-labelledby={titleId} tabIndex={-1} onClick={e => e.stopPropagation()}>
        <header className="modal__head">
          <h2 className="modal__title" id={titleId}>{title}</h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">×</button>
        </header>
        <div className="modal__body" ref={bodyRef}>{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
