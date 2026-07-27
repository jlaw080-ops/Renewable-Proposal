"use client";
import { useEffect, useState } from "react";

let sdkPromise = null;

export function loadNaverMapSdk() {
  if (typeof window !== "undefined" && window.naver?.maps) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const keyId = process.env.NEXT_PUBLIC_NCP_CLIENT_ID;
      if (!keyId) { reject(new Error("NEXT_PUBLIC_NCP_CLIENT_ID 미설정")); return; }
      const s = document.createElement("script");
      s.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${keyId}`;
      s.async = true;
      s.onload = () => (window.naver?.maps ? resolve() : reject(new Error("네이버 지도 SDK 초기화 실패")));
      s.onerror = () => reject(new Error("네이버 지도 SDK 로드 실패"));
      document.head.appendChild(s);
    });
    sdkPromise.catch(() => { sdkPromise = null; }); // 실패 시 재시도 허용
  }
  return sdkPromise;
}

export function useNaverMapReady() {
  const [state, setState] = useState({ ready: false, error: null });
  useEffect(() => {
    let alive = true;
    loadNaverMapSdk()
      .then(() => alive && setState({ ready: true, error: null }))
      .catch(e => alive && setState({ ready: false, error: e.message }));
    return () => { alive = false; };
  }, []);
  return state;
}
