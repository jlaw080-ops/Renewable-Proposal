"use client";
import { useEffect, useRef, useState } from "react";
import { useNaverMapReady } from "@/lib/useNaverMap";
import { regionFromNaverElements, regionFromReverseGeocode } from "@/lib/regionResolver";
import Field from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import "./locationPicker.css";

const SEOUL = { lat: 37.5665, lng: 126.978 };

export default function LocationPicker({ value, onResolve }) {
  const { ready, error } = useNaverMapReady();
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  function placeMarker(lat, lng) {
    if (!mapRef.current || !window.naver?.maps) return; // SDK 인증 실패 시 maps가 무력화될 수 있음 — 지도 없이도 검색은 계속

    const pos = new window.naver.maps.LatLng(lat, lng);
    mapRef.current.setCenter(pos);
    if (mapRef.current.getZoom() < 15) mapRef.current.setZoom(15);
    if (markerRef.current) markerRef.current.setPosition(pos);
    else markerRef.current = new window.naver.maps.Marker({ map: mapRef.current, position: pos });
  }

  useEffect(() => {
    if (!ready || mapRef.current || !mapEl.current) return;
    const center = value ? { lat: value.lat, lng: value.lng } : SEOUL;
    mapRef.current = new window.naver.maps.Map(mapEl.current, {
      center: new window.naver.maps.LatLng(center.lat, center.lng),
      zoom: value ? 15 : 11,
    });
    if (value) placeMarker(value.lat, value.lng);
    window.naver.maps.Event.addListener(mapRef.current, "click", async e => {
      const lat = e.coord.lat(), lng = e.coord.lng();
      setBusy(true); setNotice(null);
      try {
        const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "역지오코딩 실패");
        const { region, address } = regionFromReverseGeocode(data.results ?? []);
        if (!region) { setNotice("지역을 판정할 수 없는 위치입니다"); return; }
        placeMarker(lat, lng);
        onResolve({ region, address, lat, lng });
      } catch (err) { setNotice(err.message); } finally { setBusy(false); }
    });
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  async function search() {
    if (!keyword.trim()) return;
    setBusy(true); setNotice(null);
    try {
      const res = await fetch("/api/geocode?query=" + encodeURIComponent(keyword));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "주소 검색 실패");
      const addr = (data.addresses ?? [])[0];
      if (!addr) { setNotice("검색 결과가 없습니다: " + keyword); return; }
      const lat = parseFloat(addr.y), lng = parseFloat(addr.x);
      const region = regionFromNaverElements(addr.addressElements ?? []);
      if (!region) { setNotice("지역을 판정할 수 없습니다 — 대지위치를 직접 선택하세요"); return; }
      if (ready) placeMarker(lat, lng);
      onResolve({ region, address: addr.roadAddress || addr.jibunAddress || keyword, lat, lng });
    } catch (err) { setNotice(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="lp">
      <div className="lp__search">
        <Field label="주소 검색" placeholder="예: 서울특별시 강남구 테헤란로 152" value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") search(); }} />
        <Button onClick={search} disabled={busy}>{busy ? "검색 중…" : "검색"}</Button>
      </div>
      {error
        ? <p className="lp__fallback">지도를 불러올 수 없습니다 — 주소 검색과 대지위치 직접 선택은 계속 사용할 수 있습니다.</p>
        : <div ref={mapEl} className="lp__map" aria-label="위치 선택 지도" />}
      {value?.address && (
        <p className="lp__result">
          <Badge tone="brand">확정 위치</Badge> <span>{value.address}</span>
        </p>
      )}
      {notice && <p className="lp__notice" role="status">{notice}</p>}
    </div>
  );
}
