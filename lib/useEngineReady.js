"use client";
import { useEffect, useState } from "react";
import { ENGINE_SCRIPTS, READY_GLOBALS } from "./engineScripts";

let loadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.onload = resolve;
    s.onerror = () => reject(new Error("스크립트 로드 실패: " + src));
    document.head.appendChild(s);
  });
}

export function loadEngine() {
  if (!loadPromise) {
    loadPromise = (async () => {
      // Step 1: 스크립트 순차 로드 (window 전역변수 설정)
      for (const src of ENGINE_SCRIPTS) {
        await loadScript(src);
      }

      // Step 2: libraryLoader의 캐시 초기화 (window 전역변수 → 캐시)
      const { loadLibraries } = await import("@/engine/libraryLoader.js");
      await loadLibraries();

      // Step 3: 필수 전역변수 확인
      const missing = READY_GLOBALS.filter(g => !(g in window));
      if (missing.length) throw new Error("엔진 전역 누락: " + missing.join(", "));
    })();
  }
  return loadPromise;
}

export function useEngineReady() {
  const [state, setState] = useState({ ready: false, error: null });
  useEffect(() => {
    let alive = true;
    loadEngine()
      .then(() => alive && setState({ ready: true, error: null }))
      .catch(e => alive && setState({ ready: false, error: e.message }));
    return () => { alive = false; };
  }, []);
  return state;
}
