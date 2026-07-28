"use client";

const cache = new Map(); // src → Promise

export function loadScriptOnce(src) {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저 전용"));
  if (!cache.has(src)) {
    const p = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = false; // 순서 보존 (report 스크립트 상호 의존)
      s.onload = resolve;
      s.onerror = () => reject(new Error("스크립트 로드 실패: " + src));
      document.head.appendChild(s);
    });
    p.catch(() => cache.delete(src));
    cache.set(src, p);
  }
  return cache.get(src);
}
